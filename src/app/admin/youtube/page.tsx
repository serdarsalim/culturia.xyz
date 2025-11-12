'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, VISIBLE_CATEGORIES, type VideoCategory } from '@/types';
import AdminLayout from '@/components/AdminLayout';

interface CountryData {
  country_code: string;
  categories: {
    [key in VideoCategory]?: number;
  };
  totalVideos: number;
}

interface VideoData {
  id: string;
  youtube_video_id: string;
  title: string;
  country_code: string;
  category: VideoCategory;
}

interface YouTubeStatus {
  connected: boolean;
  email: string | null;
}

interface SyncResult {
  success: boolean;
  playlistsCreated: number;
  playlistsUpdated: number;
  videosAdded: number;
  errors: string[];
  timestamp: string;
}

export default function YouTubePage() {
  const [youtubeStatus, setYoutubeStatus] = useState<YouTubeStatus>({ connected: false, email: null });
  const [loading, setLoading] = useState(true);
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryVideos, setCategoryVideos] = useState<Map<string, VideoData[]>>(new Map());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  useEffect(() => {
    checkYouTubeStatus();
    loadCountryData();
    loadLastSync();
  }, []);

  async function checkYouTubeStatus() {
    try {
      const response = await fetch('/api/auth/youtube/status');
      const data = await response.json();
      setYoutubeStatus(data);
    } catch (error) {
      console.error('Error checking YouTube status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCountryData() {
    try {
      const { data: videos, error } = await supabase
        .from('video_submissions')
        .select('country_code, category')
        .eq('status', 'approved');

      if (error) throw error;

      // Group by country and category
      const grouped = new Map<string, CountryData>();

      for (const video of videos || []) {
        if (!grouped.has(video.country_code)) {
          grouped.set(video.country_code, {
            country_code: video.country_code,
            categories: {},
            totalVideos: 0,
          });
        }

        const countryData = grouped.get(video.country_code)!;
        const category = video.category as VideoCategory;

        countryData.categories[category] = (countryData.categories[category] || 0) + 1;
        countryData.totalVideos++;
      }

      // Convert to array and sort by total videos descending
      const countriesArray = Array.from(grouped.values()).sort(
        (a, b) => b.totalVideos - a.totalVideos
      );

      setCountryData(countriesArray);
    } catch (error) {
      console.error('Error loading country data:', error);
    }
  }

  async function loadLastSync() {
    try {
      const { data, error } = await supabase
        .from('youtube_sync_logs')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setLastSync(data.synced_at);
      }
    } catch (error) {
      console.error('Error loading last sync:', error);
    }
  }

  async function handleConnect() {
    try {
      const response = await fetch('/api/auth/youtube');
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error connecting YouTube:', error);
      alert('Failed to connect YouTube');
    }
  }

  async function confirmDisconnect() {
    setShowDisconnectModal(false);

    try {
      await fetch('/api/auth/youtube/disconnect', { method: 'POST' });
      setYoutubeStatus({ connected: false, email: null });
      // Show success in sync result banner
      setSyncResult({
        success: true,
        playlistsCreated: 0,
        playlistsUpdated: 0,
        videosAdded: 0,
        errors: [],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setErrorDetails(['Failed to disconnect YouTube. Please try again.']);
      setShowErrorModal(true);
    }
  }

  async function handleSync(type: 'all' | 'country' | 'category', countryCode?: string, category?: VideoCategory) {
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch('/api/admin/youtube/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          country_code: countryCode,
          category,
        }),
      });

      const result = await response.json();
      setSyncResult(result);
      setLastSync(result.timestamp);

      if (result.success) {
        // Success - no errors
        setErrorDetails([]);
      } else {
        // Has errors - show modal
        setErrorDetails(result.errors || []);
        setShowErrorModal(true);
      }
    } catch (error: any) {
      setErrorDetails([error.message || 'Unknown error occurred']);
      setShowErrorModal(true);
    } finally {
      setSyncing(false);
    }
  }

  function toggleCountry(countryCode: string) {
    const newExpanded = new Set(expandedCountries);
    if (newExpanded.has(countryCode)) {
      newExpanded.delete(countryCode);
    } else {
      newExpanded.add(countryCode);
    }
    setExpandedCountries(newExpanded);
  }

  async function toggleCategory(countryCode: string, category: VideoCategory) {
    const key = `${countryCode}-${category}`;
    const newExpanded = new Set(expandedCategories);

    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);

      // Load videos if not already loaded
      if (!categoryVideos.has(key)) {
        try {
          const { data: videos, error } = await supabase
            .from('video_submissions')
            .select('id, youtube_video_id, title, country_code, category')
            .eq('status', 'approved')
            .eq('country_code', countryCode)
            .eq('category', category)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const newVideosMap = new Map(categoryVideos);
          newVideosMap.set(key, videos || []);
          setCategoryVideos(newVideosMap);
        } catch (error) {
          console.error('Error loading videos:', error);
        }
      }
    }

    setExpandedCategories(newExpanded);
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ padding: '40px', color: '#ffffff' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '20px' }}>YouTube Sync</h1>
          <p>Loading...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ padding: '40px', color: '#ffffff', maxWidth: '1200px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px' }}>YouTube Sync</h1>

      {/* Connection Status */}
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333333',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Connection Status</div>
        {youtubeStatus.connected ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px' }}>✓</span>
              <div>
                <div style={{ fontSize: '14px', color: '#10b981', fontWeight: 600 }}>Connected</div>
                <div style={{ fontSize: '13px', color: '#9ca3af' }}>{youtubeStatus.email}</div>
              </div>
            </div>
            <button
              onClick={() => setShowDisconnectModal(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#374151',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>
              Not connected. Connect your YouTube account to sync playlists.
            </div>
            <button
              onClick={handleConnect}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            >
              Connect YouTube Account
            </button>
          </div>
        )}
      </div>

      {/* YouTube API Limits Warning */}
      {youtubeStatus.connected && (
        <div style={{
          backgroundColor: '#7f1d1d',
          border: '1px solid #ef4444',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '32px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fca5a5', marginBottom: '8px' }}>
            ⚠️ YouTube API Limits
          </div>
          <div style={{ fontSize: '13px', color: '#fecaca', lineHeight: 1.6 }}>
            YouTube limits playlist creation to <strong>~50 playlists per day per channel</strong>.
            <br />
            Sync countries individually to avoid hitting limits. Each country/category combination creates one playlist.
          </div>
        </div>
      )}

      {/* Last Sync Info */}
      {lastSync && (
        <div style={{
          fontSize: '13px',
          color: '#9ca3af',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          Last sync: {formatTimestamp(lastSync)}
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div style={{
          backgroundColor: syncResult.success ? '#065f46' : '#7f1d1d',
          border: '1px solid ' + (syncResult.success ? '#10b981' : '#ef4444'),
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>
            {syncResult.videosAdded === 0 && syncResult.playlistsCreated === 0 && syncResult.playlistsUpdated === 0
              ? '✓ YouTube Disconnected Successfully'
              : syncResult.success ? '✓ Sync Successful' : '⚠ Sync Completed with Errors'}
          </div>
          {(syncResult.videosAdded > 0 || syncResult.playlistsCreated > 0 || syncResult.playlistsUpdated > 0) ? (
            <div style={{ fontSize: '13px' }}>
              {syncResult.videosAdded || 0} videos synced to {(syncResult.playlistsCreated || 0) + (syncResult.playlistsUpdated || 0)} playlists
              ({syncResult.playlistsCreated || 0} created, {syncResult.playlistsUpdated || 0} updated)
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>
              No new videos to sync. All playlists are up to date.
            </div>
          )}
        </div>
      )}

      {/* Countries List */}
      {youtubeStatus.connected && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>
            Countries with Approved Videos
          </h2>
          {countryData.length === 0 ? (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>
              No approved videos yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {countryData.map((country) => {
                const isExpanded = expandedCountries.has(country.country_code);
                const flag = getCountryFlag(country.country_code);
                const name = getCountryName(country.country_code);

                return (
                  <div
                    key={country.country_code}
                    style={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333333',
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Country Header */}
                    <div
                      onClick={() => toggleCountry(country.country_code)}
                      style={{
                        padding: '16px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>{flag}</span>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 600 }}>{name}</div>
                          <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                            {country.totalVideos} {country.totalVideos === 1 ? 'video' : 'videos'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSync('country', country.country_code);
                          }}
                          disabled={syncing}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: syncing ? '#4b5563' : '#3b82f6',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: syncing ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!syncing) e.currentTarget.style.backgroundColor = '#2563eb';
                          }}
                          onMouseLeave={(e) => {
                            if (!syncing) e.currentTarget.style.backgroundColor = '#3b82f6';
                          }}
                        >
                          Sync
                        </button>
                        <span style={{
                          fontSize: '20px',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s'
                        }}>
                          ▼
                        </span>
                      </div>
                    </div>

                    {/* Categories */}
                    {isExpanded && (
                      <div style={{
                        borderTop: '1px solid #333333',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        {VISIBLE_CATEGORIES.map((category) => {
                          const count = country.categories[category];
                          if (!count) return null;

                          const categoryKey = `${country.country_code}-${category}`;
                          const isCategoryExpanded = expandedCategories.has(categoryKey);
                          const videos = categoryVideos.get(categoryKey) || [];

                          return (
                            <div
                              key={category}
                              style={{
                                backgroundColor: '#0a0a0a',
                                borderRadius: '8px',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Category Header */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 16px'
                                }}
                              >
                                <div
                                  onClick={() => toggleCategory(country.country_code, category)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    flex: 1
                                  }}
                                >
                                  <span style={{
                                    fontSize: '16px',
                                    transform: isCategoryExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s'
                                  }}>
                                    ▼
                                  </span>
                                  <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                                      {CATEGORY_LABELS[category]}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                      {count} {count === 1 ? 'video' : 'videos'}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleSync('category', country.country_code, category)}
                                  disabled={syncing}
                                  style={{
                                    padding: '8px 16px',
                                    backgroundColor: syncing ? '#4b5563' : '#374151',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: syncing ? 'not-allowed' : 'pointer',
                                    transition: 'background-color 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!syncing) e.currentTarget.style.backgroundColor = '#4b5563';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!syncing) e.currentTarget.style.backgroundColor = '#374151';
                                  }}
                                >
                                  Sync
                                </button>
                              </div>

                              {/* Videos List */}
                              {isCategoryExpanded && videos.length > 0 && (
                                <div style={{
                                  borderTop: '1px solid #1a1a1a',
                                  padding: '8px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px'
                                }}>
                                  {videos.map((video) => (
                                    <a
                                      key={video.id}
                                      href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#000000',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        color: '#9ca3af',
                                        textDecoration: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#1a1a1a';
                                        e.currentTarget.style.color = '#ffffff';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#000000';
                                        e.currentTarget.style.color = '#9ca3af';
                                      }}
                                    >
                                      <span style={{ fontSize: '14px' }}>▶️</span>
                                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {video.title}
                                      </span>
                                      <span style={{ fontSize: '12px', opacity: 0.5 }}>↗</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
          onClick={() => setShowDisconnectModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1a1a',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              border: '1px solid #f97316',
              boxShadow: '0 25px 50px -12px rgba(249, 115, 22, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #333333'
            }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#f97316', marginBottom: '8px' }}>
                🔌 Disconnect YouTube?
              </h2>
              <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.6 }}>
                Are you sure you want to disconnect your YouTube account? You'll need to reconnect to sync playlists again.
              </p>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowDisconnectModal(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#374151',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnect}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
          onClick={() => setShowErrorModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1a1a1a',
              borderRadius: '16px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'hidden',
              border: '1px solid #ef4444',
              boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #333333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444', marginBottom: '4px' }}>
                  ⚠️ Sync Errors
                </h2>
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                  {errorDetails.length} error{errorDetails.length !== 1 ? 's' : ''} occurred during sync
                </p>
              </div>
              <button
                onClick={() => setShowErrorModal(false)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#333333',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#333333'}
              >
                ✕
              </button>
            </div>

            {/* Error List */}
            <div style={{
              padding: '24px',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              {errorDetails.some(err => err.includes('insufficient authentication scopes')) && (
                <div style={{
                  backgroundColor: '#7f1d1d',
                  border: '1px solid #ef4444',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#fca5a5', marginBottom: '8px' }}>
                    🔒 Authentication Issue Detected
                  </div>
                  <div style={{ fontSize: '14px', color: '#fecaca', lineHeight: 1.6 }}>
                    Your YouTube connection doesn't have the required permissions.
                    <br /><br />
                    <strong>To fix this:</strong>
                    <ol style={{ marginTop: '8px', marginLeft: '20px' }}>
                      <li>Click "Disconnect" at the top of this page</li>
                      <li>Click "Connect YouTube Account" again</li>
                      <li>Make sure to grant "Manage your YouTube account" permission</li>
                      <li>Try syncing again</li>
                    </ol>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '14px', fontWeight: 600, color: '#9ca3af', marginBottom: '12px' }}>
                Error Details:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {errorDetails.map((error, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '8px',
                      border: '1px solid #333333',
                      fontSize: '13px',
                      color: '#ffffff',
                      fontFamily: 'monospace'
                    }}
                  >
                    {error}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #333333',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowErrorModal(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
