'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { type VideoComment } from '@/types';

interface CommentSectionProps {
  videoId: string;
  isMobile: boolean;
}

export default function CommentSection({ videoId, isMobile }: CommentSectionProps) {
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userComment, setUserComment] = useState<VideoComment | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', description: '', type: 'success' as 'success' | 'error' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check authentication
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Scroll buttons into view when entering edit mode on mobile
  useEffect(() => {
    if (isEditing && isMobile && buttonsRef.current) {
      setTimeout(() => {
        buttonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
      }, 500);
    }
  }, [isEditing, isMobile]);

  // Load comments for this video
  useEffect(() => {
    loadComments();

    // Set up real-time subscription
    const channel = supabase
      .channel(`comments_${videoId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_comments',
        filter: `video_id=eq.${videoId}`
      }, () => {
        loadComments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoId, user]);

  async function loadComments() {
    setLoading(true);
    try {
      // Fetch all comments for this video, sorted by updated_at descending
      const { data: commentsData, error: commentsError } = await supabase
        .from('video_comments')
        .select('*')
        .eq('video_id', videoId)
        .order('updated_at', { ascending: false });

      if (commentsError) throw commentsError;

      // Fetch user profiles for display names (if table exists)
      let profilesMap = new Map();
      const userIds = commentsData?.map(c => c.user_id) || [];

      if (userIds.length > 0) {
        try {
          const { data: profilesData } = await supabase
            .from('user_profiles')
            .select('id, username, display_name')
            .in('id', userIds);

          // Create a map of user profiles
          profilesMap = new Map(
            profilesData?.map(p => [p.id, p]) || []
          );
        } catch (profileError) {
          console.log('user_profiles table may not exist yet:', profileError);
        }
      }

      // Combine comments with user display names
      const commentsWithNames = commentsData?.map(comment => {
        const profile = profilesMap.get(comment.user_id);
        return {
          ...comment,
          user_display: profile?.display_name || profile?.username || 'Anonymous'
        };
      }) || [];

      // Sort comments: user's comment first, then others by updated_at
      const sortedComments = commentsWithNames.sort((a, b) => {
        // If user is logged in, their comment should always be first
        if (user) {
          if (a.user_id === user.id) return -1;
          if (b.user_id === user.id) return 1;
        }
        // Otherwise sort by updated_at descending (already sorted from query, but ensuring)
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setComments(sortedComments);

      // Check if current user has commented
      if (user) {
        const myComment = sortedComments?.find(c => c.user_id === user.id);
        setUserComment(myComment || null);
        if (myComment) {
          setCommentText(myComment.content);
        }
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!user) {
      setToastMessage({
        title: 'Login Required',
        description: 'Please log in to share your perspective',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    if (!commentText.trim()) {
      setToastMessage({
        title: 'Empty Comment',
        description: 'Please write something before submitting',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    if (commentText.length > 1000) {
      setToastMessage({
        title: 'Too Long',
        description: 'Comments must be 1000 characters or less',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setSubmitting(true);
    try {
      if (userComment) {
        // Update existing comment
        const { error } = await supabase
          .from('video_comments')
          .update({ content: commentText.trim() })
          .eq('id', userComment.id);

        if (error) throw error;

        setToastMessage({
          title: 'Comment Updated',
          description: 'Your perspective has been updated',
          type: 'success'
        });
        setIsEditing(false);
      } else {
        // Insert new comment
        const { error } = await supabase
          .from('video_comments')
          .insert({
            user_id: user.id,
            video_id: videoId,
            content: commentText.trim()
          });

        if (error) throw error;

        setToastMessage({
          title: 'Comment Added',
          description: 'Your perspective has been shared',
          type: 'success'
        });
      }

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      loadComments();
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      setToastMessage({
        title: 'Failed to Submit',
        description: error.message || 'Please try again later',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelEdit() {
    setIsEditing(false);
    if (userComment) {
      setCommentText(userComment.content);
    } else {
      setCommentText('');
    }
  }

  async function handleDeleteConfirm() {
    if (!user || !userComment) return;

    setSubmitting(true);
    setShowDeleteModal(false);

    try {
      const { error } = await supabase
        .from('video_comments')
        .delete()
        .eq('id', userComment.id);

      if (error) throw error;

      setToastMessage({
        title: 'Comment Deleted',
        description: 'Your perspective has been removed',
        type: 'success'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Reset state
      setUserComment(null);
      setCommentText('');
      setIsEditing(false);
      loadComments();
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      setToastMessage({
        title: 'Failed to Delete',
        description: error.message || 'Please try again later',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setSubmitting(false);
    }
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  }

  return (
    <>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      color: '#ffffff',
      backgroundColor: '#0a0a0a'
    }}>
      {/* Header with toggle button */}
      <div
        onClick={() => isMobile && setIsExpanded(!isExpanded)}
        style={{
          padding: isMobile ? '12px' : '16px',
          fontWeight: 700,
          fontSize: isMobile ? '14px' : '16px',
          cursor: isMobile ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none'
        }}
      >
        <span>Comments ({comments.length})</span>
        {isMobile && (
          <span style={{
            fontSize: '20px',
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </span>
        )}
      </div>

      {/* Comment List - collapsible on mobile */}
      {(!isMobile || isExpanded) && (
      <div className="comment-scroll" style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? '12px' : '16px',
        paddingBottom: '150px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '12px' : '16px',
        WebkitOverflowScrolling: 'touch',
        minHeight: 0
      }}>
        {loading ? (
          <div style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
            No perspectives yet. Be the first to share!
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                paddingBottom: isMobile ? '12px' : '16px'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <div style={{
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>{comment.user_display || 'Anonymous'}</span>
                  {comment.user_id === user?.id && (
                    <span style={{
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600
                    }}>
                      You
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: isMobile ? '10px' : '11px',
                  color: '#6b7280'
                }}>
                  {formatTimestamp(comment.updated_at)}
                  {comment.created_at !== comment.updated_at && ' (edited)'}
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: isMobile ? '13px' : '14px',
                  lineHeight: 1.5,
                  color: '#ffffff',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  ...(!expandedComments.has(comment.id) ? {
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  } : {})
                }}>
                  {comment.content}
                </div>
                {comment.content.split('\n').length > 3 && !expandedComments.has(comment.id) && (
                  <button
                    onClick={() => setExpandedComments(prev => new Set(prev).add(comment.id))}
                    style={{
                      color: '#3b82f6',
                      fontSize: '12px',
                      marginTop: '4px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Read more
                  </button>
                )}
                {expandedComments.has(comment.id) && (
                  <button
                    onClick={() => {
                      const newSet = new Set(expandedComments);
                      newSet.delete(comment.id);
                      setExpandedComments(newSet);
                    }}
                    style={{
                      color: '#3b82f6',
                      fontSize: '12px',
                      marginTop: '4px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Show less
                  </button>
                )}
                {/* Edit and Delete links for user's own comment (not in edit mode) */}
                {comment.user_id === user?.id && !isEditing && (
                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    gap: '12px',
                    fontSize: '12px'
                  }}>
                    <button
                      onClick={() => setIsEditing(true)}
                      style={{
                        color: '#9ca3af',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '12px',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      style={{
                        color: '#9ca3af',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '12px',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {/* Comment Input Area - collapsible on mobile */}
      {(!isMobile || isExpanded) && (
      <div className="comment-input-container" style={{
        padding: isMobile ? '12px' : '16px',
        backgroundColor: '#0a0a0a',
        overflowY: 'auto',
        maxHeight: isMobile ? 'none' : '320px'
      }}>
        {!user ? (
          <div style={{
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: isMobile ? '13px' : '14px',
            padding: '12px'
          }}>
            Login to add your perspective
          </div>
        ) : userComment && !isEditing ? (
          // Show nothing in the input area when user has a comment but isn't editing
          <div />
        ) : (
          <div>
            <textarea
              ref={textareaRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Share your perspective on this video..."
              maxLength={1000}
              style={{
                width: '100%',
                minHeight: isMobile ? '60px' : '100px',
                padding: isMobile ? '10px' : '12px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333333',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '16px',
                resize: 'none',
                fontFamily: 'inherit',
                marginBottom: '8px'
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <div style={{
                fontSize: '12px',
                color: commentText.length > 900 ? '#f97316' : '#6b7280'
              }}>
                {commentText.length}/1000
              </div>
            </div>
            <div
              ref={buttonsRef}
              style={{
              display: 'flex',
              gap: '8px',
              paddingBottom: isMobile && isEditing ? '20px' : '0',
              justifyContent: 'flex-end'
            }}>
              {isEditing && (
                <button
                  onClick={handleCancelEdit}
                  disabled={submitting}
                  style={{
                    padding: isMobile ? '10px 16px' : '12px 20px',
                    backgroundColor: '#1a1a1a',
                    color: '#9ca3af',
                    border: '1px solid #333333',
                    borderRadius: '8px',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!submitting) {
                      e.currentTarget.style.backgroundColor = '#333333';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!submitting) {
                      e.currentTarget.style.backgroundColor = '#1a1a1a';
                      e.currentTarget.style.color = '#9ca3af';
                    }
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || !commentText.trim()}
                style={{
                  padding: isMobile ? '10px 16px' : '12px 20px',
                  backgroundColor: submitting || !commentText.trim() ? '#4b5563' : '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: 600,
                  cursor: submitting || !commentText.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!submitting && commentText.trim()) {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting && commentText.trim()) {
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                  }
                }}
              >
                {submitting ? 'Submitting...' : userComment ? 'Save' : 'Comment'}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1a1a',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '100%',
              padding: isMobile ? '24px' : '32px',
              border: '1px solid #333333',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '12px'
            }}>
              Delete Comment?
            </h3>
            <p style={{
              fontSize: isMobile ? '13px' : '14px',
              color: '#9ca3af',
              marginBottom: '24px',
              lineHeight: 1.5
            }}>
              Are you sure you want to delete your perspective? This action cannot be undone.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: isMobile ? '10px 20px' : '12px 24px',
                  backgroundColor: '#333333',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#4b5563';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#333333';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={submitting}
                style={{
                  padding: isMobile ? '10px 20px' : '12px 24px',
                  backgroundColor: submitting ? '#9ca3af' : '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.backgroundColor = '#ef4444';
                  }
                }}
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: toastMessage.type === 'success' ? '#10b981' : '#ef4444',
          color: '#ffffff',
          padding: isMobile ? '12px 16px' : '16px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          zIndex: 200,
          maxWidth: isMobile ? '90%' : '400px'
        }}>
          <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: isMobile ? '13px' : '14px' }}>
            {toastMessage.title}
          </div>
          <div style={{ fontSize: isMobile ? '12px' : '13px' }}>
            {toastMessage.description}
          </div>
        </div>
      )}
    </div>
    {!isMobile && (
      <style jsx global>{`
        .comment-scroll,
        .comment-input-container {
          scrollbar-width: thin;
          scrollbar-color: rgba(71, 85, 105, 0.75) transparent;
        }
        .comment-scroll::-webkit-scrollbar,
        .comment-input-container::-webkit-scrollbar {
          width: 8px;
        }
        .comment-scroll::-webkit-scrollbar-track,
        .comment-input-container::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.35);
        }
        .comment-scroll::-webkit-scrollbar-thumb,
        .comment-input-container::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.85);
          border-radius: 999px;
        }
        .comment-scroll::-webkit-scrollbar-thumb:hover,
        .comment-input-container::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 1);
        }
      `}</style>
    )}
    </>
  );
}
