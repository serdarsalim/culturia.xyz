'use client';

import { useState, useEffect } from 'react';
import { getCountryByCode } from '@/lib/countries';
import { CATEGORY_LABELS, type VideoCategory, type VideoSubmission } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface CountrySidebarProps {
  countryCode: string;
  onClose: () => void;
  onVideoSelect: (video: VideoSubmission, category: VideoCategory) => void;
  onSubmitClick: () => void;
}

// Color schemes for each category
const CATEGORY_COLORS = {
  inspiration: {
    bg: 'from-yellow-50 to-orange-50',
    border: 'border-orange-300',
    hoverBg: 'hover:bg-gradient-to-br hover:from-yellow-100 hover:to-orange-100',
    hoverBorder: 'hover:border-orange-400',
    text: 'text-orange-700',
    icon: '💡',
  },
  music: {
    bg: 'from-pink-50 to-rose-50',
    border: 'border-pink-300',
    hoverBg: 'hover:bg-gradient-to-br hover:from-pink-100 hover:to-rose-100',
    hoverBorder: 'hover:border-pink-400',
    text: 'text-pink-700',
    icon: '🎵',
  },
  comedy: {
    bg: 'from-green-50 to-emerald-50',
    border: 'border-green-300',
    hoverBg: 'hover:bg-gradient-to-br hover:from-green-100 hover:to-emerald-100',
    hoverBorder: 'hover:border-green-400',
    text: 'text-green-700',
    icon: '😄',
  },
  cooking: {
    bg: 'from-red-50 to-orange-50',
    border: 'border-red-300',
    hoverBg: 'hover:bg-gradient-to-br hover:from-red-100 hover:to-orange-100',
    hoverBorder: 'hover:border-red-400',
    text: 'text-red-700',
    icon: '🍳',
  },
  street_voices: {
    bg: 'from-blue-50 to-indigo-50',
    border: 'border-blue-300',
    hoverBg: 'hover:bg-gradient-to-br hover:from-blue-100 hover:to-indigo-100',
    hoverBorder: 'hover:border-blue-400',
    text: 'text-blue-700',
    icon: '🎤',
  },
};

export default function CountrySidebar({
  countryCode,
  onClose,
  onVideoSelect,
  onSubmitClick,
}: CountrySidebarProps) {
  const country = getCountryByCode(countryCode);
  const [videoCounts, setVideoCounts] = useState<Record<VideoCategory, number>>({
    inspiration: 0,
    music: 0,
    comedy: 0,
    cooking: 0,
    street_voices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVideoCounts() {
      try {
        setLoading(true);
        const categories: VideoCategory[] = ['inspiration', 'music', 'comedy', 'cooking', 'street_voices'];

        const counts: Record<VideoCategory, number> = {
          inspiration: 0,
          music: 0,
          comedy: 0,
          cooking: 0,
          street_voices: 0,
        };

        for (const category of categories) {
          const { count, error } = await supabase
            .from('video_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('country_code', countryCode)
            .eq('category', category)
            .eq('status', 'approved');

          if (!error && count !== null) {
            counts[category] = count;
          }
        }

        setVideoCounts(counts);
      } catch (error) {
        console.error('Error fetching video counts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchVideoCounts();
  }, [countryCode]);

  async function handleCategoryClick(category: VideoCategory) {
    try {
      // Fetch random approved video for this category
      const { data, error } = await supabase
        .from('video_submissions')
        .select('*')
        .eq('country_code', countryCode)
        .eq('category', category)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching videos:', error);
        return;
      }

      if (data && data.length > 0) {
        // Pick random video from latest 10
        const randomVideo = data[Math.floor(Math.random() * data.length)];
        onVideoSelect(randomVideo, category);
      }
    } catch (error) {
      console.error('Error fetching video:', error);
    }
  }

  if (!country) {
    console.log('CountrySidebar: No country found for code:', countryCode);
    return null;
  }

  console.log('CountrySidebar rendering for:', country.name);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-5xl drop-shadow-lg">{country.flag}</span>
          <div>
            <h2 className="text-2xl font-bold text-white drop-shadow-md">
              {country.name}
            </h2>
            <p className="text-sm text-slate-300">
              {country.languages.slice(0, 2).join(', ')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="space-y-3">
          {(Object.entries(CATEGORY_LABELS) as [VideoCategory, string][]).map(([category, label]) => {
            const count = videoCounts[category];
            const hasVideos = count > 0;
            const colors = CATEGORY_COLORS[category];

            return (
              <button
                key={category}
                onClick={() => hasVideos && handleCategoryClick(category)}
                disabled={!hasVideos || loading}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all transform hover:scale-105 shadow-lg ${
                  hasVideos
                    ? `bg-gradient-to-br ${colors.bg} ${colors.border} ${colors.hoverBg} ${colors.hoverBorder} cursor-pointer hover:shadow-xl`
                    : 'border-slate-600 bg-slate-700/50 cursor-not-allowed opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{colors.icon}</span>
                    <span className={`font-semibold ${hasVideos ? colors.text : 'text-slate-500'}`}>
                      {label}
                    </span>
                  </div>
                  {loading ? (
                    <span className="text-sm text-slate-400">Loading...</span>
                  ) : hasVideos ? (
                    <span className={`text-sm font-semibold ${colors.text}`}>
                      {count} video{count !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500">No videos yet</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Submit Button */}
        <button
          onClick={onSubmitClick}
          className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-2xl"
        >
          ✨ Submit Videos
        </button>

        {/* Info Text */}
        <p className="mt-4 text-sm text-slate-400 text-center">
          Help build our cultural library by submitting videos
        </p>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(51, 65, 85, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.7);
        }
      `}</style>
    </div>
  );
}
