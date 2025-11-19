'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import YouTube, { YouTubePlayer, YouTubeEvent } from 'react-youtube';
import { supabase } from '@/lib/supabase/client';
import { type VideoSubmission, type VideoCategory, CATEGORY_LABELS, VISIBLE_CATEGORIES } from '@/types';
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
  playlist?: VideoSubmission[];
  onSelectVideo?: (video: VideoSubmission) => void;
}

export default function VideoPlayer({ video, category, onClose, onNext, onSubmitVideo, categoryCounts, onChangeCategory, playlist, onSelectVideo }: VideoPlayerProps) {
  const CATEGORY_EMOJI: Record<VideoCategory, string> = {
    inspiration: '💡',
    music: '🎵',
    comedy: '😄',
    daily_life: '📹',
    talks: '🎤',
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
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'playlist' | 'comments'>('playlist');
  const [commentCount, setCommentCount] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState<Set<VideoCategory>>(new Set(VISIBLE_CATEGORIES));

  // Toggle category expansion
  const toggleCategory = (category: VideoCategory) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Group playlist by category
  const groupedPlaylist = useMemo(() => {
    if (!playlist || playlist.length === 0) return [];

    const groups: { category: VideoCategory; videos: VideoSubmission[] }[] = [];
    const categoriesInPlaylist = new Set<VideoCategory>();

    // Collect all unique categories
    playlist.forEach(video => categoriesInPlaylist.add(video.category));

    // Order categories by VISIBLE_CATEGORIES order
    VISIBLE_CATEGORIES.forEach(cat => {
      if (categoriesInPlaylist.has(cat)) {
        const videosInCategory = playlist.filter(v => v.category === cat);
        if (videosInCategory.length > 0) {
          groups.push({ category: cat, videos: videosInCategory });
        }
      }
    });

    return groups;
  }, [playlist]);

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

  // Get current user
  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    }
    getCurrentUser();
  }, []);

  // Preload comments immediately for faster display
  useEffect(() => {
    async function preloadComments() {
      try {
        const { data: comments, error } = await supabase
          .from('video_comments')
          .select('*')
          .eq('video_id', video.id);

        if (!error && comments) {
          setCommentCount(comments.length);
        }
      } catch (error) {
        console.error('Error preloading comments:', error);
      }
    }
    preloadComments();

    // Also subscribe to real-time updates for comment count
    const channel = supabase
      .channel(`comments_count_${video.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_comments',
        filter: `video_id=eq.${video.id}`
      }, () => {
        // Reload count when comments change
        preloadComments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    console.log('[VideoPlayer] onPlayerEnd called - video naturally ended');
    // Auto-play next video in playlist when current one ends
    if (playlist && playlist.length > 0 && onSelectVideo) {
      const currentIndex = playlist.findIndex(v => v.id === video.id);
      if (currentIndex !== -1) {
        // Move to next video, or loop back to first
        const nextIndex = (currentIndex + 1) % playlist.length;
        console.log('[VideoPlayer] Moving to next video in playlist');
        onSelectVideo(playlist[nextIndex]);
      } else {
        // Fallback to random next
        console.log('[VideoPlayer] Current video not in playlist, using random next');
        onNext();
      }
    } else {
      // No playlist, use random next
      console.log('[VideoPlayer] No playlist, using random next');
      onNext();
    }
  }

  const opts = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
    },
  };

  useEffect(() => {
    setPlaybackBlocked(false);
  }, [video.id]);

  function handlePlayerError(event: YouTubeEvent) {
    console.warn('YouTube player error:', event.data, video.youtube_video_id);
    setPlaybackBlocked(true);
  }

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
        {/* Playlist Panel - Desktop only */}
        {!isMobile && playlist && playlist.length > 0 && (
          <div style={{
            width: '300px',
            backgroundColor: '#0a0a0a',
            borderRight: '1px solid #1f1f1f',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Playlist Header */}
            <div style={{
              padding: '20px 16px',
              borderBottom: '1px solid #1f1f1f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#ffffff'
              }}>
                Playlist
              </div>
              <div style={{
                fontSize: '12px',
                color: '#9ca3af'
              }}>
                {playlist.length} {playlist.length === 1 ? 'video' : 'videos'}
              </div>
            </div>

            {/* Playlist Items */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              {groupedPlaylist.map((group) => {
                const isExpanded = expandedCategories.has(group.category);

                return (
                  <div key={group.category}>
                    {/* Category Header */}
                    <div
                      onClick={() => toggleCategory(group.category)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#161616',
                        borderBottom: '1px solid #1f1f1f',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f1f1f'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#161616'}
                    >
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{
                          fontSize: '10px',
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          display: 'inline-block'
                        }}>▶</span>
                        <span>{CATEGORY_EMOJI[group.category]}</span>
                        <span>{CATEGORY_LABELS[group.category]}</span>
                        <span style={{ color: '#6b7280' }}>({group.videos.length})</span>
                      </div>
                    </div>

                    {/* Videos in this category */}
                    {isExpanded && group.videos.map((playlistVideo) => {
                    const isCurrentVideo = playlistVideo.id === video.id;
                    const isOwnVideo = currentUserId && playlistVideo.user_id === currentUserId;

                    return (
                      <div
                        key={playlistVideo.id}
                        onClick={() => {
                          if (onSelectVideo && !isCurrentVideo) {
                            onSelectVideo(playlistVideo);
                          }
                        }}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #1f1f1f',
                          cursor: isCurrentVideo ? 'default' : 'pointer',
                          backgroundColor: isCurrentVideo ? '#1a1a1a' : 'transparent',
                          transition: 'background-color 0.2s',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrentVideo) {
                            e.currentTarget.style.backgroundColor = '#111111';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrentVideo) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        {/* Video Title and Indicators */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <div
                            title={playlistVideo.title || 'Untitled Video'}
                            style={{
                              fontSize: '13px',
                              fontWeight: isCurrentVideo ? 600 : 400,
                              color: isCurrentVideo ? '#3b82f6' : '#ffffff',
                              lineHeight: '1.4',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1
                            }}
                          >
                            {playlistVideo.title || 'Untitled Video'}
                          </div>

                          {/* Badges and Indicators */}
                          {isOwnVideo && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexShrink: 0
                            }}>
                              <span style={{
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600
                              }}>
                                You
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            top: isMobile ? 'max(env(safe-area-inset-top, 0px) + 12px, 48px)' : '12px',
            right: isMobile ? 'max(env(safe-area-inset-right, 0px) + 12px, 16px)' : '12px',
            width: isMobile ? '44px' : '40px',
            height: isMobile ? '44px' : '40px',
            borderRadius: '9999px',
            backgroundColor: isMobile ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.6)',
            border: isMobile ? '2px solid rgba(255, 255, 255, 0.3)' : 'none',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            zIndex: 2,
            fontSize: isMobile ? '24px' : '22px',
            fontWeight: '300',
            boxShadow: isMobile ? '0 4px 12px rgba(0, 0, 0, 0.5)' : 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isMobile ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.6)';
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
            onError={handlePlayerError}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%'
            }}
          />
          {playbackBlocked && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '14px', lineHeight: 1.4 }}>
                This video can only be watched on YouTube on your device.
              </p>
              <a
                href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '10px 18px',
                  borderRadius: '9999px',
                  border: 'none',
                  fontWeight: 600,
                  color: '#ffffff',
                  backgroundColor: '#f97316',
                  cursor: 'pointer',
                  textDecoration: 'none'
                }}
              >
                Open on YouTube
              </a>
            </div>
          )}
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
              gap: '10px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '28px' }}>{getCountryFlag(video.country_code)}</span>
              </div>
              {categoryCounts && onChangeCategory && (
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  justifyContent: 'center',
                  flex: 1,
                  overflowX: 'auto',
                  paddingBottom: '2px',
                  minWidth: 0
                }}>
                  {VISIBLE_CATEGORIES.map((cat) => {
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
                          padding: '5px 10px',
                          borderRadius: '9999px',
                          border: '1px solid ' + (active ? '#3b82f6' : '#334155'),
                          background: active ? '#3b82f6' : '#111827',
                          color: disabled ? '#6b7280' : '#ffffff',
                          opacity: disabled ? 0.6 : 1,
                          fontSize: 11,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
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
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }}>
                {/* Favorite Button */}
                <button
                  onClick={toggleFavorite}
                  disabled={favoriting}
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: isFavorited ? '#ef4444' : '#1f2937',
                    color: '#ffffff',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '16px',
                    cursor: favoriting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (!favoriting) {
                      e.currentTarget.style.backgroundColor = isFavorited ? '#dc2626' : '#374151';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isFavorited ? '#ef4444' : '#1f2937';
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
                    width: '32px',
                    height: '32px',
                    backgroundColor: '#1f2937',
                    color: '#ffffff',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '16px',
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
                    width: '32px',
                    height: '32px',
                    backgroundColor: '#f97316',
                    color: '#ffffff',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '16px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
                  title="Submit a video for this country and category"
                >
                  +
                </button>
              </div>
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
                {VISIBLE_CATEGORIES.map((cat) => {
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

        {/* Comment/Playlist Section - Right side on desktop, below on mobile with tabs */}
        <div style={{
          width: isMobile ? '100%' : '300px',
          borderLeft: isMobile ? 'none' : '1px solid #333333',
          backgroundColor: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isMobile ? '400px' : '100%'
        }}>
          {/* Mobile Tab Buttons */}
          {isMobile && playlist && playlist.length > 0 && (
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #333333',
              backgroundColor: '#0a0a0a'
            }}>
              <button
                onClick={() => setMobileTab('playlist')}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: mobileTab === 'playlist' ? '#1a1a1a' : 'transparent',
                  color: mobileTab === 'playlist' ? '#ffffff' : '#9ca3af',
                  border: 'none',
                  borderBottom: mobileTab === 'playlist' ? '2px solid #f97316' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: mobileTab === 'playlist' ? 600 : 400,
                  transition: 'all 0.2s'
                }}
              >
                Playlist ({playlist.length})
              </button>
              <button
                onClick={() => setMobileTab('comments')}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: mobileTab === 'comments' ? '#1a1a1a' : 'transparent',
                  color: mobileTab === 'comments' ? '#ffffff' : '#9ca3af',
                  border: 'none',
                  borderBottom: mobileTab === 'comments' ? '2px solid #f97316' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: mobileTab === 'comments' ? 600 : 400,
                  transition: 'all 0.2s'
                }}
              >
                Comments ({commentCount})
              </button>
            </div>
          )}

          {/* Content */}
          {isMobile && mobileTab === 'playlist' && playlist && playlist.length > 0 ? (
            // Playlist view for mobile
            <div style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              {groupedPlaylist.map((group) => {
                const isExpanded = expandedCategories.has(group.category);

                return (
                  <div key={group.category}>
                    {/* Category Header */}
                    <div
                      onClick={() => toggleCategory(group.category)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#161616',
                        borderBottom: '1px solid #1f1f1f',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f1f1f'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#161616'}
                    >
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{
                          fontSize: '10px',
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          display: 'inline-block'
                        }}>▶</span>
                        <span>{CATEGORY_EMOJI[group.category]}</span>
                        <span>{CATEGORY_LABELS[group.category]}</span>
                        <span style={{ color: '#6b7280' }}>({group.videos.length})</span>
                      </div>
                    </div>

                    {/* Videos in this category */}
                    {isExpanded && group.videos.map((playlistVideo) => {
                    const isCurrentVideo = playlistVideo.id === video.id;
                    const isOwnVideo = currentUserId && playlistVideo.user_id === currentUserId;

                    return (
                      <div
                        key={playlistVideo.id}
                        onClick={() => {
                          if (onSelectVideo && !isCurrentVideo) {
                            onSelectVideo(playlistVideo);
                          }
                        }}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #1f1f1f',
                          cursor: isCurrentVideo ? 'default' : 'pointer',
                          backgroundColor: isCurrentVideo ? '#1a1a1a' : 'transparent',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <div
                            title={playlistVideo.title || 'Untitled Video'}
                            style={{
                              fontSize: '13px',
                              fontWeight: isCurrentVideo ? 600 : 400,
                              color: isCurrentVideo ? '#3b82f6' : '#ffffff',
                              lineHeight: '1.4',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1
                            }}
                          >
                            {playlistVideo.title || 'Untitled Video'}
                          </div>

                          {isOwnVideo && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexShrink: 0
                            }}>
                              <span style={{
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600
                              }}>
                                You
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                );
              })}
            </div>
          ) : (
            // Comments view (default for mobile when no playlist, or when comments tab selected)
            <CommentSection
              videoId={video.id}
              isMobile={isMobile}
              forceExpanded={isMobile && playlist && playlist.length > 0}
              hideHeader={isMobile && playlist && playlist.length > 0}
              onCommentsLoaded={setCommentCount}
            />
          )}
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
