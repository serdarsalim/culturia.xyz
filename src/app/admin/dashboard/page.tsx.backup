'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, type VideoSubmission, type VideoCategory } from '@/types';
import { getYouTubeThumbnail, getYouTubeWatchUrl } from '@/lib/youtube';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'flagged'>('pending');
  const [adminUser, setAdminUser] = useState<any>(null);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/admin');
        return;
      }

      const { data: admin } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!admin) {
        await supabase.auth.signOut();
        router.push('/admin');
        return;
      }

      setAdminUser(admin);
      fetchSubmissions();
    }

    checkAuth();
  }, [router, filter]);

  async function fetchSubmissions() {
    setLoading(true);
    try {
      let query = supabase
        .from('video_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'flagged') {
        query = query.eq('flagged', true);
      } else if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected' | 'pending') {
    try {
      const { error } = await supabase
        .from('video_submissions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      // Refresh submissions
      fetchSubmissions();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  }

  async function deleteSubmission(id: string) {
    if (!confirm('Are you sure you want to delete this submission?')) return;

    try {
      const { error } = await supabase
        .from('video_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchSubmissions();
    } catch (error) {
      console.error('Error deleting submission:', error);
      alert('Failed to delete submission');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/admin');
  }

  if (!adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl font-bold">C</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">CULTURIA Admin</h1>
                <p className="text-sm text-gray-600">{adminUser.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                View Site
              </a>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            {[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'flagged', label: 'Flagged' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value as any)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filter === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submissions List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading submissions...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">No submissions found</p>
            </div>
          ) : (
            submissions.map((submission) => (
              <div key={submission.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex gap-6">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <img
                      src={getYouTubeThumbnail(submission.youtube_video_id)}
                      alt="Video thumbnail"
                      className="w-48 h-27 object-cover rounded-lg"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{getCountryFlag(submission.country_code)}</span>
                          <span className="font-semibold text-lg">{getCountryName(submission.country_code)}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-600">{CATEGORY_LABELS[submission.category as VideoCategory]}</span>
                        </div>

                        {submission.title && (
                          <p className="text-gray-700 mb-2">{submission.title}</p>
                        )}

                        <p className="text-sm text-gray-500">
                          Submitted by: {submission.user_email}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(submission.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        {submission.flagged && (
                          <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                            Flagged ({submission.flag_count})
                          </span>
                        )}
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            submission.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : submission.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {submission.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Flag Reasons */}
                    {submission.flagged && submission.flag_reasons.length > 0 && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-semibold text-red-900 mb-1">Flag Reasons:</p>
                        <ul className="text-sm text-red-800 space-y-1">
                          {submission.flag_reasons.map((reason, idx) => (
                            <li key={idx}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <a
                        href={getYouTubeWatchUrl(submission.youtube_video_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                      >
                        Watch on YouTube
                      </a>

                      {submission.status !== 'approved' && (
                        <button
                          onClick={() => updateStatus(submission.id, 'approved')}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          Approve
                        </button>
                      )}

                      {submission.status !== 'rejected' && (
                        <button
                          onClick={() => updateStatus(submission.id, 'rejected')}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          Reject
                        </button>
                      )}

                      {submission.status !== 'pending' && (
                        <button
                          onClick={() => updateStatus(submission.id, 'pending')}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                        >
                          Mark Pending
                        </button>
                      )}

                      <button
                        onClick={() => deleteSubmission(submission.id)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
