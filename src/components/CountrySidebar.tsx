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
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f3f4f6',
      color: '#000000'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 32px',
        borderBottom: '1px solid #d1d5db',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '36px' }}>{country.flag}</span>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#000000',
              letterSpacing: '-0.01em',
              marginBottom: '4px'
            }}>
              {country.name}
            </h2>
            <p style={{
              fontSize: '12px',
              color: '#6b7280'
            }}>
              {country.languages.slice(0, 2).join(', ')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            cursor: 'pointer',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#e5e7eb',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#d1d5db';
            e.currentTarget.style.color = '#000000';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#e5e7eb';
            e.currentTarget.style.color = '#6b7280';
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Categories */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 32px',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(Object.entries(CATEGORY_LABELS) as [VideoCategory, string][]).map(([category, label]) => {
            const count = videoCounts[category];
            const hasVideos = count > 0;
            const colors = CATEGORY_COLORS[category];

            return (
              <button
                key={category}
                onClick={() => hasVideos && handleCategoryClick(category)}
                disabled={!hasVideos || loading}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: hasVideos ? '1px solid #e5e7eb' : '1px solid #f3f4f6',
                  backgroundColor: hasVideos ? '#ffffff' : '#f9fafb',
                  cursor: hasVideos ? 'pointer' : 'not-allowed',
                  opacity: hasVideos ? 1 : 0.5,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '22px' }}>{colors.icon}</span>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#000000'
                    }}>
                      {label}
                    </span>
                  </div>
                  {loading ? (
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>Loading...</span>
                  ) : hasVideos ? (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#6b7280'
                    }}>
                      {count}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>0</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Submit Button */}
        <button
          onClick={onSubmitClick}
          style={{
            width: '100%',
            marginTop: '24px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '8px',
            backgroundColor: '#f97316',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Submit Videos
        </button>

        {/* Info Text */}
        <p style={{
          marginTop: '12px',
          fontSize: '12px',
          textAlign: 'center',
          color: '#6b7280',
          lineHeight: '1.5'
        }}>
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
