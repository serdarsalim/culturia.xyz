'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, VISIBLE_CATEGORIES, type VideoSubmission, type VideoCategory } from '@/types';
import { getYouTubeThumbnail, getYouTubeWatchUrl } from '@/lib/youtube';
import AdminLayout from '@/components/AdminLayout';

export default function AllSubmissions() {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<VideoSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | VideoCategory>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [submissions, statusFilter, categoryFilter, countryFilter, searchQuery]);

  async function fetchSubmissions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('video_submissions')
        .select('*')
        .in('status', ['pending', 'approved', 'rejected'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const filtered = (data || []).filter((submission) =>
        VISIBLE_CATEGORIES.includes(submission.category as VideoCategory)
      );

      setSubmissions(filtered);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...submissions];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(s => s.category === categoryFilter);
    }

    // Country filter
    if (countryFilter !== 'all') {
      filtered = filtered.filter(s => s.country_code === countryFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.title?.toLowerCase().includes(query) ||
        s.youtube_url.toLowerCase().includes(query) ||
        s.user_email.toLowerCase().includes(query) ||
        getCountryName(s.country_code).toLowerCase().includes(query)
      );
    }

    setFilteredSubmissions(filtered);
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected' | 'pending') {
    try {
      const { error } = await supabase
        .from('video_submissions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      showToast(`Status updated to ${status}!`, 'success');
      fetchSubmissions();
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    }
  }

  async function deleteSubmission(id: string) {
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('video_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showToast('Submission deleted successfully!', 'success');
      fetchSubmissions();
    } catch (error) {
      console.error('Error deleting submission:', error);
      showToast('Failed to delete submission', 'error');
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
    daily_life: '📹',
    talks: '🎤',
  };

  // Get unique countries from submissions
  const uniqueCountries = Array.from(new Set(submissions.map(s => s.country_code))).sort();

  return (
    <AdminLayout>
      <div style={{ padding: '32px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
            All Submissions
          </h1>
          <p style={{ color: '#a1a1aa' }}>Browse and manage all video submissions</p>
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

        {/* Filters */}
        <div style={{
          background: '#18181b',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #27272a',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}>
            {/* Status Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '8px',
              }}>
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '8px',
              }}>
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="all">All Categories</option>
                {VISIBLE_CATEGORIES.map((key) => (
                  <option key={key} value={key}>
                    {CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            {/* Country Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '8px',
              }}>
                Country
              </label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="all">All Countries</option>
                {uniqueCountries.map(code => (
                  <option key={code} value={code}>
                    {getCountryName(code)}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#a1a1aa',
                marginBottom: '8px',
              }}>
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title, URL, email..."
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Results count */}
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #27272a',
            fontSize: '14px',
            color: '#a1a1aa',
          }}>
            Showing <span style={{ color: 'white', fontWeight: '600' }}>{filteredSubmissions.length}</span> of{' '}
            <span style={{ color: 'white', fontWeight: '600' }}>{submissions.length}</span> submissions
          </div>
        </div>

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
        ) : filteredSubmissions.length === 0 ? (
          <div style={{
            background: '#18181b',
            borderRadius: '12px',
            padding: '48px',
            textAlign: 'center',
            border: '1px solid #27272a',
          }}>
            <span style={{ fontSize: '60px', display: 'block', marginBottom: '16px' }}>🔍</span>
            <p style={{ fontSize: '20px', color: '#a1a1aa' }}>No submissions found</p>
            <p style={{ color: '#71717a', marginTop: '8px' }}>Try adjusting your filters</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredSubmissions.map((submission) => (
              <div key={submission.id} style={{
                background: '#18181b',
                borderRadius: '12px',
                border: '1px solid #27272a',
                padding: '20px',
                transition: 'border-color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = '#27272a'}>
                <div style={{ display: 'flex', gap: '20px' }}>
                  {/* Thumbnail */}
                  <div style={{ flexShrink: 0 }}>
                    <img
                      src={getYouTubeThumbnail(submission.youtube_video_id)}
                      alt="Video thumbnail"
                      style={{
                        width: '160px',
                        height: '96px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                      }}
                    />
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '16px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px',
                        }}>
                          <span style={{ fontSize: '24px' }}>{getCountryFlag(submission.country_code)}</span>
                          <span style={{ fontWeight: '600', color: 'white' }}>{getCountryName(submission.country_code)}</span>
                          <span style={{ color: '#52525b' }}>•</span>
                          <span style={{ fontSize: '20px' }}>{categoryIcons[submission.category as VideoCategory]}</span>
                          <span style={{ color: '#d4d4d8', fontSize: '14px' }}>
                            {CATEGORY_LABELS[submission.category as VideoCategory]}
                          </span>
                        </div>

                        {submission.title && (
                          <p style={{
                            color: 'white',
                            marginBottom: '8px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {submission.title}
                          </p>
                        )}

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          fontSize: '12px',
                          color: '#71717a',
                        }}>
                          <span>{submission.user_email}</span>
                          <span>•</span>
                          <span>{new Date(submission.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '8px',
                        whiteSpace: 'nowrap',
                        background: submission.status === 'approved'
                          ? 'rgba(34, 197, 94, 0.2)'
                          : submission.status === 'rejected'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : 'rgba(234, 179, 8, 0.2)',
                        border: submission.status === 'approved'
                          ? '1px solid #22c55e'
                          : submission.status === 'rejected'
                          ? '1px solid #ef4444'
                          : '1px solid #eab308',
                        color: submission.status === 'approved'
                          ? '#22c55e'
                          : submission.status === 'rejected'
                          ? '#ef4444'
                          : '#eab308',
                      }}>
                        {submission.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '12px',
                    }}>
                      <a
                        href={getYouTubeWatchUrl(submission.youtube_video_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '6px 12px',
                          background: '#27272a',
                          color: 'white',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '500',
                          textDecoration: 'none',
                          transition: 'background 0.2s',
                          display: 'inline-block',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#3f3f46'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#27272a'}
                      >
                        YouTube
                      </a>

                      {submission.status !== 'approved' && (
                        <button
                          onClick={() => updateStatus(submission.id, 'approved')}
                          style={{
                            padding: '6px 12px',
                            background: '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#15803d'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#16a34a'}
                        >
                          Approve
                        </button>
                      )}

                      {submission.status !== 'rejected' && (
                        <button
                          onClick={() => updateStatus(submission.id, 'rejected')}
                          style={{
                            padding: '6px 12px',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#b91c1c'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#dc2626'}
                        >
                          Reject
                        </button>
                      )}

                      {submission.status !== 'pending' && (
                        <button
                          onClick={() => updateStatus(submission.id, 'pending')}
                          style={{
                            padding: '6px 12px',
                            background: '#ca8a04',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#a16207'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#ca8a04'}
                        >
                          Pending
                        </button>
                      )}

                      <button
                        onClick={() => deleteSubmission(submission.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#3f3f46',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#52525b'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#3f3f46'}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
