'use client';

import { useEffect, useState, useRef } from 'react';
import YouTube, { YouTubePlayer, YouTubeEvent } from 'react-youtube';
import { supabase } from '@/lib/supabase/client';
import { type VideoSubmission, type VideoCategory, CATEGORY_LABELS } from '@/types';
import { getCountryName, getCountryFlag } from '@/lib/countries';

interface VideoPlayerProps {
  video: VideoSubmission;
  category: VideoCategory;
  onClose: () => void;
  onNext: () => void;
}

export default function VideoPlayer({ video, category, onClose, onNext }: VideoPlayerProps) {
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState<'broken' | 'wrong_category' | 'inappropriate' | 'other'>('broken');
  const [flagNote, setFlagNote] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', description: '', type: 'success' as 'success' | 'error' });
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);

  // Check if user has already flagged this video
  useEffect(() => {
    async function checkFlagged() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('video_flags')
        .select('id')
        .eq('submission_id', video.id)
        .eq('user_id', user.id)
        .single();

      setFlagged(!!data);
    }

    checkFlagged();
  }, [video.id]);

  // Check if user has favorited this video
  useEffect(() => {
    async function checkFavorited() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('submission_id', video.id)
        .eq('user_id', user.id)
        .single();

      setIsFavorited(!!data);
    }

    checkFavorited();
  }, [video.id]);

  async function handleFlagSubmit() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setToastMessage({
        title: 'Login Required',
        description: 'Please log in to report videos',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setFlagging(true);
    try {
      const { error } = await supabase.from('video_flags').insert({
        submission_id: video.id,
        user_id: user.id,
        reason: flagReason,
        note: flagNote || null,
      });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          setToastMessage({
            title: 'Already Reported',
            description: 'You have already reported this video',
            type: 'error'
          });
        } else {
          throw error;
        }
      } else {
        setFlagged(true);
        setShowFlagModal(false);
        setToastMessage({
          title: 'Report Submitted',
          description: 'Thank you for reporting. Our team will review it.',
          type: 'success'
        });
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Error flagging video:', error);
      setToastMessage({
        title: 'Failed to Report',
        description: 'Please try again later',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setFlagging(false);
    }
  }

  async function toggleFavorite() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setToastMessage({
        title: 'Login Required',
        description: 'Please log in to favorite videos',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setFavoriting(true);
    try {
      if (isFavorited) {
        // Remove from favorites
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('submission_id', video.id)
          .eq('user_id', user.id);

        if (error) throw error;

        setIsFavorited(false);
        setToastMessage({
          title: 'Removed from Favorites',
          description: 'Video removed from your favorites',
          type: 'success'
        });
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            submission_id: video.id,
            user_id: user.id
          });

        if (error) throw error;

        setIsFavorited(true);
        setToastMessage({
          title: 'Added to Favorites',
          description: 'Video saved to your favorites',
          type: 'success'
        });
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setToastMessage({
        title: 'Failed to Update',
        description: 'Please try again later',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setFavoriting(false);
    }
  }

  function onPlayerReady(event: YouTubeEvent) {
    playerRef.current = event.target;
  }

  async function onPlayerEnd() {
    // Auto-play next video when current one ends
    onNext();
  }

  const opts = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1024px',
          backgroundColor: '#1a1a1a',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video Container */}
        <div style={{
          position: 'relative',
          backgroundColor: '#000000',
          borderRadius: '12px',
          overflow: 'hidden',
          aspectRatio: '16/9',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
        }}>
          <YouTube
            videoId={video.youtube_video_id}
            opts={opts}
            onReady={onPlayerReady}
            onEnd={onPlayerEnd}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%'
            }}
          />
        </div>

        {/* Controls */}
        <div style={{
          marginTop: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ flex: 1, color: '#ffffff' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '24px' }}>{getCountryFlag(video.country_code)}</span>
              <span style={{ fontWeight: '600' }}>{getCountryName(video.country_code)}</span>
              <span style={{ color: '#9ca3af' }}>•</span>
              <span style={{ color: '#d1d5db' }}>{CATEGORY_LABELS[category]}</span>
            </div>
            {video.title && (
              <p style={{ fontSize: '14px', color: '#d1d5db' }}>{video.title}</p>
            )}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {/* Favorite Button */}
            <button
              onClick={toggleFavorite}
              disabled={favoriting}
              style={{
                padding: '10px 20px',
                height: '40px',
                backgroundColor: isFavorited ? '#ef4444' : '#374151',
                color: '#ffffff',
                borderRadius: '8px',
                border: 'none',
                fontSize: '16px',
                cursor: favoriting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                if (!favoriting) {
                  e.currentTarget.style.backgroundColor = isFavorited ? '#dc2626' : '#4b5563';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isFavorited ? '#ef4444' : '#374151';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorited ? '❤️' : '🤍'}
            </button>

            {/* Flag Button */}
            {!flagged ? (
              <button
                onClick={() => setShowFlagModal(true)}
                style={{
                  padding: '10px 20px',
                  height: '40px',
                  backgroundColor: '#374151',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}
              >
                Report
              </button>
            ) : (
              <span style={{
                padding: '10px 20px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                color: '#9ca3af'
              }}>Reported</span>
            )}

            {/* Next Button */}
            <button
              onClick={onNext}
              style={{
                padding: '10px 24px',
                height: '40px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                borderRadius: '8px',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            >
              Next
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                height: '40px',
                backgroundColor: '#374151',
                color: '#ffffff',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                style={{ height: '18px', width: '18px' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showFlagModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }} onClick={() => setShowFlagModal(false)}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            padding: '32px',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }} onClick={(e) => e.stopPropagation()}>

            {/* Close Button */}
            <button
              onClick={() => setShowFlagModal(false)}
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
            >
              ✕
            </button>

            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#000000', marginBottom: '8px' }}>
              Report Video
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
              Help us maintain quality by reporting issues
            </p>

            {/* Reason Dropdown */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                Issue Type
              </label>
              <select
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="broken">Video is broken</option>
                <option value="wrong_category">Wrong category</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="other">Other issue</option>
              </select>
            </div>

            {/* Note Textarea */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                Additional Notes (Optional)
              </label>
              <textarea
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder="Describe the issue..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowFlagModal(false)}
                style={{
                  padding: '10px 24px',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#374151',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              >
                Cancel
              </button>
              <button
                onClick={handleFlagSubmit}
                disabled={flagging}
                style={{
                  padding: '10px 24px',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#ffffff',
                  backgroundColor: flagging ? '#9ca3af' : '#ef4444',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: flagging ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!flagging) e.currentTarget.style.backgroundColor = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  if (!flagging) e.currentTarget.style.backgroundColor = '#ef4444';
                }}
              >
                {flagging ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 100,
          backgroundColor: toastMessage.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '15px',
          fontWeight: '500'
        }}>
          <span style={{ fontSize: '20px' }}>
            {toastMessage.type === 'error' ? '⚠️' : '✓'}
          </span>
          <div>
            <div style={{ fontWeight: '600' }}>{toastMessage.title}</div>
            <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>
              {toastMessage.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
