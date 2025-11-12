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

    const response = await this.youtube.playlists.list({
      part: ['snippet'],
      mine: true,
      maxResults: 50,
    });

    const playlists = response.data.items || [];
    const playlist = playlists.find(p => p.snippet?.title === title);

    return playlist?.id || null;
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(title: string, description: string): Promise<string> {
    if (!this.youtube) throw new Error('YouTube client not initialized');

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

    const playlistId = response.data.id;
    if (!playlistId) {
      throw new Error('Failed to create playlist');
    }

    return playlistId;
  }

  /**
   * Get all video IDs currently in a playlist
   */
  async getPlaylistVideoIds(playlistId: string): Promise<string[]> {
    if (!this.youtube) throw new Error('YouTube client not initialized');

    const videoIds: string[] = [];
    let nextPageToken: string | undefined;

    do {
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

    return videoIds;
  }

  /**
   * Add videos to a playlist (only adds videos that aren't already in the playlist)
   */
  async addVideosToPlaylist(playlistId: string, videoIds: string[]): Promise<number> {
    if (!this.youtube) throw new Error('YouTube client not initialized');

    // Get existing videos in playlist
    const existingVideoIds = await this.getPlaylistVideoIds(playlistId);

    // Filter out videos that are already in the playlist
    const newVideoIds = videoIds.filter(id => !existingVideoIds.includes(id));

    if (newVideoIds.length === 0) {
      return 0; // No new videos to add
    }

    // Add each video to the playlist
    let addedCount = 0;
    for (const videoId of newVideoIds) {
      try {
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
      } catch (error) {
        console.error(`Failed to add video ${videoId} to playlist:`, error);
        // Continue with next video
      }
    }

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
