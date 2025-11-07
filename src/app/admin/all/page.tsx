'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag, getAllCountries } from '@/lib/countries';
import { CATEGORY_LABELS, type VideoSubmission, type VideoCategory } from '@/types';
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
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSubmissions(data || []);
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
    cooking: '🍳',
    street_voices: '🗣️',
  };

  // Get unique countries from submissions
  const uniqueCountries = Array.from(new Set(submissions.map(s => s.country_code))).sort();

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">All Submissions</h1>
          <p className="text-zinc-400">Browse and manage all video submissions</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white font-medium animate-slide-down`}>
            {toast.message}
          </div>
        )}

        {/* Filters */}
        <div className="bg-zinc-900 rounded-xl p-6 mb-6 border border-zinc-800">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Country Filter */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Country</label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
              <label className="block text-sm font-medium text-zinc-400 mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title, URL, email..."
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 pt-4 border-t border-zinc-800 text-sm text-zinc-400">
            Showing <span className="text-white font-semibold">{filteredSubmissions.length}</span> of{' '}
            <span className="text-white font-semibold">{submissions.length}</span> submissions
          </div>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
            <p className="mt-4 text-zinc-400">Loading submissions...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="bg-zinc-900 rounded-xl p-12 text-center border border-zinc-800">
            <span className="text-6xl mb-4 block">🔍</span>
            <p className="text-xl text-zinc-400">No submissions found</p>
            <p className="text-zinc-500 mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSubmissions.map((submission) => (
              <div key={submission.id} className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 hover:border-zinc-700 transition-colors">
                <div className="flex gap-5">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <img
                      src={getYouTubeThumbnail(submission.youtube_video_id)}
                      alt="Video thumbnail"
                      className="w-40 h-24 object-cover rounded-lg"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{getCountryFlag(submission.country_code)}</span>
                          <span className="font-semibold text-white">{getCountryName(submission.country_code)}</span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-xl">{categoryIcons[submission.category as VideoCategory]}</span>
                          <span className="text-zinc-300 text-sm">
                            {CATEGORY_LABELS[submission.category as VideoCategory]}
                          </span>
                        </div>

                        {submission.title && (
                          <p className="text-white mb-2 truncate">{submission.title}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span>{submission.user_email}</span>
                          <span>•</span>
                          <span>{new Date(submission.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap ${
                        submission.status === 'approved'
                          ? 'bg-green-500/20 border border-green-500 text-green-500'
                          : submission.status === 'rejected'
                          ? 'bg-red-500/20 border border-red-500 text-red-500'
                          : 'bg-yellow-500/20 border border-yellow-500 text-yellow-500'
                      }`}>
                        {submission.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3">
                      <a
                        href={getYouTubeWatchUrl(submission.youtube_video_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs font-medium"
                      >
                        YouTube
                      </a>

                      {submission.status !== 'approved' && (
                        <button
                          onClick={() => updateStatus(submission.id, 'approved')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                        >
                          Approve
                        </button>
                      )}

                      {submission.status !== 'rejected' && (
                        <button
                          onClick={() => updateStatus(submission.id, 'rejected')}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium"
                        >
                          Reject
                        </button>
                      )}

                      {submission.status !== 'pending' && (
                        <button
                          onClick={() => updateStatus(submission.id, 'pending')}
                          className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-xs font-medium"
                        >
                          Pending
                        </button>
                      )}

                      <button
                        onClick={() => deleteSubmission(submission.id)}
                        className="px-3 py-1.5 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors text-xs font-medium"
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
