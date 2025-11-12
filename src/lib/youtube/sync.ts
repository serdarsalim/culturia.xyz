import { YouTubeClient } from './client';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, type VideoCategory } from '@/types';

export interface SyncResult {
  success: boolean;
  playlistsCreated: number;
  playlistsUpdated: number;
  videosAdded: number;
  errors: string[];
}

export interface PlaylistInfo {
  country_code: string;
  category: VideoCategory;
  videoIds: string[];
}

/**
 * Generate playlist name in format: "CountryName CategoryLabel Flag | Culturia"
 * Example: "Palestine Music 🇵🇸 | Culturia"
 */
function generatePlaylistName(countryCode: string, category: VideoCategory): string {
  const countryName = getCountryName(countryCode);
  const categoryLabel = CATEGORY_LABELS[category];
  const flag = getCountryFlag(countryCode);

  return `${countryName} ${categoryLabel} ${flag} | Culturia`;
}

/**
 * Generate playlist description
 */
function generatePlaylistDescription(countryCode: string, category: VideoCategory): string {
  const countryName = getCountryName(countryCode);
  const categoryLabel = CATEGORY_LABELS[category].toLowerCase();

  return `Authentic ${categoryLabel} from ${countryName}, curated by Culturia. Discover more cultural content at https://culturia.xyz`;
}

/**
 * Fetch videos grouped by country and category
 */
async function fetchVideosGrouped(
  countryCode?: string,
  category?: VideoCategory
): Promise<PlaylistInfo[]> {
  let query = supabase
    .from('video_submissions')
    .select('country_code, category, youtube_video_id')
    .eq('status', 'approved')
    .eq('youtube_sync_enabled', true);

  if (countryCode) {
    query = query.eq('country_code', countryCode);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data: videos, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch videos: ${error.message}`);
  }

  // Group videos by country + category
  const grouped = new Map<string, PlaylistInfo>();

  for (const video of videos || []) {
    const key = `${video.country_code}-${video.category}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        country_code: video.country_code,
        category: video.category as VideoCategory,
        videoIds: [],
      });
    }

    grouped.get(key)!.videoIds.push(video.youtube_video_id);
  }

  return Array.from(grouped.values());
}

/**
 * Sync a single playlist (country + category combination)
 */
