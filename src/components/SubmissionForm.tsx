'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { extractYouTubeVideoId, isValidYouTubeUrl } from '@/lib/youtube';
import { CATEGORY_LABELS, type VideoCategory } from '@/types';

interface SubmissionFormProps {
  countryCode: string;
  onClose: () => void;
  onSuccess: () => void;
  onAuthRequired?: () => void;
}

type FormData = {
  [key in VideoCategory]: {
    url: string;
    title: string;
  };
};

export default function SubmissionForm({ countryCode, onClose, onSuccess, onAuthRequired }: SubmissionFormProps) {
  const [formData, setFormData] = useState<FormData>({
    inspiration: { url: '', title: '' },
    music: { url: '', title: '' },
    comedy: { url: '', title: '' },
    cooking: { url: '', title: '' },
    street_voices: { url: '', title: '' },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);

  function handleUrlChange(category: VideoCategory, value: string) {
    setFormData(prev => ({
      ...prev,
      [category]: { ...prev[category], url: value }
    }));
  }

  function handleTitleChange(category: VideoCategory, value: string) {
    setFormData(prev => ({
      ...prev,
      [category]: { ...prev[category], title: value }
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Check if at least one URL is provided
    const hasAnyUrl = Object.values(formData).some(data => data.url.trim() !== '');
    if (!hasAnyUrl) {
      setError('Please provide at least one YouTube URL');
      return;
    }

    // Validate all provided URLs
    for (const [category, data] of Object.entries(formData)) {
      if (data.url.trim()) {
        if (!isValidYouTubeUrl(data.url)) {
          setError(`Invalid YouTube URL for ${CATEGORY_LABELS[category as VideoCategory]}`);
          return;
        }
      }
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        onAuthRequired?.();
        return;
      }

      // Submit each category that has a URL
      for (const [category, data] of Object.entries(formData)) {
        if (data.url.trim()) {
          const videoId = extractYouTubeVideoId(data.url);
          if (!videoId) continue;

          await supabase
            .from('video_submissions')
            .insert({
              country_code: countryCode,
              category: category as VideoCategory,
              youtube_url: data.url,
              youtube_video_id: videoId,
              title: data.title,
              user_id: user.id,
              user_email: user.email!,
              status: 'pending',
            });
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit videos');
    } finally {
      setLoading(false);
    }
  }

  const categories: VideoCategory[] = ['inspiration', 'music', 'comedy', 'cooking', 'street_voices'];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 60,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        maxWidth: '800px',
        width: '100%',
        padding: '32px',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        maxHeight: '90vh',
        overflowY: 'auto'
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
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <span style={{ fontSize: '32px' }}>{getCountryFlag(countryCode)}</span>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#000000', letterSpacing: '-0.02em' }}>
              {getCountryName(countryCode)}
            </h2>
          </div>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Submit videos for one or more categories
          </p>
        </div>

        {/* Guidelines Toggle Button */}
        <button
          type="button"
          onClick={() => setShowGuidelines(!showGuidelines)}
          style={{
            width: '100%',
            marginBottom: '20px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#eff6ff',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#dbeafe';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#eff6ff';
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e40af' }}>
            📋 Submission Guidelines
          </span>
          <span style={{ fontSize: '12px', color: '#1e40af' }}>
            {showGuidelines ? '▼' : '▶'}
          </span>
        </button>

        {/* Guidelines Content (Collapsible) */}
        {showGuidelines && (
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#eff6ff',
            borderRadius: '10px'
          }}>
            <ul style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.7', paddingLeft: '20px', margin: 0 }}>
              <li>Videos should have <strong>1 million+ views</strong></li>
              <li>Videos should have <strong>English subtitles</strong> available</li>
              <li>Only YouTube links are accepted</li>
              <li>Content should be culturally authentic and appropriate</li>
              <li>You can submit one video per category per country</li>
            </ul>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 48px' }}>

          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '140px 1.5fr 1.5fr',
            gap: '12px',
            padding: '0 4px',
            marginBottom: '8px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Category</div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>YouTube URL</div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Title (Optional)</div>
          </div>

          {/* Category Rows */}
          {categories.map((category) => (
            <div
              key={category}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1.5fr 1.5fr',
                gap: '12px',
                alignItems: 'center'
              }}
            >
              {/* Category Label */}
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                {CATEGORY_LABELS[category]}
              </div>

              {/* YouTube URL */}
              <input
                type="url"
                value={formData[category].url}
                onChange={(e) => handleUrlChange(category, e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#f3f4f6',
                  color: '#000000',
                  outline: 'none'
                }}
              />

              {/* Video Title */}
              <input
                type="text"
                value={formData[category].title}
                onChange={(e) => handleTitleChange(category, e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#f3f4f6',
                  color: '#000000',
                  outline: 'none'
                }}
              />
            </div>
          ))}

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

          {/* Submit Button and Info Text */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <p style={{
              fontSize: '13px',
              color: '#9ca3af',
              lineHeight: '1.5',
              margin: 0
            }}>
              Your submission will be reviewed by our team before appearing on the site
            </p>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px 32px',
                fontSize: '15px',
                fontWeight: '600',
                color: '#ffffff',
                backgroundColor: loading ? '#9ca3af' : '#f97316',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#ea580c';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#f97316';
              }}
            >
              {loading ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
