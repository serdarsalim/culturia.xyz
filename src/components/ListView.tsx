'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, VISIBLE_CATEGORIES, type VideoCategory, type VideoSubmission } from '@/types';

interface CountryData {
  country_code: string;
  categories: {
    [key in VideoCategory]?: number;
  };
  totalVideos: number;
}

interface VideoData {
  id: string;
  youtube_video_id: string;
  title: string;
  country_code: string;
  category: VideoCategory;
}

interface ListViewProps {
  onVideoClick: (video: VideoSubmission, category: VideoCategory) => void;
  categoryFilter: VideoCategory | null;
}

export default function ListView({ onVideoClick, categoryFilter }: ListViewProps) {
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryVideos, setCategoryVideos] = useState<Map<string, VideoData[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'videos' | 'alphabetical'>('videos');

  useEffect(() => {
    loadCountryData();
  }, []);

  async function loadCountryData() {
    try {
      const { data: videos, error } = await supabase
        .from('video_submissions')
        .select('country_code, category')
        .eq('status', 'approved');

      if (error) throw error;

      // Group by country and category
      const grouped = new Map<string, CountryData>();

      for (const video of videos || []) {
        if (!grouped.has(video.country_code)) {
          grouped.set(video.country_code, {
            country_code: video.country_code,
            categories: {},
            totalVideos: 0,
          });
        }

        const countryData = grouped.get(video.country_code)!;
        const category = video.category as VideoCategory;

        countryData.categories[category] = (countryData.categories[category] || 0) + 1;
        countryData.totalVideos++;
      }

      // Convert to array and sort by total videos descending
      const countriesArray = Array.from(grouped.values()).sort(
        (a, b) => b.totalVideos - a.totalVideos
      );

      setCountryData(countriesArray);
    } catch (error) {
      console.error('Error loading country data:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleCountry(countryCode: string) {
    const newExpanded = new Set(expandedCountries);
    if (newExpanded.has(countryCode)) {
      newExpanded.delete(countryCode);
    } else {
      newExpanded.add(countryCode);
    }
    setExpandedCountries(newExpanded);
  }

  async function toggleCategory(countryCode: string, category: VideoCategory) {
    const key = `${countryCode}-${category}`;
    const newExpanded = new Set(expandedCategories);

    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);

      // Load videos if not already loaded
      if (!categoryVideos.has(key)) {
        try {
          const { data: videos, error } = await supabase
            .from('video_submissions')
            .select('id, youtube_video_id, title, country_code, category')
            .eq('status', 'approved')
            .eq('country_code', countryCode)
            .eq('category', category)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const newVideosMap = new Map(categoryVideos);
          newVideosMap.set(key, videos || []);
          setCategoryVideos(newVideosMap);
        } catch (error) {
          console.error('Error loading videos:', error);
        }
      }
    }

    setExpandedCategories(newExpanded);
  }

  async function handleVideoClick(videoData: VideoData) {
    try {
      // Fetch full video data
      const { data: video, error } = await supabase
        .from('video_submissions')
        .select('*')
        .eq('id', videoData.id)
        .single();

      if (error) throw error;
      if (video) {
        onVideoClick(video as VideoSubmission, videoData.category);
      }
    } catch (error) {
      console.error('Error loading video:', error);
    }
  }

  // Filter and sort country data
  const filteredAndSortedCountries = countryData
    .filter((country) => {
      if (!searchQuery) return true;

      const countryName = getCountryName(country.country_code).toLowerCase();
      const query = searchQuery.toLowerCase();

      return countryName.includes(query);
    })
    .sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return getCountryName(a.country_code).localeCompare(getCountryName(b.country_code));
      }
      // Default: sort by video count
      return b.totalVideos - a.totalVideos;
    });

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#9ca3af'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      color: '#ffffff'
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 700,
        marginBottom: '24px',
        color: '#ffffff'
      }}>
        Browse All Videos
      </h2>

      {/* Search and Sort Controls */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        {/* Search Input */}
        <input
          type="text"
          placeholder="Search countries or videos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 300px',
            padding: '12px 16px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333333',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
            outline: 'none'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#f97316'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#333333'}
        />

        {/* Sort Dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'videos' | 'alphabetical')}
          style={{
            padding: '12px 16px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333333',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
            cursor: 'pointer',
            outline: 'none'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#f97316'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#333333'}
        >
          <option value="videos">Sort by: Most Videos</option>
          <option value="alphabetical">Sort by: A-Z</option>
        </select>
      </div>

      {filteredAndSortedCountries.length === 0 ? (
        <div style={{
          color: '#9ca3af',
          textAlign: 'center',
          padding: '40px'
        }}>
          {searchQuery ? 'No results found' : 'No videos yet'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredAndSortedCountries.map((country) => {
            const isExpanded = expandedCountries.has(country.country_code);
            const flag = getCountryFlag(country.country_code);
            const name = getCountryName(country.country_code);

            return (
              <div
                key={country.country_code}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333333',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                {/* Country Header */}
                <div
                  onClick={() => toggleCountry(country.country_code)}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>{flag}</span>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                        {country.totalVideos} {country.totalVideos === 1 ? 'video' : 'videos'}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '20px',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </span>
                </div>

                {/* Categories */}
                {isExpanded && (
                  <div style={{
                    borderTop: '1px solid #333333',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {VISIBLE_CATEGORIES.map((category) => {
                      const count = country.categories[category];
                      if (!count) return null;
                      if (categoryFilter && categoryFilter !== category) return null;

                      const categoryKey = `${country.country_code}-${category}`;
                      const isCategoryExpanded = expandedCategories.has(categoryKey);
                      const videos = categoryVideos.get(categoryKey) || [];

                      return (
                        <div
                          key={category}
                          style={{
                            backgroundColor: '#0a0a0a',
                            borderRadius: '8px',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Category Header */}
                          <div
                            onClick={() => toggleCategory(country.country_code, category)}
                            style={{
                              padding: '12px 16px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              userSelect: 'none'
                            }}
                          >
                            <span style={{
                              fontSize: '16px',
                              transform: isCategoryExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s'
                            }}>
                              ▼
                            </span>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                                {CATEGORY_LABELS[category]}
                              </div>
                              <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                {count} {count === 1 ? 'video' : 'videos'}
                              </div>
                            </div>
                          </div>

                          {/* Videos List */}
                          {isCategoryExpanded && videos.length > 0 && (
                            <div style={{
                              borderTop: '1px solid #1a1a1a',
                              padding: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}>
                              {videos
                                .filter((video) => {
                                  if (!searchQuery) return true;
                                  return video.title.toLowerCase().includes(searchQuery.toLowerCase());
                                })
                                .map((video) => (
                                <div
                                  key={video.id}
                                  onClick={() => handleVideoClick(video)}
                                  style={{
                                    padding: '8px 12px',
                                    backgroundColor: '#000000',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    color: '#9ca3af',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                    e.currentTarget.style.color = '#ffffff';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#000000';
                                    e.currentTarget.style.color = '#9ca3af';
                                  }}
                                >
                                  <span style={{ fontSize: '14px' }}>▶️</span>
                                  <span style={{
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {video.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
