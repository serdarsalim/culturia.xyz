'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'login' | 'signup';
}

export default function AuthModal({ onClose, onSuccess, initialMode = 'signup' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        setMessage('Check your email to verify your account!');
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setMessage('Logged in successfully!');
        setTimeout(() => {
          onSuccess();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: false,
        },
      });

      if (error) throw error;

      // OAuth redirect will happen automatically
      console.log('Google OAuth initiated:', data);
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setError(err.message || 'An error occurred with Google sign-in');
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 70,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        maxWidth: '480px',
        width: '100%',
        padding: '32px',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }} onClick={(e) => e.stopPropagation()}>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            cursor: 'pointer',
            border: 'none',
            backgroundColor: '#f3f4f6',
            borderRadius: '50%',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e5e7eb';
            e.currentTarget.style.color = '#000000';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
            e.currentTarget.style.color = '#6b7280';
          }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Header */}
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#000000',
          marginBottom: '24px',
          letterSpacing: '-0.02em'
        }}>
          {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
        </h2>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 24px',
            fontSize: '15px',
            fontWeight: '600',
            color: '#374151',
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '20px'
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#f9fafb';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#ffffff';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" fillRule="evenodd">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.909-2.259c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
              <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
            </g>
          </svg>
          {loading ? 'Please wait...' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{ width: '100%', borderTop: '1px solid #e5e7eb' }} />
          </div>
          <div style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <span style={{
              backgroundColor: '#ffffff',
              padding: '0 12px',
              fontSize: '13px',
              color: '#6b7280'
            }}>
              or continue with email
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Email */}
          <div>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#f3f4f6',
                color: '#000000',
                outline: 'none'
              }}
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#f3f4f6',
                color: '#000000',
                outline: 'none'
              }}
              placeholder="••••••••"
            />
            {mode === 'signup' && (
              <p style={{ marginTop: '6px', fontSize: '13px', color: '#6b7280' }}>
                At least 6 characters
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '16px',
              backgroundColor: '#fee2e2',
              borderRadius: '8px'
            }}>
              <p style={{ fontSize: '14px', color: '#991b1b' }}>{error}</p>
            </div>
          )}

          {/* Success Message */}
          {message && (
            <div style={{
              padding: '16px',
              backgroundColor: '#d1fae5',
              borderRadius: '8px'
            }}>
              <p style={{ fontSize: '14px', color: '#065f46' }}>{message}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 24px',
              fontSize: '15px',
              fontWeight: '600',
              color: '#ffffff',
              backgroundColor: loading ? '#9ca3af' : '#f97316',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#ea580c';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#f97316';
            }}
          >
            {loading ? 'Please wait...' : mode === 'signup' ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        {/* Toggle Mode */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setError('');
              setMessage('');
            }}
            style={{
              fontSize: '14px',
              color: '#f97316',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: 'transparent',
              textDecoration: 'none',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ea580c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#f97316';
            }}
          >
            {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
          </button>
        </div>

        {mode === 'signup' && (
          <p style={{
            marginTop: '16px',
            fontSize: '13px',
            color: '#9ca3af',
            textAlign: 'center'
          }}>
            By signing up, you agree to our Terms of Service
          </p>
        )}
      </div>
    </div>
  );
}
