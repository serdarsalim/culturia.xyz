'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryFlag, getCountryName } from '@/lib/countries';
import { type CountryEntry } from '@/types';
import AdminLayout from '@/components/AdminLayout';

interface DashboardStats {
  totalPosts: number;
  publicPosts: number;
  privatePosts: number;
  countries: number;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CountryEntry[]>([]);
  const [privateUserIds, setPrivateUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const [{ data: posts, error: postError }, { data: privateProfiles, error: privacyError }] = await Promise.all([
        supabase.from('country_entries').select('*').order('updated_at', { ascending: false }),
        supabase.from('user_profiles').select('id').eq('is_private', true),
      ]);

      if (postError) throw postError;
      if (privacyError) throw privacyError;

      setEntries((posts || []) as CountryEntry[]);
      setPrivateUserIds(new Set((privateProfiles || []).map((p) => p.id)));
    } catch (error) {
      console.error('Error loading admin dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo<DashboardStats>(() => {
    const countries = new Set(entries.map((entry) => entry.country_code).filter(Boolean));
    const privatePosts = entries.filter((entry) => privateUserIds.has(entry.user_id)).length;

    return {
      totalPosts: entries.length,
      publicPosts: entries.length - privatePosts,
      privatePosts,
      countries: countries.size,
    };
  }, [entries, privateUserIds]);

  const topCountries = useMemo(() => {
    const byCountry = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.country_code) continue;
      byCountry.set(entry.country_code, (byCountry.get(entry.country_code) || 0) + 1);
    }

    return Array.from(byCountry.entries())
      .map(([country_code, count]) => ({ country_code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [entries]);

  return (
    <AdminLayout>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>Dashboard</h1>
          <p style={{ color: '#a1a1aa' }}>Overview of country posts</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '2px solid #f59e0b',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                margin: '0 auto',
                animation: 'spin 1s linear infinite',
              }}
            ></div>
            <p style={{ marginTop: '16px', color: '#a1a1aa' }}>Loading stats...</p>
            <style jsx>{`
              @keyframes spin {
                to {
                  transform: rotate(360deg);
                }
              }
            `}</style>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              {[
                { label: 'Total Posts', value: stats.totalPosts, icon: '📝' },
                { label: 'Public Posts', value: stats.publicPosts, icon: '🌐' },
                { label: 'Private Posts', value: stats.privatePosts, icon: '🔒' },
                { label: 'Countries', value: stats.countries, icon: '🌍' },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '12px',
                    padding: '20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '26px' }}>{card.icon}</span>
                    <span style={{ fontSize: '30px', fontWeight: 700, color: '#fff' }}>{card.value}</span>
                  </div>
                  <div style={{ color: '#a1a1aa', fontSize: '14px', fontWeight: 600 }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>Top Countries by Posts</h2>
              {topCountries.length === 0 ? (
                <p style={{ color: '#71717a' }}>No posts yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {topCountries.map((item, idx) => (
                    <div key={item.country_code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#71717a', width: '24px', textAlign: 'right' }}>{idx + 1}.</span>
                        <span style={{ fontSize: '24px' }}>{getCountryFlag(item.country_code)}</span>
                        <span style={{ color: 'white', fontWeight: 600 }}>{getCountryName(item.country_code)}</span>
                      </div>
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
