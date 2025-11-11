'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { extractYouTubeVideoId, isValidYouTubeUrl } from '@/lib/youtube';
import { CATEGORY_LABELS, VISIBLE_CATEGORIES, type VideoCategory } from '@/types';

interface SubmissionFormProps {
  countryCode: string;
  onClose: () => void;
  onSuccess: () => void;
  onAuthRequired?: () => void;
  onChange?: () => void;
}

type SubmissionStatus = 'pending' | 'approved' | 'rejected' | null;

type FormData = {
  [key in VideoCategory]: {
    url: string;
    title: string;
    status: SubmissionStatus;
    originalUrl: string; // Track original URL to detect changes
    id: string | null;
  };
};

export default function SubmissionForm({ countryCode, onClose, onSuccess, onAuthRequired }: SubmissionFormProps) {
  const [formData, setFormData] = useState<FormData>({
    inspiration: { url: '', title: '', status: null, originalUrl: '', id: null },
    music: { url: '', title: '', status: null, originalUrl: '', id: null },
    comedy: { url: '', title: '', status: null, originalUrl: '', id: null },
    cooking: { url: '', title: '', status: null, originalUrl: '', id: null },
    street_voices: { url: '', title: '', status: null, originalUrl: '', id: null },
  });
  const [loading, setLoading] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [error, setError] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);
