import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/auth/youtube/status
 * Check if YouTube is connected and return user email
 */
export async function GET() {
  try {
    // Check if we have any tokens in the database
    const { data: tokens, error } = await supabase
      .from('youtube_tokens')
      .select('user_id, expires_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !tokens) {
      return NextResponse.json({
        connected: false,
        email: null,
      });
    }

    // Check if token is still valid
    const isExpired = tokens.expires_at < Date.now();

    return NextResponse.json({
      connected: true,
      email: tokens.user_id,
      tokenExpired: isExpired,
    });
  } catch (error: any) {
    console.error('Error checking YouTube status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
