'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { type CountryComment } from '@/types';

interface CommentSectionProps {
  countryCode: string;
  isMobile: boolean;
}

export default function CommentSection({ countryCode, isMobile }: CommentSectionProps) {
  const [comments, setComments] = useState<CountryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userComment, setUserComment] = useState<CountryComment | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', description: '', type: 'success' as 'success' | 'error' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

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

  // Load comments for this country
  useEffect(() => {
    loadComments();

    // Set up real-time subscription
    const channel = supabase
      .channel(`comments_${countryCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'country_comments',
        filter: `country_code=eq.${countryCode}`
      }, () => {
        loadComments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [countryCode, user]);

  async function loadComments() {
    setLoading(true);
    try {
      // Fetch all comments for this country, sorted by updated_at descending
      const { data: commentsData, error: commentsError } = await supabase
        .from('country_comments')
        .select('*')
        .eq('country_code', countryCode)
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

      setComments(commentsWithNames);

      // Check if current user has commented
      if (user) {
        const myComment = commentsWithNames?.find(c => c.user_id === user.id);
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

    if (commentText.length > 500) {
      setToastMessage({
        title: 'Too Long',
        description: 'Comments must be 500 characters or less',
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
          .from('country_comments')
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
          .from('country_comments')
          .insert({
            user_id: user.id,
            country_code: countryCode,
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
        .from('country_comments')
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      color: '#ffffff'
    }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '12px' : '16px',
        fontWeight: 700,
        fontSize: isMobile ? '14px' : '16px'
      }}>
        Perspectives ({comments.length})
      </div>

      {/* Comment List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? '12px' : '16px',
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
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment Input Area */}
      <div style={{
        padding: isMobile ? '12px' : '16px',
        borderTop: '1px solid #333333',
        backgroundColor: '#0a0a0a'
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
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: isMobile ? '10px 16px' : '12px 20px',
                backgroundColor: '#374151',
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
                e.currentTarget.style.backgroundColor = '#374151';
              }}
            >
              Edit
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={submitting}
              style={{
                padding: isMobile ? '10px 16px' : '12px 20px',
                backgroundColor: submitting ? '#4b5563' : '#374151',
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
                  e.currentTarget.style.backgroundColor = '#4b5563';
                }
              }}
              onMouseLeave={(e) => {
                if (!submitting) {
                  e.currentTarget.style.backgroundColor = '#374151';
                }
              }}
            >
              Delete
            </button>
          </div>
        ) : (
          <div>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Share your perspective on this country..."
              maxLength={500}
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
                color: commentText.length > 450 ? '#f97316' : '#6b7280'
              }}>
                {commentText.length}/500
              </div>
            </div>
            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              <button
                onClick={handleSubmit}
                disabled={submitting || !commentText.trim()}
                style={{
                  flex: 1,
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
                {submitting ? 'Submitting...' : userComment ? 'Update' : 'Share Perspective'}
              </button>
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
            </div>
          </div>
        )}
      </div>

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
  );
}