const [isMobile, setIsMobile] = useState(false);
const [deletingCategory, setDeletingCategory] = useState<VideoCategory | null>(null);
const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch existing submissions for this country
  useEffect(() => {
    async function fetchExistingSubmissions() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error('Error getting user:', userError);
          setLoadingSubmissions(false);
          return;
        }

        if (!user) {
          console.log('No user logged in');
          setLoadingSubmissions(false);
          return;
        }

        console.log('Fetching submissions for:', { userId: user.id, countryCode });

        const { data: submissions, error } = await supabase
          .from('video_submissions')
          .select('id, category, youtube_url, title, status')
          .eq('country_code', countryCode)
          .eq('user_id', user.id);

        if (error) {
          console.warn('Could not fetch submissions (this is normal if you have no submissions yet):', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          // Continue with empty form - this is not a critical error
          setLoadingSubmissions(false);
          return;
        }

        console.log('Successfully fetched submissions:', submissions);

        if (submissions && submissions.length > 0) {
          const newFormData: FormData = {
            inspiration: { url: '', title: '', status: null, originalUrl: '', id: null },
            music: { url: '', title: '', status: null, originalUrl: '', id: null },
            comedy: { url: '', title: '', status: null, originalUrl: '', id: null },
            cooking: { url: '', title: '', status: null, originalUrl: '', id: null },
            street_voices: { url: '', title: '', status: null, originalUrl: '', id: null },
          };

          submissions.forEach((submission) => {
            const category = submission.category as VideoCategory;
            newFormData[category] = {
              url: submission.youtube_url,
              title: submission.title || '',
              status: submission.status as SubmissionStatus,
              originalUrl: submission.youtube_url,
              id: submission.id,
            };
          });
          setFormData(newFormData);
        }
      } catch (err: any) {
        // Only log if there's actual error info
        if (err && Object.keys(err).length > 0) {
          console.error('Error fetching submissions:', {
            message: err.message || 'Unknown error',
            error: err
          });
        }
      } finally {
        setLoadingSubmissions(false);
      }
    }

    fetchExistingSubmissions();
  }, [countryCode]);

  function handleUrlChange(category: VideoCategory, value: string) {
    setFormData(prev => {
      const currentData = prev[category];
      const urlChanged = value !== currentData.originalUrl;

      return {
        ...prev,
        [category]: {
          ...currentData,
          url: value,
          // Reset status to pending if URL changed from original
          status: urlChanged && currentData.originalUrl ? 'pending' : currentData.status
        }
      };
    });
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

  const hasAnyUrl = Object.values(formData).some(data => data.url.trim() !== '');

  if (hasAnyUrl) {
    for (const [category, data] of Object.entries(formData)) {
      if (data.url.trim() && !isValidYouTubeUrl(data.url)) {
        setError(`Invalid YouTube URL for ${CATEGORY_LABELS[category as VideoCategory]}`);
        return;
      }
    }

    for (const [category, data] of Object.entries(formData)) {
      if (data.url.trim() && !data.title.trim()) {
        setError(`Please provide a title for ${CATEGORY_LABELS[category as VideoCategory]}`);
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

      // Determine if current user is an admin; if so, auto-approve
      let isAdmin = false;
      try {
        const { data: adminRow, error: adminErr } = await supabase
          .from('admin_users')
          .select('id')
          .eq('id', user.id)
          .single();
        isAdmin = !!adminRow && !adminErr;
      } catch (_) {
        // If we can't read admin_users (due to RLS), treat as non-admin
        isAdmin = false;
      }

      let changesMade = false;

      for (const [category, data] of Object.entries(formData)) {
        const trimmedUrl = data.url.trim();
        const trimmedTitle = data.title.trim();

        if (trimmedUrl) {
          const videoId = extractYouTubeVideoId(trimmedUrl);
          if (!videoId) continue;

          const { error } = await supabase
            .from('video_submissions')
            .upsert({
              id: data.id || undefined,
              country_code: countryCode,
              category: category as VideoCategory,
              youtube_url: trimmedUrl,
              youtube_video_id: videoId,
              title: trimmedTitle,
              user_id: user.id,
              user_email: user.email!,
              status: isAdmin ? 'approved' : 'pending',
            }, {
              onConflict: 'user_id,country_code,category'
            });

          if (error) throw error;
          changesMade = true;
        } else if (data.originalUrl) {
          const { error } = await supabase
            .from('video_submissions')
            .delete()
            .eq('user_id', user.id)
            .eq('country_code', countryCode)
            .eq('category', category as VideoCategory);

          if (error) throw error;
          changesMade = true;
        }
      }

      if (!changesMade) {
        setError('No changes to submit');
        setLoading(false);
        return;
      }

      onSuccess();
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit videos');
    } finally {
      setLoading(false);
    }
  }

  const categories: VideoCategory[] = VISIBLE_CATEGORIES;

  async function handleDeleteCategory(category: VideoCategory) {
    setError('');
    const current = formData[category];
    if (!current.originalUrl && !current.url) return;

    const submissionId = current.id;

    try {
      setDeletingCategory(category);
      console.log('Attempting to delete submission', { category, submissionId, countryCode });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        onAuthRequired?.();
        return;
      }

      let deleteQuery = supabase
        .from('video_submissions')
        .delete()
        .eq('user_id', user.id);

      if (submissionId) {
        deleteQuery = deleteQuery.eq('id', submissionId);
      } else {
        deleteQuery = deleteQuery
          .eq('country_code', countryCode)
          .eq('category', category);
      }

      const { error } = await deleteQuery;

      if (error) throw error;

      setFormData(prev => ({
        ...prev,
        [category]: {
          url: '',
          title: '',
          status: null,
          originalUrl: '',
          id: null,
        }
      }));
      console.log('Successfully deleted submission', { category, submissionId });
      const message = `${CATEGORY_LABELS[category]} video removed`;
      setDeleteToast(message);
      setTimeout(() => setDeleteToast(null), 2000);
    } catch (err: any) {
      console.error('Delete submission error:', err);
      setError(err.message || 'Failed to delete video');
    } finally {
      setDeletingCategory(null);
    }
  }

  function renderStatus(status: SubmissionStatus) {
    if (!status) return null;

    const statusConfig = {
      pending: { text: 'Pending', bg: '#fef3c7', color: '#92400e' },
      approved: { text: 'Approved', bg: '#d1fae5', color: '#065f46' },
      rejected: { text: 'Rejected', bg: '#fee2e2', color: '#991b1b' }
    };

    const config = statusConfig[status];

    return (
      <div style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: '6px',
        backgroundColor: config.bg,
        color: config.color,
        fontSize: '12px',
        fontWeight: '600',
        textAlign: 'center'
      }}>
        {config.text}
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 140,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '16px' : '24px'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: isMobile ? '12px' : '16px',
        maxWidth: isMobile ? '100%' : '920px',
        width: '100%',
        padding: isMobile ? '20px' : '32px',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }} onClick={(e) => e.stopPropagation()}>
        {deleteToast && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            backgroundColor: '#065f46',
            color: '#ffffff',
            padding: '10px 16px',
            borderRadius: '999px',
            fontSize: '13px',
            boxShadow: '0 10px 20px rgba(0,0,0,0.15)'
          }}>
            {deleteToast}
          </div>
        )}

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
        <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', marginBottom: '6px' }}>
            <span style={{ fontSize: isMobile ? '24px' : '32px' }}>{getCountryFlag(countryCode)}</span>
            <h2 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '700', color: '#000000', letterSpacing: '-0.02em' }}>
              {getCountryName(countryCode)}
            </h2>
          </div>
          <p style={{ fontSize: isMobile ? '13px' : '14px', color: '#6b7280' }}>
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
            <div style={{ marginTop: '16px', fontSize: '13px', color: '#1e40af' }}>
              <p style={{ fontWeight: 600, marginBottom: '8px' }}>What we look for in each category:</p>
              <ul style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.7' }}>
                <li>
                  <strong>Talks:</strong> People speaking in their native language—interviews, speeches, discussions, presentations, or conversations. Must include authentic dialogue.
                </li>
                <li>
                  <strong>Music:</strong> Musical performances, songs, or musicians playing—anything from traditional folk to modern genres. Lyrics in the local language are preferred.
                </li>
                <li>
                  <strong>Comedy:</strong> Funny content that makes people laugh—stand-up, sketches, or humorous moments. Humor should be delivered in the native language.
                </li>
                <li>
                  <strong>Food:</strong> Cooking, eating, or food culture—street food, home cooking, or culinary rituals. Must showcase authentic local cuisine with narration or dialogue.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loadingSubmissions ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: '15px', color: '#6b7280' }}>Loading your submissions...</p>
          </div>
        ) : (
        <>
        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px', padding: isMobile ? '0' : '0 48px' }}>

          {/* Table Header - Desktop only */}
          {!isMobile && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '140px 1.5fr 1.5fr 100px',
              gap: '12px',
              padding: '0 4px',
              marginBottom: '8px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Category</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Title</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>YouTube URL</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Status</div>
            </div>
          )}

          {/* Category Rows */}
          {categories.map((category) => (
            isMobile ? (
              // Mobile: Stack vertically in card
              <div
                key={category}
                style={{
                  backgroundColor: '#f9fafb',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}
              >
                {/* Category Label with Status */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                  gap: '8px'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    {CATEGORY_LABELS[category]}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {formData[category].originalUrl && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (deletingCategory === category || loading) return;
                          handleDeleteCategory(category);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (deletingCategory === category || loading) return;
                            handleDeleteCategory(category);
                          }
                        }}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '999px',
                          border: 'none',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '14px',
                          cursor: deletingCategory === category || loading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </span>
                    )}
                    {renderStatus(formData[category].status)}
                  </div>
                </div>

                {/* Video Title (required if URL provided) */}
                <input
                  type="text"
                  placeholder="Title"
                  value={formData[category].title}
                  onChange={(e) => handleTitleChange(category, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    outline: 'none',
                    marginBottom: '8px'
                  }}
                />

                {/* YouTube URL */}
                <input
                  type="url"
                  placeholder="YouTube URL"
                  value={formData[category].url}
                  onChange={(e) => handleUrlChange(category, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    outline: 'none'
                  }}
                />
              </div>
            ) : (
              // Desktop: Grid layout
              <div
                key={category}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1.5fr 1.5fr 100px',
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

                {/* Video Title (required if URL provided) */}
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

                {/* Status */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                    {formData[category].originalUrl && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (deletingCategory === category || loading) return;
                          handleDeleteCategory(category);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (deletingCategory === category || loading) return;
                            handleDeleteCategory(category);
                          }
                        }}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '999px',
                          border: 'none',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '14px',
                          cursor: deletingCategory === category || loading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </span>
                    )}
                  {renderStatus(formData[category].status)}
                </div>
              </div>
            )
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
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column-reverse' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            marginTop: '8px',
            gap: isMobile ? '12px' : '0'
          }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: isMobile ? '12px 24px' : '14px 32px',
                fontSize: '15px',
                fontWeight: '600',
                color: '#ffffff',
                backgroundColor: loading ? '#9ca3af' : '#f97316',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0,
                width: isMobile ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#ea580c';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#f97316';
              }}
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
}
