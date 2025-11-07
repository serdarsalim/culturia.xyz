'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, type VideoCategory } from '@/types';
import AdminLayout from '@/components/AdminLayout';

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  flagged: number;
  byCountry: Array<{ country_code: string; count: number }>;
  byCategory: Record<VideoCategory, number>;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    flagged: 0,
    byCountry: [],
    byCategory: {
      inspiration: 0,
      music: 0,
      comedy: 0,
      cooking: 0,
      street_voices: 0,
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

      const total = submissions?.length || 0;
      const pending = submissions?.filter(s => s.status === 'pending').length || 0;
      const approved = submissions?.filter(s => s.status === 'approved').length || 0;
      const rejected = submissions?.filter(s => s.status === 'rejected').length || 0;
      const flagged = submissions?.filter(s => s.flagged).length || 0;

      // Count by country
      const countryMap = new Map<string, number>();
      submissions?.forEach(s => {
        countryMap.set(s.country_code, (countryMap.get(s.country_code) || 0) + 1);
      });

      const byCountry = Array.from(countryMap.entries())
        .map(([country_code, count]) => ({ country_code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Count by category
      const byCategory: Record<VideoCategory, number> = {
        inspiration: 0,
        music: 0,
        comedy: 0,
        cooking: 0,
        street_voices: 0,
      };

      submissions?.forEach(s => {
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
        byCategory,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'Total Submissions', value: stats.total, icon: '📹', color: 'from-blue-500 to-blue-600' },
    { label: 'Pending Review', value: stats.pending, icon: '⏳', color: 'from-yellow-500 to-yellow-600' },
    { label: 'Approved', value: stats.approved, icon: '✅', color: 'from-green-500 to-green-600' },
    { label: 'Rejected', value: stats.rejected, icon: '❌', color: 'from-red-500 to-red-600' },
    { label: 'Flagged', value: stats.flagged, icon: '🚩', color: 'from-orange-500 to-orange-600' },
  ];

  const categoryIcons: Record<VideoCategory, string> = {
    inspiration: '✨',
    music: '🎵',
    comedy: '😂',
    cooking: '🍳',
    street_voices: '🗣️',
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-zinc-400">Overview of all submissions and statistics</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
            <p className="mt-4 text-zinc-400">Loading statistics...</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className={`bg-gradient-to-br ${card.color} rounded-xl p-6 shadow-lg`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">{card.icon}</span>
                    <span className="text-3xl font-bold text-white">{card.value}</span>
                  </div>
                  <h3 className="text-white font-semibold text-sm">{card.label}</h3>
                </div>
              ))}
            </div>

            {/* Country and Category Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Countries */}
              <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
                <h2 className="text-xl font-bold text-white mb-6">Top 5 Countries</h2>
                <div className="space-y-4">
                  {stats.byCountry.map((item, idx) => (
                    <div key={item.country_code} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-amber-500">#{idx + 1}</span>
                        <span className="text-3xl">{getCountryFlag(item.country_code)}</span>
                        <span className="text-white font-medium">{getCountryName(item.country_code)}</span>
                      </div>
                      <span className="text-2xl font-bold text-zinc-400">{item.count}</span>
                    </div>
                  ))}
                  {stats.byCountry.length === 0 && (
                    <p className="text-center text-zinc-500 py-8">No submissions yet</p>
                  )}
                </div>
              </div>

              {/* Category Distribution */}
              <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
                <h2 className="text-xl font-bold text-white mb-6">Submissions by Category</h2>
                <div className="space-y-4">
                  {Object.entries(stats.byCategory).map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{categoryIcons[category as VideoCategory]}</span>
                        <span className="text-white font-medium">
                          {CATEGORY_LABELS[category as VideoCategory]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full transition-all"
                            style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xl font-bold text-zinc-400 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <a
                href="/admin/pending"
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-amber-500 transition-all group"
              >
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl">⏳</span>
                  <div>
                    <h3 className="text-white font-bold text-lg group-hover:text-amber-500 transition-colors">
                      Review Pending
                    </h3>
                    <p className="text-zinc-400 text-sm">Moderate pending submissions</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-500">{stats.pending} pending</p>
              </a>

              <a
                href="/admin/all"
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-amber-500 transition-all group"
              >
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl">📹</span>
                  <div>
                    <h3 className="text-white font-bold text-lg group-hover:text-amber-500 transition-colors">
                      View All
                    </h3>
                    <p className="text-zinc-400 text-sm">Browse all submissions</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-500">{stats.total} total</p>
              </a>

              <a
                href="/admin/rejected"
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-amber-500 transition-all group"
              >
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl">❌</span>
                  <div>
                    <h3 className="text-white font-bold text-lg group-hover:text-amber-500 transition-colors">
                      Rejected
                    </h3>
                    <p className="text-zinc-400 text-sm">Review rejected videos</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-500">{stats.rejected} rejected</p>
              </a>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
