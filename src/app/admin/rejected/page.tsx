'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, type VideoSubmission, type VideoCategory } from '@/types';
import { getYouTubeThumbnail, getYouTubeWatchUrl } from '@/lib/youtube';
import AdminLayout from '@/components/AdminLayout';

export default function RejectedSubmissions() {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  async function fetchSubmissions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('video_submissions')
        .select('*')
        .eq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: 'approved' | 'pending') {
    try {
      const { error } = await supabase
        .from('video_submissions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      showToast(`Submission ${status === 'approved' ? 're-approved' : 'moved to pending'}!`, 'success');
      fetchSubmissions();
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    }
  }

  async function deleteSubmission(id: string) {
    if (!confirm('Are you sure you want to permanently delete this submission?')) {
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

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Rejected Submissions</h1>
          <p className="text-zinc-400">Review rejected videos and re-approve if needed</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white font-medium animate-slide-down`}>
            {toast.message}
          </div>
        )}

        {/* Submissions List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
            <p className="mt-4 text-zinc-400">Loading submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-zinc-900 rounded-xl p-12 text-center border border-zinc-800">
            <span className="text-6xl mb-4 block">🎉</span>
            <p className="text-xl text-zinc-400">No rejected submissions!</p>
            <p className="text-zinc-500 mt-2">Everything looks good</p>
          </div>
        ) : (
          <div className="space-y-6">
            {submissions.map((submission) => (
              <div key={submission.id} className="bg-zinc-900 rounded-xl border border-red-900/50 overflow-hidden">
                <div className="p-6">
                  <div className="flex gap-6">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      <img
                        src={getYouTubeThumbnail(submission.youtube_video_id)}
                        alt="Video thumbnail"
                        className="w-48 h-27 object-cover rounded-lg opacity-75"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">{getCountryFlag(submission.country_code)}</span>
                            <span className="font-semibold text-xl text-white">
                              {getCountryName(submission.country_code)}
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-2xl">{categoryIcons[submission.category as VideoCategory]}</span>
                            <span className="text-zinc-300 font-medium">
                              {CATEGORY_LABELS[submission.category as VideoCategory]}
                            </span>
                          </div>

                          {submission.title && (
                            <p className="text-white text-lg mb-3">{submission.title}</p>
                          )}

                          <div className="space-y-1">
                            <p className="text-sm text-zinc-400">
                              <span className="text-zinc-500">Submitted by:</span> {submission.user_email}
                            </p>
                            <p className="text-sm text-zinc-400">
                              <span className="text-zinc-500">Date:</span>{' '}
                              {new Date(submission.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className="px-4 py-2 bg-red-500/20 border border-red-500 text-red-500 text-sm font-semibold rounded-lg">
                          ❌ REJECTED
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-6">
                        <a
                          href={getYouTubeWatchUrl(submission.youtube_video_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-sm font-medium"
                        >
                          🔗 YouTube
                        </a>

                        <button
                          onClick={() => updateStatus(submission.id, 'approved')}
                          className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-lg shadow-green-600/20"
                        >
                          ✅ Re-Approve
                        </button>

                        <button
                          onClick={() => updateStatus(submission.id, 'pending')}
                          className="px-5 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium shadow-lg shadow-yellow-600/20"
                        >
                          ⏳ Move to Pending
                        </button>

                        <button
                          onClick={() => deleteSubmission(submission.id)}
                          className="px-5 py-2.5 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors text-sm font-medium"
                        >
                          🗑️ Delete
                        </button>
                      </div>
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
