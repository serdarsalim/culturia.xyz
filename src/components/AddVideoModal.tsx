'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { VISIBLE_CATEGORIES, CATEGORY_LABELS, type VideoCategory } from '@/types';
import { getCountryName, getCountryFlag } from '@/lib/countries';

interface AddVideoModalProps {
  countryCode: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddVideoModal({ countryCode, onClose, onSuccess }: AddVideoModalProps) {
  const [category, setCategory] = useState<VideoCategory>(VISIBLE_CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);

  function extractYouTubeVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  async function handleSubmit() {
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!youtubeUrl.trim()) {
      setError('YouTube URL is required');
      return;
    }

    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      setError('Invalid YouTube URL. Please use a valid YouTube link.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to submit videos');
        return;
      }

      const { error: insertError } = await supabase
        .from('video_submissions')
        .insert({
          country_code: countryCode,
          category: category,
          youtube_url: youtubeUrl.trim(),
          youtube_video_id: videoId,
          title: title.trim(),
          user_id: user.id,
          user_email: user.email,
          status: 'private',
        });

      if (insertError) throw insertError;

      // Show success message
      setShowSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit video');
      setSubmitting(false);
    }
  }

  function handleAddAnother() {
    setTitle('');
    setYoutubeUrl('');
    setShowSuccess(false);
    setSubmitting(false);
    setError('');
  }

  function handleDone() {
    onSuccess();
    onClose();
  }

  if (showSuccess) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 500,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            padding: '40px 32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            textAlign: 'center'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px', color: '#0f172a' }}>
            Video Submitted!
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px' }}>
            Your video has been submitted for review. You'll be notified once it's approved.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={handleAddAnother}
              style={{
                padding: '12px 24px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Add Another Video
            </button>
            <button
              onClick={handleDone}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px' }}>{getCountryFlag(countryCode)}</span>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
              Add Video
            </h2>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Submit a video for {getCountryName(countryCode)}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#991b1b',
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {/* Category Dropdown */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#334155' }}>
            Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as VideoCategory)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            {VISIBLE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        {/* Title Field */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#334155' }}>
            Video Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a descriptive title"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {/* YouTube URL Field */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#334155' }}>
            YouTube URL *
          </label>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            disabled={submitting}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {/* Submission Guidelines Toggle */}
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => setShowGuidelines(!showGuidelines)}
            style={{
              padding: '12px 16px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>📋 Submission Guidelines</span>
            <span>{showGuidelines ? '−' : '+'}</span>
          </button>

          {showGuidelines && (
            <div style={{
              marginTop: '12px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#475569'
            }}>
              <p style={{ fontWeight: 600, marginBottom: '12px', color: '#0f172a' }}>
                Video Requirements:
              </p>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Music:</strong> Musical performances, songs, or musicians playing—anything from traditional folk to modern genres. Lyrics in the local language are preferred.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Comedy:</strong> Funny content that makes people laugh—stand-up, sketches, or humorous moments. Humor should be delivered in the native language.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Daily Life:</strong> Everyday moments that capture authentic life—market scenes, local customs, daily routines, or cultural practices. Should feature people speaking in their native language.
                </li>
                <li>
                  <strong>Talks:</strong> Speeches, interviews, podcasts, or conversations—anything where people share ideas or stories. Content should be in the native language.
                </li>
              </ul>
              <p style={{ marginTop: '12px', fontWeight: 600, color: '#0f172a' }}>
                General Rules:
              </p>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                <li>Videos must feature native language content</li>
                <li>No music videos without vocals</li>
                <li>Content should be appropriate for all audiences</li>
              </ul>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '12px 24px',
              backgroundColor: submitting ? '#9ca3af' : '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Video'}
          </button>
        </div>
      </div>
    </div>
  );
}
