'use client';

import { useEffect, useState, useRef } from 'react';
import YouTube, { YouTubePlayer, YouTubeEvent } from 'react-youtube';
import { supabase } from '@/lib/supabase/client';
import { type VideoSubmission, type VideoCategory, CATEGORY_LABELS } from '@/types';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import CommentSection from './CommentSection';

interface VideoPlayerProps {
  video: VideoSubmission;
  category: VideoCategory;
  onClose: () => void;
  onNext: () => void;
  onSubmitVideo: (countryCode: string, category: VideoCategory) => void;
  categoryCounts?: Record<VideoCategory, number>;
  onChangeCategory?: (category: VideoCategory) => void;
}

export default function VideoPlayer({ video, category, onClose, onNext, onSubmitVideo, categoryCounts, onChangeCategory }: VideoPlayerProps) {
  const CATEGORY_EMOJI: Record<VideoCategory, string> = {
    inspiration: '💡',
    music: '🎵',
    comedy: '😄',
    cooking: '🍳',
    street_voices: '🎤',
  };
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState<'broken' | 'wrong_category' | 'inappropriate' | 'other'>('broken');
  const [flagNote, setFlagNote] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', description: '', type: 'success' as 'success' | 'error' });
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [showFullTitle, setShowFullTitle] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent background scroll when modal is open
  useEffect(() => {
    // Save original body overflow
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;

    // Prevent scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      // Restore original styles
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
    };
  }, []);

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
        zIndex: 120,
        // Flip colors: use modal's darker grey on the backdrop
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '0' : '16px'
      }}
      onClick={onClose}
    >
      {/* Close button will be positioned inside the modal card */}
      <div
        style={{
          width: '100%',
          maxWidth: isMobile ? '1024px' : '1400px',
          height: isMobile ? '100vh' : '90vh',
          maxHeight: isMobile ? '100vh' : '95vh',
          // Flip colors: make the modal card darker than the backdrop
          backgroundColor: '#000000',
          borderRadius: isMobile ? '0' : '16px',
          boxShadow: isMobile ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          position: 'relative',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Video Section */}
        <div style={{
          flex: isMobile ? 'none' : '1',
          // Increase side paddings so the frame feels balanced
          paddingLeft: isMobile ? '0' : '32px',
          paddingRight: isMobile ? '0' : '32px',
          paddingBottom: isMobile ? '0' : '24px',
          // Thicker top padding so the close button sits in the header space
          paddingTop: isMobile ? '48px' : '52px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}>
        {/* Close (X) at top-right of modal card */}
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          style={{
            position: 'absolute',
            top: isMobile ? '12px' : '12px',
            right: isMobile ? '12px' : '12px',
            width: isMobile ? '40px' : '40px',
            height: isMobile ? '40px' : '40px',
            borderRadius: '9999px',
            backgroundColor: isMobile ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.6)',
            border: 'none',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            zIndex: 2,
            fontSize: isMobile ? '24px' : '22px',
            fontWeight: '300'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isMobile ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.6)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ✕
        </button>
        {/* Video Container */}
        <div style={{
          position: 'relative',
          // Slightly lighter than card to restore visible frame/border
          backgroundColor: '#0a0a0a',
          borderRadius: isMobile ? '0' : '12px',
          overflow: 'hidden',
          aspectRatio: '16/9',
          boxShadow: isMobile ? 'none' : '0 10px 40px rgba(0, 0, 0, 0.5)',
          maxHeight: isMobile ? 'auto' : '580px',
          flexShrink: 0,
          marginLeft: isMobile ? '8px' : '0',
          marginRight: isMobile ? '8px' : '0'
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

        {/* Title directly under the video */}
        {video.title && (
          <>
            <div
              onClick={() => isMobile && setShowFullTitle(!showFullTitle)}
              style={{
                marginTop: isMobile ? '10px' : '12px',
                paddingLeft: isMobile ? '16px' : '0',
                paddingRight: isMobile ? '16px' : '0',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: isMobile ? '14px' : '16px',
                lineHeight: 1.25,
                ...(isMobile ? {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                } : {})
              }}
            >
              {video.title}
            </div>
            {/* Full title tooltip for mobile */}
            {isMobile && showFullTitle && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 400,
                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px'
                }}
                onClick={() => setShowFullTitle(false)}
              >
                <div
                  style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '20px',
                    maxWidth: '90%',
                    border: '1px solid #333333',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 700,
                    lineHeight: 1.5,
                    wordBreak: 'break-word'
                  }}>
                    {video.title}
                  </div>
                  <button
                    onClick={() => setShowFullTitle(false)}
                    style={{
                      marginTop: '16px',
                      padding: '10px 20px',
                      backgroundColor: '#374151',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Controls */}
        {isMobile ? (
          <div style={{
            marginTop: '12px',
            paddingLeft: '16px',
            paddingRight: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '32px' }}>{getCountryFlag(video.country_code)}</span>
              </div>
              {categoryCounts && onChangeCategory && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'flex-end',
                  flex: 1,
                  overflowX: 'auto',
                  paddingBottom: '2px'
                }}>
                  {(['inspiration','music','comedy','cooking','street_voices'] as VideoCategory[]).map((cat) => {
                    const count = categoryCounts[cat] || 0;
                    const active = cat === category;
                    const disabled = count === 0;
                    const label = CATEGORY_LABELS[cat];
                    const emoji = CATEGORY_EMOJI[cat];
                    return (
                      <button
                        key={cat}
                        disabled={disabled}
                        onClick={() => !disabled && !active && onChangeCategory(cat)}
                        style={{
                          whiteSpace: 'nowrap',
                          padding: '6px 10px',
                          borderRadius: '9999px',
                          border: '1px solid ' + (active ? '#3b82f6' : '#334155'),
                          background: active ? '#3b82f6' : '#111827',
                          color: disabled ? '#6b7280' : '#ffffff',
                          opacity: disabled ? 0.6 : 1,
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: disabled ? 'not-allowed' : 'pointer'
                        }}
                        aria-pressed={active}
                        aria-label={label}
                        title={label}
                      >
                        <span aria-hidden>{emoji}</span>
                        {active && <span>{label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              justifyContent: 'flex-end',
              marginTop: '10px',
              paddingBottom: '8px'
            }}>
              {/* Favorite Button */}
              <button
                onClick={toggleFavorite}
                disabled={favoriting}
                style={{
                  padding: '6px 12px',
                  backgroundColor: isFavorited ? '#ef4444' : '#374151',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 600,
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

              {/* Next Button */}
              <button
                onClick={onNext}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#1f2937',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
                title="Next video"
              >
                ⏭️
              </button>

              {/* Submit Video Button */}
              <button
                onClick={() => onSubmitVideo(video.country_code, category)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#f97316',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
                title="Submit a video for this country and category"
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            marginTop: '16px',
            paddingLeft: '0',
            paddingRight: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            {/* Left: Country info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '24px' }}>{getCountryFlag(video.country_code)}</span>
              <span style={{ fontWeight: 600, fontSize: '16px', color: '#ffffff', marginLeft: '8px' }}>{getCountryName(video.country_code)}</span>
            </div>

            {/* Center: Category pills (desktop only) */}
            {categoryCounts && onChangeCategory && (
              <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                flex: 1
              }}>
                {(['inspiration','music','comedy','cooking','street_voices'] as VideoCategory[]).map((cat) => {
                  const count = categoryCounts[cat] || 0;
                  const active = cat === category;
                  const disabled = count === 0;
                  const label = CATEGORY_LABELS[cat];
                  return (
                    <button
                      key={cat}
                      disabled={disabled}
                      onClick={() => !disabled && !active && onChangeCategory(cat)}
                      style={{
                        whiteSpace: 'nowrap',
                        padding: '10px 16px',
                        borderRadius: '9999px',
                        border: '1px solid ' + (active ? '#3b82f6' : '#334155'),
                        background: active ? '#3b82f6' : '#111827',
                        color: disabled ? '#6b7280' : '#ffffff',
                        opacity: disabled ? 0.6 : 1,
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: disabled ? 'not-allowed' : 'pointer'
                      }}
                      aria-pressed={active}
                      aria-label={label}
                      title={label}
                    >
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Right: Action buttons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexShrink: 0
            }}>
              {/* Favorite Button */}
              <button
                onClick={toggleFavorite}
                disabled={favoriting}
                style={{
                  padding: '10px 16px',
                  backgroundColor: isFavorited ? '#ef4444' : '#374151',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
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

              {/* Next Button */}
              <button
                onClick={onNext}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#1f2937',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
                title="Next video"
              >
                Next
              </button>

              {/* Submit Video Button */}
              <button
                onClick={() => onSubmitVideo(video.country_code, category)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#f97316',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
                title="Submit a video for this country and category"
              >
                ＋ Add
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Comment Section - Right side on desktop, below on mobile */}
        <div style={{
          width: isMobile ? '100%' : '380px',
          borderLeft: isMobile ? 'none' : '1px solid #333333',
          borderTop: isMobile ? '1px solid #333333' : 'none',
          backgroundColor: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isMobile ? '400px' : '100%'
        }}>
          <CommentSection countryCode={video.country_code} isMobile={isMobile} />
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
