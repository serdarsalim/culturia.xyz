'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Handle the OAuth callback
    const handleCallback = async () => {
      try {
        // Check if we have a hash fragment with tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          // Set the session using the tokens from the hash
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Error setting session:', error);
            router.push('/?error=auth_failed');
            return;
          }

          console.log('Session set successfully:', data);
          // Redirect to home page
          router.push('/');
        } else {
          // Check for code parameter (PKCE flow)
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');

          if (code) {
            // Exchange code for session
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
              console.error('Error exchanging code:', error);
              router.push('/?error=auth_failed');
              return;
            }

            router.push('/');
          } else {
            // No tokens or code found
            console.error('No authentication data found in callback');
            router.push('/?error=no_auth_data');
          }
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        router.push('/?error=auth_failed');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f3f4f6'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px'
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '12px'
        }}>
          Completing sign in...
        </div>
        <div style={{
          fontSize: '14px',
          color: '#6b7280'
        }}>
          Please wait while we redirect you.
        </div>
      </div>
    </div>
  );
}
