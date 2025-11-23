'use client';

import { useState, useEffect } from 'react';
import { getCountryByCode } from '@/lib/countries';
import { CATEGORY_LABELS, VISIBLE_CATEGORIES, type VideoCategory, type VideoSubmission } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface CountrySidebarProps {
  countryCode: string;
  onClose: () => void;
  onVideoSelect: (video: VideoSubmission, category: VideoCategory) => void;
  onSubmitClick: () => void;
  videoCache: VideoSubmission[];
  videoCacheReady: boolean;
  signedInLabel?: string | null;
  selectedCategoryFilter: VideoCategory | null;
  onCategoryFilterToggle: (category: VideoCategory) => void;
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
  daily_life: {
    bg: 'from-red-50 to-orange-50',
    border: 'border-red-300',
    hoverBg: 'hover:bg-gradient-to-br hover:from-red-100 hover:to-orange-100',
    hoverBorder: 'hover:border-red-400',
    text: 'text-red-700',
    icon: '📹',
  },
  talks: {
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
  videoCache,
  videoCacheReady,
  signedInLabel,
  selectedCategoryFilter,
  onCategoryFilterToggle,
}: CountrySidebarProps) {
  const country = getCountryByCode(countryCode);
  const [videoCounts, setVideoCounts] = useState<Record<VideoCategory, number>>({
    inspiration: 0,
    music: 0,
    comedy: 0,
    daily_life: 0,
    talks: 0,
  });
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate video counts from cache
  useEffect(() => {
    if (videoCacheReady) {
      const counts: Record<VideoCategory, number> = {
        inspiration: 0,
        music: 0,
        comedy: 0,
        daily_life: 0,
        talks: 0,
      };

      // Filter and count videos for this country
      videoCache
        .filter(v => v.country_code === countryCode)
        .forEach(v => {
          counts[v.category as VideoCategory]++;
        });

      setVideoCounts(counts);
    }
  }, [countryCode, videoCache, videoCacheReady]);

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
        padding: isMobile ? '12px 24px' : '24px 32px',
        borderBottom: '1px solid #d1d5db',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px' }}>
          <span style={{ fontSize: isMobile ? '28px' : '36px' }}>{country.flag}</span>
          <div>
            {isMobile ? (
              <h2 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#000000',
                letterSpacing: '-0.01em'
              }}>
                {country.name} <span style={{ fontSize: '13px', fontWeight: '400', color: '#6b7280', fontFamily: 'monospace' }}>({country.languages[0]})</span>
              </h2>
            ) : (
              <>
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
              </>
            )}
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
        padding: isMobile ? '12px 16px' : '16px 20px',
        backgroundColor: '#f3f4f6'
      }}>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {VISIBLE_CATEGORIES.map((category) => {
              const label = CATEGORY_LABELS[category];
              const count = videoCounts[category];
              const hasVideos = count > 0;
              const colors = CATEGORY_COLORS[category];
              const isSelected = selectedCategoryFilter === category;
              return (
                <button
                  key={category}
                  onClick={() => hasVideos && onCategoryFilterToggle(category)}
                  disabled={!hasVideos || !videoCacheReady}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: isSelected
                      ? '2px solid #f97316'
                      : hasVideos
                        ? '1px solid rgba(148, 163, 184, 0.4)'
                        : '1px solid rgba(226, 232, 240, 0.8)',
                    backgroundColor: isSelected ? '#fff7ed' : hasVideos ? '#ffffff' : '#f8fafc',
                    cursor: hasVideos ? 'pointer' : 'not-allowed',
                    opacity: hasVideos ? 1 : 0.45,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>{colors.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: '16px', color: isSelected ? '#f97316' : '#94a3b8' }}>
                    {isSelected ? '✓' : '→'}
                  </span>
                </button>
              );
            })}

            <button
              onClick={onSubmitClick}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '14px 16px',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '12px',
                background: 'linear-gradient(120deg, #fb923c, #f97316)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 8px 18px rgba(249, 115, 22, 0.25)'
              }}
            >
              Submit Videos
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {VISIBLE_CATEGORIES.map((category) => {
                const label = CATEGORY_LABELS[category];
                const count = videoCounts[category];
                const hasVideos = count > 0;
                const isSelected = selectedCategoryFilter === category;
                const colors = CATEGORY_COLORS[category];

                // Accent colors for each category
                const accents: Record<string, string> = {
                  inspiration: '#f59e0b',
                  music: '#ec4899',
                  comedy: '#22c55e',
                  daily_life: '#ef4444',
                  talks: '#3b82f6'
                };
                const accent = accents[category];

                return (
                  <button
                    key={category}
                    onClick={() => hasVideos && onCategoryFilterToggle(category)}
                    disabled={!hasVideos || !videoCacheReady}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: isSelected ? `${accent}12` : hasVideos ? '#fff' : '#f1f5f9',
                      cursor: hasVideos ? 'pointer' : 'not-allowed',
                      opacity: hasVideos ? 1 : 0.4,
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected
                        ? `inset 0 0 0 2px ${accent}`
                        : hasVideos
                          ? '0 1px 3px rgba(0,0,0,0.06)'
                          : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (hasVideos && !isSelected) {
                        e.currentTarget.style.background = '#f8fafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (hasVideos && !isSelected) {
                        e.currentTarget.style.background = '#fff';
                      }
                    }}
                    aria-pressed={isSelected}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontSize: '16px',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        background: `${accent}18`
                      }}>{colors.icon}</span>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#1f2937'
                      }}>{label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Submit Button (desktop) */}
            <button
              onClick={onSubmitClick}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '11px 16px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(249, 115, 22, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(249, 115, 22, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
              }}
            >
              + Submit Videos
            </button>
          </>
        )}
      </div>

      {isMobile && signedInLabel && (
        <div style={{
          padding: '12px 16px 18px',
          fontSize: '12px',
          color: '#475569',
          textAlign: 'center',
          borderTop: '1px solid rgba(148, 163, 184, 0.35)'
        }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px', color: '#94a3b8', marginRight: '6px' }}>
            Signed in as:
          </span>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{signedInLabel}</span>
        </div>
      )}

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
