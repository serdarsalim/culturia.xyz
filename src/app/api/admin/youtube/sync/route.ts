import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncAll, syncCountry, syncCategory } from '@/lib/youtube/sync';
import { type VideoCategory } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/youtube/sync
 * Sync videos to YouTube playlists
 *
 * Body params:
 * - type: 'all' | 'country' | 'category'
 * - country_code?: string (required if type is 'country' or 'category')
 * - category?: string (required if type is 'category')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, country_code, category } = body;

    if (!type || !['all', 'country', 'category'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid sync type. Must be: all, country, or category' },
        { status: 400 }
      );
    }

    if ((type === 'country' || type === 'category') && !country_code) {
      return NextResponse.json(
        { error: 'country_code is required for country and category sync' },
        { status: 400 }
      );
    }

    if (type === 'category' && !category) {
      return NextResponse.json(
        { error: 'category is required for category sync' },
        { status: 400 }
      );
    }

    // Get the YouTube user ID (email) from tokens table
    const { data: token, error: tokenError } = await supabase
      .from('youtube_tokens')
      .select('user_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !token) {
      return NextResponse.json(
        { error: 'YouTube not connected. Please authenticate first.' },
        { status: 401 }
      );
    }

    const userId = token.user_id;

    // Execute sync based on type
    let result;
    if (type === 'all') {
      result = await syncAll(userId);
    } else if (type === 'country') {
      result = await syncCountry(userId, country_code);
    } else {
      result = await syncCategory(userId, country_code, category as VideoCategory);
    }

    return NextResponse.json({
      success: result.success,
      playlistsCreated: result.playlistsCreated,
      playlistsUpdated: result.playlistsUpdated,
      videosAdded: result.videosAdded,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error syncing to YouTube:', error);
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error.message,
        success: false,
      },
      { status: 500 }
    );
  }
}
