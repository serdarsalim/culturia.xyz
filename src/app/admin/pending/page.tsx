'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, type VideoSubmission, type VideoCategory } from '@/types';
import { getYouTubeThumbnail, getYouTubeWatchUrl } from '@/lib/youtube';
import AdminLayout from '@/components/AdminLayout';
import YouTube from 'react-youtube';

export default function PendingSubmissions() {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [previewingVideo, setPreviewingVideo] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  async function fetchSubmissions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('video_submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false});

      if (error) throw error;

      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    try {
      const { error } = await supabase
        .from('video_submissions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      showToast(`Submission ${status} successfully!`, 'success');
      fetchSubmissions();
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const categoryIcons: Record<VideoCategory, string> = {
    inspiration: '✨',
    music: '🎵',
    comedy: '😂',
    cooking: '🍳',
    street_voices: '🗣️',
  };

  return (
    <AdminLayout>
      <div style={{ padding: '32px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
            Pending Submissions
          </h1>
          <p style={{ color: '#a1a1aa' }}>Review and moderate pending video submissions</p>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 50,
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            background: toast.type === 'success' ? '#16a34a' : '#dc2626',
            color: 'white',
            fontWeight: '500',
          }}>
            {toast.message}
          </div>
        )}

        {/* Submissions List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '2px solid #f59e0b',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              margin: '0 auto',
              animation: 'spin 1s linear infinite',
            }}></div>
            <p style={{ marginTop: '16px', color: '#a1a1aa' }}>Loading submissions...</p>
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : submissions.length === 0 ? (
          <div style={{
            background: '#18181b',
            borderRadius: '12px',
            padding: '48px',
            textAlign: 'center',
            border: '1px solid #27272a',
          }}>
            <span style={{ fontSize: '60px', display: 'block', marginBottom: '16px' }}>✅</span>
            <p style={{ fontSize: '20px', color: '#a1a1aa' }}>No pending submissions!</p>
            <p style={{ color: '#71717a', marginTop: '8px' }}>All caught up</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {submissions.map((submission) => (
              <div key={submission.id} style={{
                background: '#18181b',
                borderRadius: '12px',
                border: '1px solid #27272a',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    {/* Thumbnail */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                      <img
                        src={getYouTubeThumbnail(submission.youtube_video_id)}
                        alt="Video thumbnail"
                        style={{
                          width: '192px',
                          height: '108px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                        }}
                        onClick={() => setPreviewingVideo(
                          previewingVideo === submission.id ? null : submission.id
                        )}
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                      />
                      <button
                        onClick={() => setPreviewingVideo(
                          previewingVideo === submission.id ? null : submission.id
                        )}
                        style={{
                          width: '192px',
                          marginTop: '8px',
                          padding: '8px 12px',
                          background: '#27272a',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#3f3f46'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#27272a'}
                      >
                        {previewingVideo === submission.id ? '🔼 Hide Preview' : '👁️ Preview'}
                      </button>
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '16px',
                      }}>
                        <div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '12px',
                          }}>
                            <span style={{ fontSize: '28px' }}>{getCountryFlag(submission.country_code)}</span>
                            <span style={{ fontWeight: '600', fontSize: '20px', color: 'white' }}>
                              {getCountryName(submission.country_code)}
                            </span>
                            <span style={{ color: '#52525b' }}>•</span>
                            <span style={{ fontSize: '24px' }}>{categoryIcons[submission.category as VideoCategory]}</span>
                            <span style={{ color: '#d4d4d8', fontWeight: '500' }}>
                              {CATEGORY_LABELS[submission.category as VideoCategory]}
                            </span>
                          </div>

                          {submission.title && (
                            <p style={{ color: 'white', fontSize: '18px', marginBottom: '12px' }}>
                              {submission.title}
                            </p>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <p style={{ fontSize: '14px', color: '#a1a1aa' }}>
                              <span style={{ color: '#71717a' }}>Submitted by:</span> {submission.user_email}
                            </p>
                            <p style={{ fontSize: '14px', color: '#a1a1aa' }}>
                              <span style={{ color: '#71717a' }}>Date:</span>{' '}
                              {new Date(submission.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span style={{
                          padding: '8px 16px',
                          background: 'rgba(234, 179, 8, 0.2)',
                          border: '1px solid #eab308',
                          color: '#eab308',
                          fontSize: '14px',
                          fontWeight: '600',
                          borderRadius: '8px',
                        }}>
                          ⏳ PENDING
                        </span>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
                        <a
                          href={getYouTubeWatchUrl(submission.youtube_video_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '10px 20px',
                            background: '#27272a',
                            color: 'white',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            textDecoration: 'none',
                            transition: 'background 0.2s',
                            display: 'inline-block',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#3f3f46'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#27272a'}
                        >
                          🔗 YouTube
                        </a>

                        <button
                          onClick={() => updateStatus(submission.id, 'approved')}
                          style={{
                            padding: '10px 20px',
                            background: '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            boxShadow: '0 10px 15px -3px rgba(22, 163, 74, 0.2)',
                            transition: 'background 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#15803d'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#16a34a'}
                        >
                          ✅ Approve
                        </button>

                        <button
                          onClick={() => updateStatus(submission.id, 'rejected')}
                          style={{
                            padding: '10px 20px',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            boxShadow: '0 10px 15px -3px rgba(220, 38, 38, 0.2)',
                            transition: 'background 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#b91c1c'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#dc2626'}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Video Preview */}
                  {previewingVideo === submission.id && (
                    <div style={{
                      marginTop: '24px',
                      paddingTop: '24px',
                      borderTop: '1px solid #27272a',
                    }}>
                      <div style={{
                        aspectRatio: '16/9',
                        background: 'black',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}>
                        <YouTube
                          videoId={submission.youtube_video_id}
                          opts={{
                            width: '100%',
                            height: '100%',
                            playerVars: {
                              autoplay: 0,
                            },
                          }}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
