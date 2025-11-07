'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, type VideoCategory, type VideoSubmission } from '@/types';

interface ProfileModalProps {
  onClose: () => void;
  onPlayVideo: (video: VideoSubmission, category: VideoCategory) => void;
  onEditSubmission: (countryCode: string) => void;
  initialData?: {
    favorites: Array<{ video: VideoSubmission; category: VideoCategory }>;
    submissions: VideoSubmission[];
  } | null;
}

export default function ProfileModal({ onClose, onPlayVideo, onEditSubmission, initialData }: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'favorites' | 'submissions' | 'settings'>('favorites');
  const [favorites, setFavorites] = useState<Array<{ video: VideoSubmission; category: VideoCategory }>>(initialData?.favorites || []);
  const [submissions, setSubmissions] = useState<VideoSubmission[]>(initialData?.submissions || []);
  const [loading, setLoading] = useState(!initialData);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', description: '', type: 'success' as 'success' | 'error' });
  const [showLibraryFavorites, setShowLibraryFavorites] = useState(true);
  const [showLibrarySubmissions, setShowLibrarySubmissions] = useState(true);

  // Fetch both favorites and submissions on mount only if no initial data
  useEffect(() => {
    if (!initialData) {
      fetchAllData();
    }
  }, []);

  // Refetch when tab changes
  useEffect(() => {
    if (activeTab === 'favorites' && favorites.length === 0) {
      fetchFavorites();
    } else if (activeTab === 'submissions' && submissions.length === 0) {
      fetchSubmissions();
    } else if (activeTab === 'settings') {
      if (favorites.length === 0) fetchFavorites();
      if (submissions.length === 0) fetchSubmissions();
    }
  }, [activeTab]);

  async function fetchAllData() {
    setLoading(true);
    try {
      await Promise.all([fetchFavorites(), fetchSubmissions()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFavorites() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_favorites')
        .select(`
          submission_id,
          video_submissions (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const favoritesData = data?.map((fav: any) => ({
        video: fav.video_submissions,
        category: fav.video_submissions.category as VideoCategory
      })) || [];

      setFavorites(favoritesData);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  }

  async function fetchSubmissions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('video_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  }

  async function fetchData() {
    if (activeTab === 'favorites') {
      await fetchFavorites();
    } else {
      await fetchSubmissions();
    }
  }

  async function handleDeleteSubmission(id: string) {
    if (!confirm('Are you sure you want to delete this submission?')) return;

    try {
      const { error } = await supabase
        .from('video_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setToastMessage({
        title: 'Submission Deleted',
        description: 'Your submission has been removed',
        type: 'success'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Refresh submissions
      fetchData();
    } catch (error) {
      console.error('Error deleting submission:', error);
      setToastMessage({
        title: 'Failed to Delete',
        description: 'Please try again later',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }

  function renderStatusBadge(status: string) {
    const statusConfig = {
      pending: { text: 'Pending', bg: '#fef3c7', color: '#92400e' },
      approved: { text: 'Approved', bg: '#d1fae5', color: '#065f46' },
      rejected: { text: 'Rejected', bg: '#fee2e2', color: '#991b1b' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];

    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: '6px',
        backgroundColor: config.bg,
        color: config.color,
        fontSize: '12px',
        fontWeight: '600'
      }}>
        {config.text}
      </span>
    );
  }

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
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        padding: '32px',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column'
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
        >
          ✕
        </button>

        {/* Header */}
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#000000', marginBottom: '24px' }}>
          My Profile
        </h2>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <button
            onClick={() => setActiveTab('favorites')}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '600',
              color: activeTab === 'favorites' ? '#f97316' : '#6b7280',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'favorites' ? '2px solid #f97316' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ❤️ Favorites ({favorites.length})
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '600',
              color: activeTab === 'submissions' ? '#f97316' : '#6b7280',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'submissions' ? '2px solid #f97316' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📤 My Submissions ({submissions.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '600',
              color: activeTab === 'settings' ? '#f97316' : '#6b7280',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'settings' ? '2px solid #f97316' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
              Loading...
            </div>
          ) : activeTab === 'favorites' ? (
            favorites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                <p style={{ fontSize: '48px', marginBottom: '16px' }}>🤍</p>
                <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No favorites yet</p>
                <p style={{ fontSize: '14px' }}>Start exploring and save videos you love!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {favorites.map(({ video, category }) => (
                  <div
                    key={video.id}
                    onClick={() => onPlayVideo(video, category)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px',
                      borderRadius: '12px',
                      backgroundColor: '#f9fafb',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '20px' }}>{getCountryFlag(video.country_code)}</span>
                        <span style={{ fontWeight: '600', color: '#000000' }}>{getCountryName(video.country_code)}</span>
                        <span style={{ color: '#9ca3af' }}>•</span>
                        <span style={{ fontSize: '14px', color: '#6b7280' }}>{CATEGORY_LABELS[category]}</span>
                      </div>
                      {video.title && (
                        <p style={{ fontSize: '14px', color: '#374151' }}>{video.title}</p>
                      )}
                    </div>
                    <div style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      color: '#f97316',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      Play ▶
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'submissions' ? (
            submissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                <p style={{ fontSize: '48px', marginBottom: '16px' }}>📤</p>
                <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No submissions yet</p>
                <p style={{ fontSize: '14px' }}>Share cultural content from your country!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {submissions.map((video) => (
                  <div
                    key={video.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px',
                      borderRadius: '12px',
                      backgroundColor: '#f9fafb'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '20px' }}>{getCountryFlag(video.country_code)}</span>
                        <span style={{ fontWeight: '600', color: '#000000' }}>{getCountryName(video.country_code)}</span>
                        <span style={{ color: '#9ca3af' }}>•</span>
                        <span style={{ fontSize: '14px', color: '#6b7280' }}>{CATEGORY_LABELS[video.category as VideoCategory]}</span>
                        {renderStatusBadge(video.status)}
                      </div>
                      {video.title && (
                        <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>{video.title}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          onEditSubmission(video.country_code);
                          onClose();
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #d1d5db',
                          color: '#374151',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSubmission(video.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #fee2e2',
                          color: '#ef4444',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fee2e2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Library controls */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={showLibraryFavorites}
                    onChange={(e) => setShowLibraryFavorites(e.target.checked)}
                  />
                  Show Favorites ({favorites.length})
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={showLibrarySubmissions}
                    onChange={(e) => setShowLibrarySubmissions(e.target.checked)}
                  />
                  Show My Submissions ({submissions.length})
                </label>
              </div>

              {/* Library content */}
              {showLibraryFavorites && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', margin: '8px 0' }}>Favorites</h3>
                  {favorites.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontSize: '14px' }}>No favorites yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {favorites.map(({ video, category }) => (
                        <div
                          key={`fav-${video.id}`}
                          onClick={() => onPlayVideo(video, category)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            backgroundColor: '#f9fafb',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '20px' }}>{getCountryFlag(video.country_code)}</span>
                              <span style={{ fontWeight: '600', color: '#000000' }}>{getCountryName(video.country_code)}</span>
                              <span style={{ color: '#9ca3af' }}>•</span>
                              <span style={{ fontSize: '14px', color: '#6b7280' }}>{CATEGORY_LABELS[category]}</span>
                            </div>
                            {video.title && (
                              <p style={{ fontSize: '14px', color: '#374151' }}>{video.title}</p>
                            )}
                          </div>
                          <div style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#ffffff',
                            color: '#f97316',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            Play ▶
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showLibrarySubmissions && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', margin: '8px 0' }}>My Submissions</h3>
                  {submissions.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontSize: '14px' }}>No submissions yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {submissions.map((video) => (
                        <div
                          key={`sub-${video.id}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            backgroundColor: '#f9fafb'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '20px' }}>{getCountryFlag(video.country_code)}</span>
                              <span style={{ fontWeight: '600', color: '#000000' }}>{getCountryName(video.country_code)}</span>
                              <span style={{ color: '#9ca3af' }}>•</span>
                              <span style={{ fontSize: '14px', color: '#6b7280' }}>{CATEGORY_LABELS[video.category as VideoCategory]}</span>
                              {renderStatusBadge(video.status)}
                            </div>
                            {video.title && (
                              <p style={{ fontSize: '14px', color: '#374151' }}>{video.title}</p>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => {
                                onEditSubmission(video.country_code);
                                onClose();
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #d1d5db',
                                color: '#374151',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSubmission(video.id)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #fee2e2',
                                color: '#ef4444',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fee2e2';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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
    </div>
  );
}
