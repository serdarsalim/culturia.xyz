import { NextRequest, NextResponse } from 'next/server';
import { youtubeClient } from '@/lib/youtube/client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/auth/youtube/callback
 * Handles OAuth callback from Google
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL('/admin/youtube?error=auth_failed', request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/admin/youtube?error=no_code', request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await youtubeClient.getTokensFromCode(code);

    // Get user email
    const tempClient = new (await import('@/lib/youtube/client')).YouTubeClient();
    tempClient['oauth2Client'].setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    const email = await tempClient.getUserEmail();

    // Store tokens in database (use email as user_id for simplicity)
    const { error: dbError } = await supabase
      .from('youtube_tokens')
      .upsert({
        user_id: email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      console.error('Error storing tokens:', dbError);
      return NextResponse.redirect(
        new URL('/admin/youtube?error=db_error', request.url)
      );
    }

    // Redirect back to YouTube admin page with success
    return NextResponse.redirect(
      new URL('/admin/youtube?success=connected', request.url)
    );
  } catch (error: any) {
    console.error('Error in YouTube OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/admin/youtube?error=callback_failed', request.url)
    );
  }
}
