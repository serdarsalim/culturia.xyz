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
