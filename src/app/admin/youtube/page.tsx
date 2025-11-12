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
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

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

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect YouTube?')) {
      return;
    }

    try {
      await fetch('/api/auth/youtube/disconnect', { method: 'POST' });
      setYoutubeStatus({ connected: false, email: null });
      alert('YouTube disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting YouTube:', error);
      alert('Failed to disconnect YouTube');
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
        alert(`Sync successful! ${result.videosAdded} videos synced to ${result.playlistsCreated + result.playlistsUpdated} playlists.`);
      } else {
        alert(`Sync completed with errors. ${result.videosAdded} videos synced. Check console for details.`);
        console.error('Sync errors:', result.errors);
      }
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Sync failed. Please try again.');
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
              onClick={handleDisconnect}
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

      {/* Sync All Button */}
      {youtubeStatus.connected && (
        <div style={{ marginBottom: '32px' }}>
          <button
            onClick={() => handleSync('all')}
            disabled={syncing}
            style={{
              padding: '16px 32px',
              backgroundColor: syncing ? '#4b5563' : '#f97316',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: syncing ? 'not-allowed' : 'pointer',
              width: '100%',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!syncing) e.currentTarget.style.backgroundColor = '#ea580c';
            }}
            onMouseLeave={(e) => {
              if (!syncing) e.currentTarget.style.backgroundColor = '#f97316';
            }}
          >
            {syncing ? '🔄 Syncing...' : '🔄 Sync All Countries'}
          </button>
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
            {syncResult.success ? '✓ Sync Successful' : '⚠ Sync Completed with Errors'}
          </div>
          <div style={{ fontSize: '13px' }}>
            {syncResult.videosAdded} videos synced to {syncResult.playlistsCreated + syncResult.playlistsUpdated} playlists
            ({syncResult.playlistsCreated} created, {syncResult.playlistsUpdated} updated)
          </div>
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
                          Sync All
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

                          return (
                            <div
                              key={category}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                backgroundColor: '#0a0a0a',
                                borderRadius: '8px'
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                                  {CATEGORY_LABELS[category]}
                                </div>
                                <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                  {count} {count === 1 ? 'video' : 'videos'}
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
      </div>
    </AdminLayout>
  );
}
