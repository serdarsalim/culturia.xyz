'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'login' | 'signup';
}

export default function AuthModal({ onClose, onSuccess, initialMode = 'signup' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showResetView, setShowResetView] = useState(false);

  // Google OAuth linking state
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'login' && showResetView) {
      return; // handled via reset buttons
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signup' && password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        setMessage('Account created successfully!');
        setTimeout(() => {
          onSuccess();
        }, 1000);
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

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      setError('No credential received from Google');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Handle different response actions
      if (data.action === 'link_required') {
        // Email exists with password - need to link
        setLinkingAccount(true);
        setPendingGoogleCredential(credentialResponse.credential);
        setLinkEmail(data.email);
        setMessage(data.message);
      } else if (data.action === 'signin' || data.action === 'signup_and_signin' || data.action === 'linked_and_signin') {
        // Sign in with the credentials
        if (data.action === 'signup_and_signin' || data.action === 'signin') {
          // New user created via Google OR existing Google user - sign in with temp password
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.tempPassword,
          });

          if (signInError) throw signInError;
        } else if (data.action === 'linked_and_signin') {
          // Just linked account - use the password they provided
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: linkPassword,
          });

          if (signInError) {
            throw new Error('Authentication succeeded but session creation failed');
          }
        }

        setMessage(data.message || 'Logged in successfully!');
        setTimeout(() => {
          onSuccess();
        }, 1000);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkAccount() {
    if (!linkPassword) {
      setError('Please enter your password');
      return;
    }

    if (!pendingGoogleCredential) {
      setError('No pending Google credential');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: pendingGoogleCredential,
          password: linkPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link account');
      }

      if (data.action === 'link_failed') {
        setError(data.error);
        return;
      }

      // Link successful - sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: linkEmail,
        password: linkPassword,
      });

      if (signInError) throw signInError;

      setMessage('Account linked successfully!');
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      console.error('Account linking error:', err);
      setError(err.message || 'Failed to link account');
    } finally {
      setLoading(false);
    }
  }

  function cancelLinking() {
    setLinkingAccount(false);
    setPendingGoogleCredential(null);
    setLinkEmail('');
    setLinkPassword('');
    setError('');
    setMessage('');
  }

  async function handlePasswordResetRequest() {
    if (!email) {
      setError('Enter your email first so we can send the reset link.');
      return;
    }

    setResetLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });

      if (error) throw error;

      setMessage('Password reset link sent. Check your email.');
    } catch (err: any) {
      setError(err.message || 'Unable to send reset email right now');
    } finally {
      setResetLoading(false);
    }
  }

  // If in linking mode, show linking UI
  if (linkingAccount) {
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
      }} onClick={cancelLinking}>
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
            onClick={cancelLinking}
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
          >
            ✕
          </button>

          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#000000',
            marginBottom: '16px',
          }}>
            Link Google Account
          </h2>

          <p style={{
            fontSize: '15px',
            color: '#6b7280',
            marginBottom: '24px',
            lineHeight: '1.6'
          }}>
            An account with <strong>{linkEmail}</strong> already exists. Enter your password to link your Google account.
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={linkPassword}
              onChange={(e) => setLinkPassword(e.target.value)}
              placeholder="Enter your password"
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLinkAccount();
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '16px',
              backgroundColor: '#fee2e2',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p style={{ fontSize: '14px', color: '#991b1b' }}>{error}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={cancelLinking}
              style={{
                flex: 1,
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: '600',
                color: '#6b7280',
                backgroundColor: '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleLinkAccount}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: '600',
                color: '#ffffff',
                backgroundColor: loading ? '#9ca3af' : '#f97316',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Linking...' : 'Link Account'}
            </button>
          </div>
        </div>
      </div>
    );
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
        <div style={{ marginBottom: '20px' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setError('Google sign-in failed. Please try again.');
            }}
            useOneTap={false}
            text={mode === 'signup' ? 'signup_with' : 'signin_with'}
            theme="outline"
            size="large"
            width="100%"
          />
        </div>

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
          {!(mode === 'login' && showResetView) && (
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
          )}

          {/* Password / Reset Email */}
          <div>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              {mode === 'login' && showResetView ? 'Email address' : 'Password'}
            </label>
            {mode === 'login' && showResetView ? (
              <input
                id="reset-email"
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
            ) : (
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
            )}
            {mode === 'signup' && (
              <p style={{ marginTop: '6px', fontSize: '13px', color: '#6b7280' }}>
                At least 6 characters
              </p>
            )}
            {mode === 'login' && !showResetView && (
              <div style={{ marginTop: '8px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetView(true);
                    setError('');
                    setMessage('');
                  }}
                  style={{
                    fontSize: '13px',
                    color: '#f97316',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={mode === 'signup'}
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
                placeholder="Re-enter your password"
              />
            </div>
          )}

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

          {/* Submit / Reset Buttons */}
            {mode === 'login' && showResetView ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                disabled={resetLoading}
                onClick={handlePasswordResetRequest}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#ffffff',
                  backgroundColor: resetLoading ? '#9ca3af' : '#f97316',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: resetLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {resetLoading ? 'Sending reset email…' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetView(false);
                  setError('');
                  setMessage('');
                }}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#475569',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Back to login
              </button>
            </div>
          ) : (
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
          )}
        </form>

        {/* Toggle Mode */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setError('');
              setMessage('');
              setConfirmPassword('');
              setShowResetView(false);
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