async function syncPlaylist(
  youtube: YouTubeClient,
  playlistInfo: PlaylistInfo
): Promise<{ created: boolean; videosAdded: number; error?: string }> {
  const { country_code, category, videoIds } = playlistInfo;

  console.log(`\n=== SYNC PLAYLIST: ${country_code} - ${category} ===`);
  console.log(`Videos to sync: ${videoIds.length}`);

  if (videoIds.length === 0) {
    return { created: false, videosAdded: 0, error: 'No videos to sync' };
  }

  try {
    const playlistName = generatePlaylistName(country_code, category);
    const playlistDescription = generatePlaylistDescription(country_code, category);
    console.log(`Playlist name: "${playlistName}"`);

    // Check if we have this playlist cached in database
    console.log('Checking cache for existing playlist...');
    const { data: cachedPlaylist } = await supabase
      .from('youtube_playlists')
      .select('youtube_playlist_id')
      .eq('country_code', country_code)
      .eq('category', category)
      .single();

    let playlistId: string;
    let wasCreated = false;

    if (cachedPlaylist) {
      console.log(`Found cached playlist: ${cachedPlaylist.youtube_playlist_id}`);
      // Use cached playlist ID, but verify it still exists
      try {
        playlistId = cachedPlaylist.youtube_playlist_id;
        console.log('Verifying cached playlist still exists on YouTube...');
        // Try to get playlist videos to verify it exists
        await youtube.getPlaylistVideoIds(playlistId);
        console.log('Cached playlist verified successfully');
      } catch (error: any) {
        // Cached playlist doesn't exist anymore, remove from cache and recreate
        console.log(`Cached playlist ${playlistId} not found on YouTube, removing from cache`);
        await supabase
          .from('youtube_playlists')
          .delete()
          .eq('country_code', country_code)
          .eq('category', category);

        console.log('Creating new playlist to replace deleted one...');
        // Create new playlist
        playlistId = await youtube.createPlaylist(playlistName, playlistDescription);
        wasCreated = true;

        // Cache it
        await supabase.from('youtube_playlists').insert({
          country_code,
          category,
          youtube_playlist_id: playlistId,
          playlist_name: playlistName,
          playlist_url: `https://www.youtube.com/playlist?list=${playlistId}`,
        });
      }
    } else {
      console.log('No cached playlist found, searching YouTube...');
      // Search for playlist on YouTube
      const existingPlaylistId = await youtube.searchPlaylist(playlistName);

      if (existingPlaylistId) {
        console.log(`Found existing playlist on YouTube: ${existingPlaylistId}`);
        playlistId = existingPlaylistId;

        // Cache it for future use
        await supabase.from('youtube_playlists').insert({
          country_code,
          category,
          youtube_playlist_id: playlistId,
          playlist_name: playlistName,
          playlist_url: `https://www.youtube.com/playlist?list=${playlistId}`,
        });
      } else {
        console.log('Playlist not found on YouTube, creating new one...');
        // Create new playlist
        playlistId = await youtube.createPlaylist(playlistName, playlistDescription);
        wasCreated = true;

        // Cache it
        await supabase.from('youtube_playlists').insert({
          country_code,
          category,
          youtube_playlist_id: playlistId,
          playlist_name: playlistName,
          playlist_url: `https://www.youtube.com/playlist?list=${playlistId}`,
        });
      }
    }

    // Add videos to playlist
    console.log(`Adding videos to playlist ${playlistId}...`);
    const videosAdded = await youtube.addVideosToPlaylist(playlistId, videoIds);

    // Update cache timestamp
    await supabase
      .from('youtube_playlists')
      .update({ updated_at: new Date().toISOString() })
      .eq('country_code', country_code)
      .eq('category', category);

    console.log(`=== SYNC COMPLETE: ${videosAdded} videos added ===\n`);
    return { created: wasCreated, videosAdded };
  } catch (error: any) {
    console.error(`\n!!! ERROR syncing playlist for ${country_code} - ${category}:`);
    console.error(`Error type: ${error.constructor.name}`);
    console.error(`Error message: ${error.message}`);
    console.error(`Full error:`, error);
    console.error(`===\n`);
    return {
      created: false,
      videosAdded: 0,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Sync all playlists
 */
export async function syncAll(userId: string): Promise<SyncResult> {
  const youtube = new YouTubeClient();
  await youtube.initialize(userId);

  const playlists = await fetchVideosGrouped();

  let playlistsCreated = 0;
  let playlistsUpdated = 0;
  let videosAdded = 0;
  const errors: string[] = [];

  for (const playlist of playlists) {
    const result = await syncPlaylist(youtube, playlist);

    if (result.error) {
      errors.push(`${playlist.country_code}-${playlist.category}: ${result.error}`);
    } else {
      if (result.created) {
        playlistsCreated++;
      } else if (result.videosAdded > 0) {
        playlistsUpdated++;
      }
      videosAdded += result.videosAdded;
    }
  }

  // Log sync to database
  await supabase.from('youtube_sync_logs').insert({
    sync_type: 'all',
    videos_synced: videosAdded,
    playlists_created: playlistsCreated,
    playlists_updated: playlistsUpdated,
    status: errors.length === 0 ? 'success' : errors.length < playlists.length ? 'partial' : 'failed',
    error_message: errors.length > 0 ? errors.join('; ') : null,
  });

  return {
    success: errors.length === 0,
    playlistsCreated,
    playlistsUpdated,
    videosAdded,
    errors,
  };
}

/**
 * Sync all categories for a specific country
 */
export async function syncCountry(userId: string, countryCode: string): Promise<SyncResult> {
  const youtube = new YouTubeClient();
  await youtube.initialize(userId);

  const playlists = await fetchVideosGrouped(countryCode);

  let playlistsCreated = 0;
  let playlistsUpdated = 0;
  let videosAdded = 0;
  const errors: string[] = [];

  for (const playlist of playlists) {
    const result = await syncPlaylist(youtube, playlist);

    if (result.error) {
      errors.push(`${playlist.category}: ${result.error}`);
    } else {
      if (result.created) {
        playlistsCreated++;
      } else if (result.videosAdded > 0) {
        playlistsUpdated++;
      }
      videosAdded += result.videosAdded;
    }
  }

  // Log sync to database
  await supabase.from('youtube_sync_logs').insert({
    sync_type: 'country',
    country_code: countryCode,
    videos_synced: videosAdded,
    playlists_created: playlistsCreated,
    playlists_updated: playlistsUpdated,
    status: errors.length === 0 ? 'success' : errors.length < playlists.length ? 'partial' : 'failed',
    error_message: errors.length > 0 ? errors.join('; ') : null,
  });

  return {
    success: errors.length === 0,
    playlistsCreated,
    playlistsUpdated,
    videosAdded,
    errors,
  };
}

/**
 * Sync a specific category for a specific country
 */
export async function syncCategory(
  userId: string,
  countryCode: string,
  category: VideoCategory
): Promise<SyncResult> {
  const youtube = new YouTubeClient();
  await youtube.initialize(userId);

  const playlists = await fetchVideosGrouped(countryCode, category);

  let playlistsCreated = 0;
  let playlistsUpdated = 0;
  let videosAdded = 0;
  const errors: string[] = [];

  for (const playlist of playlists) {
    const result = await syncPlaylist(youtube, playlist);

    if (result.error) {
      errors.push(result.error);
    } else {
      if (result.created) {
        playlistsCreated++;
      } else if (result.videosAdded > 0) {
        playlistsUpdated++;
      }
      videosAdded += result.videosAdded;
    }
  }

  // Log sync to database
  await supabase.from('youtube_sync_logs').insert({
    sync_type: 'category',
    country_code: countryCode,
    category,
    videos_synced: videosAdded,
    playlists_created: playlistsCreated,
    playlists_updated: playlistsUpdated,
    status: errors.length === 0 ? 'success' : 'failed',
    error_message: errors.length > 0 ? errors.join('; ') : null,
  });

  return {
    success: errors.length === 0,
    playlistsCreated,
    playlistsUpdated,
    videosAdded,
    errors,
  };
}
