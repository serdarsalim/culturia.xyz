import { NextResponse } from 'next/server';
import { youtubeClient } from '@/lib/youtube/client';

/**
 * GET /api/auth/youtube
 * Initiates YouTube OAuth flow
 */
export async function GET() {
  try {
    const authUrl = youtubeClient.getAuthUrl();
    return NextResponse.json({ url: authUrl });
  } catch (error: any) {
    console.error('Error generating YouTube auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
