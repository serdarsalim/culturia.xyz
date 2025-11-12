import { google, youtube_v3 } from 'googleapis';
import { supabase } from '@/lib/supabase/client';

export interface YouTubeTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function getYouTubeCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('YouTube credentials not configured. Check YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables.');
  }

  const redirectUri = process.env.NODE_ENV === 'production'
    ? 'https://culturia.xyz/api/auth/youtube/callback'
    : 'http://localhost:3000/api/auth/youtube/callback';

  return { clientId, clientSecret, redirectUri };
}

export class YouTubeClient {
  private oauth2Client;
  private youtube: youtube_v3.Youtube | null = null;

  constructor() {
    const { clientId, clientSecret, redirectUri } = getYouTubeCredentials();
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
  }

  /**
   * Generate OAuth URL for user authentication
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent', // Force to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<YouTubeTokens> {
    const { tokens } = await this.oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to get tokens from authorization code');
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiry_date || Date.now() + 3600 * 1000,
    };
  }

  /**
   * Initialize YouTube client with tokens
   */
  async initialize(userId: string): Promise<void> {
    // Fetch tokens from database
    const { data: tokenData, error } = await supabase
      .from('youtube_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !tokenData) {
      throw new Error('YouTube not connected. Please authenticate first.');
    }

    // Check if token is expired
    const now = Date.now();
    if (tokenData.expires_at < now) {
      // Refresh the token
      this.oauth2Client.setCredentials({
        refresh_token: tokenData.refresh_token,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      // Update database with new token
      await supabase
        .from('youtube_tokens')
        .update({
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date || Date.now() + 3600 * 1000,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      this.oauth2Client.setCredentials(credentials);
    } else {
      // Use existing valid token
      this.oauth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
      });
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  /**
   * Search for a playlist by exact title
   */
  async searchPlaylist(title: string): Promise<string | null> {
    if (!this.youtube) throw new Error('YouTube client not initialized');

    console.log('[YouTube API] Calling playlists.list (Cost: ~1 unit)');
    const response = await this.youtube.playlists.list({
      part: ['snippet'],
      mine: true,
      maxResults: 50,
    });

    const playlists = response.data.items || [];
    const playlist = playlists.find(p => p.snippet?.title === title);

    console.log(`[YouTube API] Found ${playlists.length} playlists, match: ${playlist ? 'YES' : 'NO'}`);
    return playlist?.id || null;
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(title: string, description: string): Promise<string> {
    if (!this.youtube) throw new Error('YouTube client not initialized');

    console.log('[YouTube API] Calling playlists.insert (Cost: ~50 units)');
    console.log(`[YouTube API] Creating playlist: "${title}"`);

    try {
      console.log('[YouTube API] Sending playlist creation request...');
      const response = await this.youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
          },
          status: {
            privacyStatus: 'public',
          },
        },
      });

      console.log('[YouTube API] Received response from YouTube');
      console.log(`[YouTube API] Response status: ${response.status}`);
      console.log(`[YouTube API] Response data:`, JSON.stringify(response.data, null, 2));

      const playlistId = response.data.id;
      if (!playlistId) {
        console.error('[YouTube API] No playlist ID in response!');
        throw new Error('Failed to create playlist - no ID returned from YouTube');
      }

      console.log(`[YouTube API] Playlist created successfully: ${playlistId}`);
      return playlistId;
    } catch (error: any) {
      console.error('[YouTube API] Playlist creation FAILED!');
      console.error(`Error type: ${error.constructor?.name}`);
      console.error(`Error code: ${error.code}`);
      console.error(`Error status: ${error.status}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Full error object:`, JSON.stringify(error, null, 2));
      if (error.errors && error.errors.length > 0) {
        console.error('Detailed API errors:', JSON.stringify(error.errors, null, 2));
      }
      if (error.response) {
        console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
      }

      // Check for rate limit / quota errors
      if (error.code === 429 || error.code === 403 || error.message?.includes('quota') || error.message?.includes('exhausted') || error.message?.includes('limit')) {
        throw new Error('YouTube daily playlist creation limit reached (~50 playlists/day per channel). This limit resets at midnight Pacific Time. Please try again tomorrow or contact Google for quota increase: https://support.google.com/youtube/contact/yt_api_form');
      }

      throw error;
    }
  }

  /**
   * Get all video IDs currently in a playlist
   */
  async getPlaylistVideoIds(playlistId: string): Promise<string[]> {
    if (!this.youtube) throw new Error('YouTube client not initialized');

    const videoIds: string[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`[YouTube API] Calling playlistItems.list page ${pageCount} (Cost: ~1 unit per page)`);
      const response = await this.youtube.playlistItems.list({
        part: ['contentDetails'],
        playlistId,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      const items = response.data.items || [];
      videoIds.push(...items.map(item => item.contentDetails?.videoId).filter(Boolean) as string[]);

      nextPageToken = response.data.nextPageToken || undefined;
    } while (nextPageToken);

    console.log(`[YouTube API] Found ${videoIds.length} videos in playlist`);
    return videoIds;
  }

  /**
   * Add videos to a playlist (only adds videos that aren't already in the playlist)
   */
  async addVideosToPlaylist(playlistId: string, videoIds: string[]): Promise<number> {
    if (!this.youtube) throw new Error('YouTube client not initialized');

    console.log(`[YouTube API] Starting addVideosToPlaylist with ${videoIds.length} videos`);

    // Get existing videos in playlist
    const existingVideoIds = await this.getPlaylistVideoIds(playlistId);

    // Filter out videos that are already in the playlist
    const newVideoIds = videoIds.filter(id => !existingVideoIds.includes(id));

    if (newVideoIds.length === 0) {
      console.log('[YouTube API] No new videos to add (all already in playlist)');
      return 0; // No new videos to add
    }

    console.log(`[YouTube API] Adding ${newVideoIds.length} new videos to playlist (Cost: ~50 units each)`);

    // Add each video to the playlist
    let addedCount = 0;
    for (const videoId of newVideoIds) {
      try {
        console.log(`[YouTube API] Calling playlistItems.insert for video ${videoId} (Cost: ~50 units)`);
        await this.youtube.playlistItems.insert({
          part: ['snippet'],
          requestBody: {
            snippet: {
              playlistId,
              resourceId: {
                kind: 'youtube#video',
                videoId,
              },
            },
          },
        });
        addedCount++;
        console.log(`[YouTube API] Successfully added video ${videoId}`);
      } catch (error: any) {
        console.error(`[YouTube API] Failed to add video ${videoId}:`, error.message);
        // Continue with next video
      }
    }

    console.log(`[YouTube API] Total videos added: ${addedCount}`);
    return addedCount;
  }

  /**
   * Get user's email from Google
   */
  async getUserEmail(): Promise<string> {
    const oauth2 = google.oauth2({
      version: 'v2',
      auth: this.oauth2Client,
    });

    const response = await oauth2.userinfo.get();
    return response.data.email || 'Unknown';
  }
}

// Export singleton instance
export const youtubeClient = new YouTubeClient();
