'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, VISIBLE_CATEGORIES, type VideoCategory } from '@/types';
import AdminLayout from '@/components/AdminLayout';

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  flagged: number;
  byCountry: Array<{ country_code: string; count: number }>;
  allCountries: Array<{ country_code: string; count: number }>;
  byCategory: Record<VideoCategory, number>;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    flagged: 0,
    byCountry: [],
    allCountries: [],
    byCategory: {
      inspiration: 0,
      music: 0,
      comedy: 0,
      daily_life: 0,
      talks: 0,
    },
  });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      // Fetch all submissions
      const { data: submissions, error } = await supabase
        .from('video_submissions')
        .select('*');

      if (error) throw error;

      const visibleSubmissions = (submissions || []).filter((submission) =>
        VISIBLE_CATEGORIES.includes(submission.category as VideoCategory)
      );

      const total = visibleSubmissions.length;
      const pending = visibleSubmissions.filter(s => s.status === 'pending').length;
      const approved = visibleSubmissions.filter(s => s.status === 'approved').length;
      const rejected = visibleSubmissions.filter(s => s.status === 'rejected').length;
      const flagged = visibleSubmissions.filter(s => s.flagged).length;

      // Count by country
      const countryMap = new Map<string, number>();
      visibleSubmissions.forEach(s => {
        countryMap.set(s.country_code, (countryMap.get(s.country_code) || 0) + 1);
      });

      const allCountries = Array.from(countryMap.entries())
        .map(([country_code, count]) => ({ country_code, count }))
        .sort((a, b) => b.count - a.count);

      const byCountry = allCountries.slice(0, 5);

      // Count by category
      const byCategory: Record<VideoCategory, number> = {
        inspiration: 0,
        music: 0,
        comedy: 0,
        daily_life: 0,
        talks: 0,
      };

      visibleSubmissions.forEach(s => {
        if (s.category in byCategory) {
          byCategory[s.category as VideoCategory]++;
        }
      });

      setStats({
        total,
        pending,
        approved,
        rejected,
        flagged,
        byCountry,
        allCountries,
        byCategory,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'Total Submissions', value: stats.total, icon: '📹', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
    { label: 'Pending Review', value: stats.pending, icon: '⏳', gradient: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)' },
    { label: 'Approved', value: stats.approved, icon: '✅', gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' },
    { label: 'Rejected', value: stats.rejected, icon: '❌', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { label: 'Flagged', value: stats.flagged, icon: '🚩', gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' },
  ];

  const categoryIcons: Record<VideoCategory, string> = {
    inspiration: '✨',
    music: '🎵',
    comedy: '😂',
    daily_life: '📹',
    talks: '🎤',
  };

  return (
    <AdminLayout>
      <div style={{ padding: '32px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
            Dashboard
          </h1>
          <p style={{ color: '#a1a1aa' }}>Overview of all submissions and statistics</p>
        </div>

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
            <p style={{ marginTop: '16px', color: '#a1a1aa' }}>Loading statistics...</p>
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '24px',
              marginBottom: '32px',
            }}>
              {statCards.map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: card.gradient,
                    borderRadius: '12px',
                    padding: '24px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                  }}>
                    <span style={{ fontSize: '36px' }}>{card.icon}</span>
                    <span style={{ fontSize: '30px', fontWeight: 'bold', color: 'white' }}>
                      {card.value}
                    </span>
                  </div>
                  <h3 style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                    {card.label}
                  </h3>
                </div>
              ))}
            </div>

            {/* Country and Category Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: '24px',
            }}>
              {/* Top Countries */}
              <div style={{
                background: '#18181b',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                border: '1px solid #27272a',
              }}>
                <div
                  onClick={() => setShowAllCountries(!showAllCountries)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '24px',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <h2 style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: 'white',
                    margin: 0,
                  }}>
                    {showAllCountries ? 'All Countries' : `Top 5 Countries`}
                    <span style={{
                      fontSize: '14px',
                      color: '#f59e0b',
                      fontWeight: '600',
                      marginLeft: '12px',
                    }}>
                      {stats.allCountries.length} {stats.allCountries.length === 1 ? 'country' : 'countries'}
                    </span>
                  </h2>
                  <span style={{
                    fontSize: '20px',
                    color: '#a1a1aa',
                  }}>
                    {showAllCountries ? '▼' : '▶'}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: showAllCountries ? '8px' : '16px',
                    maxHeight: showAllCountries ? '500px' : 'none',
                    overflowY: showAllCountries ? 'auto' : 'visible',
                    paddingRight: showAllCountries ? '8px' : '0',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#3f3f46 transparent',
                  }}
                  className="custom-scrollbar"
                >
                  <style jsx>{`
                    .custom-scrollbar::-webkit-scrollbar {
                      width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                      background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                      background-color: #3f3f46;
                      border-radius: 3px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                      background-color: #52525b;
                    }
                  `}</style>
                  {(showAllCountries ? stats.allCountries : stats.byCountry).map((item, idx) => (
                    <div
                      key={item.country_code}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: showAllCountries ? '8px 0' : '0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          fontSize: showAllCountries ? '16px' : '24px',
                          fontWeight: 'bold',
                          color: idx < 3 ? '#f59e0b' : '#71717a',
                          minWidth: showAllCountries ? '40px' : 'auto',
                        }}>
                          #{idx + 1}
                        </span>
                        <span style={{ fontSize: '28px' }}>{getCountryFlag(item.country_code)}</span>
                        <span style={{ color: 'white', fontWeight: '500' }}>
                          {getCountryName(item.country_code)}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#a1a1aa',
                      }}>
                        {item.count}
                      </span>
                    </div>
                  ))}
                  {stats.byCountry.length === 0 && (
                    <p style={{
                      textAlign: 'center',
                      color: '#71717a',
                      padding: '32px 0',
                    }}>
                      No submissions yet
                    </p>
                  )}
                </div>
              </div>

              {/* Category Distribution */}
              <div style={{
                background: '#18181b',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                border: '1px solid #27272a',
              }}>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: 'white',
                  marginBottom: '24px',
                }}>
                  Submissions by Category
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {VISIBLE_CATEGORIES.map((category) => {
                    const count = stats.byCategory[category];
                    return (
                    <div
                      key={category}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>
                          {categoryIcons[category as VideoCategory]}
                        </span>
                        <span style={{ color: 'white', fontWeight: '500' }}>
                          {CATEGORY_LABELS[category as VideoCategory]}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '128px',
                          height: '8px',
                          background: '#27272a',
                          borderRadius: '999px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%',
                            background: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)',
                            borderRadius: '999px',
                            width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                        <span style={{
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#a1a1aa',
                          width: '32px',
                          textAlign: 'right',
                        }}>
                          {count}
                        </span>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{
              marginTop: '32px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
            }}>
              <a
                href="/admin/pending"
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '24px',
                  textDecoration: 'none',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '12px',
                }}>
                  <span style={{ fontSize: '36px' }}>⏳</span>
                  <div>
                    <h3 style={{
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '18px',
                    }}>
                      Review Pending
                    </h3>
                    <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
                      Moderate pending submissions
                    </p>
                  </div>
                </div>
                <p style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#f59e0b',
                }}>
                  {stats.pending} pending
                </p>
              </a>

              <a
                href="/admin/all"
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '24px',
                  textDecoration: 'none',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '12px',
                }}>
                  <span style={{ fontSize: '36px' }}>📹</span>
                  <div>
                    <h3 style={{
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '18px',
                    }}>
                      View All
                    </h3>
                    <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
                      Browse all submissions
                    </p>
                  </div>
                </div>
                <p style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#f59e0b',
                }}>
                  {stats.total} total
                </p>
              </a>

              <a
                href="/admin/rejected"
                style={{
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  padding: '24px',
                  textDecoration: 'none',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '12px',
                }}>
                  <span style={{ fontSize: '36px' }}>❌</span>
                  <div>
                    <h3 style={{
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '18px',
                    }}>
                      Rejected
                    </h3>
                    <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
                      Review rejected videos
                    </p>
                  </div>
                </div>
                <p style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#f59e0b',
                }}>
                  {stats.rejected} rejected
                </p>
              </a>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
