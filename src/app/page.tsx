'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import WorldMap from '@/components/WorldMap';
import CountrySidebar from '@/components/CountrySidebar';
import VideoPlayer from '@/components/VideoPlayer';
import AuthModal from '@/components/AuthModal';
import SubmissionForm from '@/components/SubmissionForm';
import ProfileModal from '@/components/ProfileModal';
import CategoryPicker from '@/components/CategoryPicker';
import CategoryInfoCard from '@/components/CategoryInfoCard';
import type { VideoSubmission, VideoCategory } from '@/types';

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<{ video: VideoSubmission; category: VideoCategory } | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', description: '' });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'favorites' | 'submissions' | 'settings'>('favorites');
  const [isMobile, setIsMobile] = useState(false);
  const [profileData, setProfileData] = useState<{
    favorites: Array<{ video: VideoSubmission; category: VideoCategory }>;
    submissions: VideoSubmission[];
  } | null>(null);
  const [videoCache, setVideoCache] = useState<VideoSubmission[]>([]);
  const [videoCacheReady, setVideoCacheReady] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [pickerCountry, setPickerCountry] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<VideoCategory, number>>({
    inspiration: 0,
    music: 0,
    comedy: 0,
    cooking: 0,
    street_voices: 0,
  });
  const [mapSources, setMapSources] = useState<{ all: boolean; favorites: boolean; mine: boolean }>({
    all: true,
    favorites: false,
    mine: false,
  });
  const pendingSubmissionCountryRef = useRef<string | null>(null);
  const [showCategoryInfo, setShowCategoryInfo] = useState(false);
  const [categoryInfoCategory, setCategoryInfoCategory] = useState<VideoCategory>('inspiration');

  // Set of countries that currently have at least one approved video
  const countriesWithVideos = useMemo(() => {
    const set = new Set<string>();

    if (mapSources.all && videoCacheReady) {
      for (const v of videoCache) {
        if (v.country_code) set.add(v.country_code);
      }
    }
    if (mapSources.favorites && profileData) {
      for (const fav of profileData.favorites) {
        if (fav.video?.country_code) set.add(fav.video.country_code);
      }
    }
    if (mapSources.mine && profileData) {
      for (const sub of profileData.submissions) {
        if (sub.country_code) set.add(sub.country_code);
      }
    }

    return set;
  }, [mapSources, videoCache, videoCacheReady, profileData]);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check authentication and preload profile data
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        preloadProfileData(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        preloadProfileData(session.user.id);
      } else {
        setProfileData(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && pendingSubmissionCountryRef.current) {
      const countryCode = pendingSubmissionCountryRef.current;
      pendingSubmissionCountryRef.current = null;
      setSelectedCountry(isMobile ? countryCode : null);
      setShowSubmissionForm(true);
    }
  }, [user, isMobile]);

  // Preload profile data when user logs in
  async function preloadProfileData(userId: string) {
    try {
      // Fetch favorites and submissions in parallel
      const [favoritesResult, submissionsResult] = await Promise.all([
        supabase
          .from('user_favorites')
          .select(`
            submission_id,
            video_submissions (*)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('video_submissions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ]);

      const favorites = favoritesResult.data?.map((fav: any) => ({
        video: fav.video_submissions,
        category: fav.video_submissions.category as VideoCategory
      })) || [];

      const submissions = submissionsResult.data || [];

      setProfileData({ favorites, submissions });
    } catch (error) {
      console.error('Error preloading profile data:', error);
    }
  }

  // Fetch and cache ALL approved videos
  async function refreshVideoCache() {
    try {
      console.log('🔄 Refreshing video cache...');
      const { data, error } = await supabase
        .from('video_submissions')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const videos = data || [];
      setVideoCache(videos);
      setVideoCacheReady(true);

      // Calculate category counts from cached data
      const counts: Record<VideoCategory, number> = {
        inspiration: 0,
        music: 0,
        comedy: 0,
        cooking: 0,
        street_voices: 0,
      };

      videos.forEach((video) => {
        counts[video.category as VideoCategory]++;
      });

      setCategoryCounts(counts);
      console.log(`✅ Cache refreshed: ${videos.length} videos, counts:`, counts);
    } catch (error) {
      console.error('Error refreshing video cache:', error);
    }
  }

  // Initial cache load + real-time updates + periodic refresh
  useEffect(() => {
    // Initial load
    refreshVideoCache();

    // Set up real-time subscription for instant updates
    const subscription = supabase
      .channel('video_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'video_submissions',
          filter: 'status=eq.approved'
        },
        (payload) => {
          console.log('🔔 Real-time update detected:', payload.eventType);
          // Refresh cache when approved videos change
          refreshVideoCache();
        }
      )
      .subscribe();

    // Periodic refresh every 30 seconds as backup
    const intervalId = setInterval(() => {
      console.log('⏰ Periodic cache refresh (30s)');
      refreshVideoCache();
    }, 30000);

    // Cleanup
    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  function handleCountryClick(countryCode: string) {
    console.log('handleCountryClick called with:', countryCode);
    setCurrentVideo(null);
    // Always bypass picker and sidebar: play latest approved video for the country.
    // If none, open submission form for that country.

    // Close any picker state
    setShowCategoryPicker(false);
    setPickerCountry(null);

    if (!videoCacheReady) {
      setToastMessage({ title: 'Loading videos', description: 'Fetching latest content…' });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      return;
    }

    const latest = videoCache.find(v => v.country_code === countryCode);
    if (latest) {
      setCurrentVideo({ video: latest, category: latest.category as VideoCategory });
      // Do not alter sidebar selection for this flow
      setSelectedCountry(null);
    } else {
      // No videos for this country
      if (user) {
        setSelectedCountry(countryCode);
        setShowSubmissionForm(true);
      } else {
        pendingSubmissionCountryRef.current = countryCode;
        setAuthMode('signup');
        setShowAuthModal(true);
        setToastMessage({
          title: 'Help add videos',
          description: 'Sign up to add native-language content for this country.',
        });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2600);
      }
    }
    console.log('Country selected (auto-play if available):', countryCode);
  }

  function handleCloseSidebar() {
    setSelectedCountry(null);
    setCurrentVideo(null);
  }

  function handleBackgroundClick() {
    setSelectedCountry(null);
    setCurrentVideo(null);
  }

  function handleVideoSelect(video: VideoSubmission, category: VideoCategory) {
    setCurrentVideo({ video, category });
  }

  function handleCloseVideo() {
    setCurrentVideo(null);
  }

  function handleOpenSubmitFromPlayer(countryCode: string, category: VideoCategory) {
    setSelectedCountry(countryCode);
    setShowSubmissionForm(true);
  }

  function playRandomForCountryCategory(countryCode: string, category: VideoCategory) {
    if (!videoCacheReady) return;
    const matches = videoCache.filter(v => v.country_code === countryCode && v.category === category);
    if (matches.length > 0) {
      const randomVideo = matches[Math.floor(Math.random() * matches.length)];
      setCurrentVideo({ video: randomVideo, category });
    } else {
      setToastMessage({ title: 'No Videos', description: 'No videos in this category for this country' });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }

  function handleNextVideo() {
    if (!currentVideo || !videoCacheReady) return;

    // Filter cached videos for same category and country, excluding current
    const matchingVideos = videoCache.filter(v =>
      v.country_code === currentVideo.video.country_code &&
      v.category === currentVideo.category &&
      v.id !== currentVideo.video.id
    );

    if (matchingVideos.length > 0) {
      const randomVideo = matchingVideos[Math.floor(Math.random() * matchingVideos.length)];
      setCurrentVideo({ video: randomVideo, category: currentVideo.category });
    } else {
      // Show toast
      setToastMessage({
        title: 'No More Videos',
        description: 'No more videos available in this category for this country'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }

  function handleChangeCategoryInPlayer(newCategory: VideoCategory) {
    if (!currentVideo || !videoCacheReady) return;
    const country = currentVideo.video.country_code;
    const matches = videoCache.filter(v => v.country_code === country && v.category === newCategory);
    if (matches.length > 0) {
      const randomVideo = matches[Math.floor(Math.random() * matches.length)];
      setCurrentVideo({ video: randomVideo, category: newCategory });
    } else {
      setToastMessage({ title: 'No Videos', description: 'No videos in this category for this country' });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }

  function handleCategoryClick(category: VideoCategory) {
    if (!videoCacheReady) return;

    // Filter cached videos for this category
    const categoryVideos = videoCache.filter(v => v.category === category);

    if (categoryVideos.length > 0) {
      const randomVideo = categoryVideos[Math.floor(Math.random() * categoryVideos.length)];
      setCurrentVideo({ video: randomVideo, category });
      // Close country sidebar if open
      setSelectedCountry(null);
    } else {
      // Show toast
      setToastMessage({
        title: 'No Videos Available',
        description: 'No videos have been approved in this category yet'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }

  function handleGlobalCategoryClick(category: VideoCategory) {
    if (selectedCountry) {
      handleCategoryClick(category);
    } else {
      setCategoryInfoCategory(category);
      setShowCategoryInfo(true);
    }
  }

  function handleSubmitClick() {
    // Allow submissions without login
    setShowSubmissionForm(true);
  }

  function handleEditSubmission(countryCode: string) {
    setSelectedCountry(countryCode);
    setShowSubmissionForm(true);
  }

  function handleAuthSuccess() {
    setShowAuthModal(false);
    // Keep submission form open if it was already open
    // User can now click submit again after logging in
  }

  function handleSubmissionSuccess() {
    setShowSubmissionForm(false);
    setToastMessage({
      title: 'Submitted for Review',
      description: 'Your submission will be reviewed by our team'
    });
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);

    // Refresh profile data to show new submission
    if (user) {
      preloadProfileData(user.id);
    }
  }

  return (
    <div className="home-layout h-screen overflow-hidden">
      {/* Sidebar - bottom on mobile, left on desktop */}
      <div className="home-sidebar" style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        flexShrink: 0,
        overflowY: 'auto',
        backgroundColor: '#f3f4f6',
        color: '#000000'
      }}>
        {selectedCountry ? (
          <CountrySidebar
            countryCode={selectedCountry}
            onClose={handleCloseSidebar}
            onVideoSelect={handleVideoSelect}
            onSubmitClick={handleSubmitClick}
            videoCache={videoCache}
            videoCacheReady={videoCacheReady}
          />
        ) : (
          <div className="h-full flex flex-col" style={{ padding: isMobile ? '16px 24px' : '32px' }}>
            {/* Header - Logo and Auth Links */}
            {isMobile ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h1 style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    margin: 0,
                    background: 'linear-gradient(120deg, #f97316, #fb923c)',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent'
                  }}>
                    🌍 CULTURIA
                  </h1>
                  <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Native-language videos worldwide</p>
                </div>
                <div style={{ display: 'flex', gap: '14px', fontSize: '13px', alignItems: 'center' }}>
                  {!user ? (
                    <>
                      <button
                        onClick={() => {
                          setAuthMode('signup');
                          setShowAuthModal(true);
                        }}
                        style={{
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textDecoration: 'underline',
                          padding: 0,
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                      >
                        Sign Up
                      </button>
                      <span style={{ color: '#d1d5db' }}>|</span>
                      <button
                        onClick={() => {
                          setAuthMode('login');
                          setShowAuthModal(true);
                        }}
                        style={{
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textDecoration: 'underline',
                          padding: 0,
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                      >
                        Log In
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setProfileModalTab('favorites');
                          setShowProfileModal(true);
                        }}
                        style={{
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textDecoration: 'none',
                          padding: 0,
                          transition: 'color 0.2s',
                          fontSize: '16px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                        title="Favorites"
                      >
                        ❤️
                      </button>
                      <span style={{ color: '#d1d5db' }}>|</span>
                      <button
                        onClick={() => {
                          setProfileModalTab('submissions');
                          setShowProfileModal(true);
                        }}
                        style={{
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textDecoration: 'none',
                          padding: 0,
                          transition: 'color 0.2s',
                          fontSize: '16px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                        title="My Submissions"
                      >
                        📤
                      </button>
                      <span style={{ color: '#d1d5db' }}>|</span>
                      <button
                        onClick={() => {
                          setProfileModalTab('settings');
                          setShowProfileModal(true);
                        }}
                        style={{
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textDecoration: 'none',
                          padding: 0,
                          transition: 'color 0.2s',
                          fontSize: '16px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                        title="Settings"
                      >
                        ⚙️
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Auth Links at top left for desktop */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', fontSize: '14px', alignItems: 'center', justifyContent: 'center' }}>
                  {!user ? (
                    <>
                      <button
                        onClick={() => {
                          setAuthMode('signup');
                          setShowAuthModal(true);
                        }}
                        style={{
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textDecoration: 'underline',
                          padding: 0,
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                      >
                        Sign Up
                      </button>
                      <span style={{ color: '#d1d5db' }}>|</span>
                      <button
                        onClick={() => {
                          setAuthMode('login');
                          setShowAuthModal(true);
                        }}
                        style={{
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textDecoration: 'underline',
                          padding: 0,
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                      >
                        Log In
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setProfileModalTab('favorites');
                          setShowProfileModal(true);
                        }}
                        style={{
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textDecoration: 'none',
                          padding: 0,
                          transition: 'color 0.2s',
                          fontSize: '18px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                        title="Favorites"
                      >
                        ❤️
                      </button>
                      <span style={{ color: '#d1d5db' }}>|</span>
                      <button
                        onClick={() => {
                          setProfileModalTab('submissions');
                          setShowProfileModal(true);
                        }}
                        style={{
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textDecoration: 'none',
                          padding: 0,
                          transition: 'color 0.2s',
                          fontSize: '18px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                        title="My Submissions"
                      >
                        📤
                      </button>
                      <span style={{ color: '#d1d5db' }}>|</span>
                      <button
                        onClick={() => {
                          setProfileModalTab('settings');
                          setShowProfileModal(true);
                        }}
                        style={{
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textDecoration: 'none',
                          padding: 0,
                          transition: 'color 0.2s',
                          fontSize: '18px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6b7280';
                        }}
                        title="Settings"
                      >
                        ⚙️
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: isMobile ? '8px' : '60px' }}>
              {!isMobile && (
                <div>
                  <h1 style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    marginBottom: '6px',
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(120deg, #f97316, #fb923c)',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent'
                  }}>
                    🌍 CULTURIA
                  </h1>
                  <p style={{ fontSize: '13px', color: '#6b7280' }}>Native-language content from every country</p>
                </div>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : '1fr',
                gap: isMobile ? '10px' : '8px'
              }}>
                {([
                  { key: 'inspiration', icon: '💡', label: 'Inspiration' },
                  { key: 'music', icon: '🎵', label: 'Music' },
                  { key: 'comedy', icon: '😄', label: 'Comedy' },
                  { key: 'cooking', icon: '🍳', label: 'Cooking' },
                  { key: 'street_voices', icon: '🎤', label: 'Street Voices' },
                ] as { key: VideoCategory; icon: string; label: string }[]).map(({ key, icon, label }) => (
                  <button
                    key={key}
                    onClick={() => handleGlobalCategoryClick(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid rgba(145, 152, 171, 0.3)',
                      background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 22px rgba(15, 23, 42, 0.12)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.08)'; }}
                  >
                    <span style={{ fontSize: '20px' }}>{icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer - Subtitle and Links */}
            <div style={{ marginTop: isMobile ? '60px' : 'auto', paddingTop: isMobile ? '0' : '24px', paddingBottom: isMobile ? '24px' : '24px' }}>
              <p style={{
                fontSize: isMobile ? '13px' : '13px',
                color: '#4b5563',
                marginBottom: '8px',
                lineHeight: '1.5',
                textAlign: isMobile ? 'center' : 'left'
              }}>
                Discover authentic cultural content from around the world
              </p>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                <a
                  href="/terms"
                  style={{
                    color: '#6b7280',
                    textDecoration: 'none',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                >
                  Terms
                </a>
                <span style={{ color: '#d1d5db' }}>|</span>
                <a
                  href="/privacy"
                  style={{
                    color: '#6b7280',
                    textDecoration: 'none',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                >
                  Privacy
                </a>
                <span style={{ color: '#d1d5db' }}>|</span>
                <a
                  href="#"
                  style={{
                    color: '#6b7280',
                    textDecoration: 'none',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                >
                  About
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Container - takes remaining space */}
      <div className="home-map flex-1 relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
        <WorldMap
          onCountryClick={handleCountryClick}
          selectedCountry={selectedCountry}
          onBackgroundClick={handleBackgroundClick}
          countriesWithVideos={countriesWithVideos}
        />
      </div>

      {/* Video Player Overlay */}
      {currentVideo && (
        <VideoPlayer
          video={currentVideo.video}
          category={currentVideo.category}
          onClose={handleCloseVideo}
          onNext={handleNextVideo}
          onSubmitVideo={handleOpenSubmitFromPlayer}
          categoryCounts={{
            inspiration: videoCache.filter(v => v.country_code === currentVideo.video.country_code && v.category === 'inspiration').length,
            music: videoCache.filter(v => v.country_code === currentVideo.video.country_code && v.category === 'music').length,
            comedy: videoCache.filter(v => v.country_code === currentVideo.video.country_code && v.category === 'comedy').length,
            cooking: videoCache.filter(v => v.country_code === currentVideo.video.country_code && v.category === 'cooking').length,
            street_voices: videoCache.filter(v => v.country_code === currentVideo.video.country_code && v.category === 'street_voices').length,
          }}
          onChangeCategory={handleChangeCategoryInPlayer}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          initialMode={authMode}
        />
      )}

      {/* Submission Form */}
      {showSubmissionForm && selectedCountry && (
        <SubmissionForm
          countryCode={selectedCountry}
          onClose={() => setShowSubmissionForm(false)}
          onSuccess={handleSubmissionSuccess}
          onAuthRequired={() => setShowAuthModal(true)}
        />
      )}

      {/* Category Picker */}
      {showCategoryPicker && pickerCountry && (
        <CategoryPicker
          countryCode={pickerCountry}
          counts={{
            inspiration: videoCache.filter(v => v.country_code === pickerCountry && v.category === 'inspiration').length,
            music: videoCache.filter(v => v.country_code === pickerCountry && v.category === 'music').length,
            comedy: videoCache.filter(v => v.country_code === pickerCountry && v.category === 'comedy').length,
            cooking: videoCache.filter(v => v.country_code === pickerCountry && v.category === 'cooking').length,
            street_voices: videoCache.filter(v => v.country_code === pickerCountry && v.category === 'street_voices').length,
          }}
          loading={!videoCacheReady}
          onSelect={(cat) => {
            setShowCategoryPicker(false);
            playRandomForCountryCategory(pickerCountry, cat);
          }}
          onSubmitVideos={() => {
            setShowCategoryPicker(false);
            // Open submission form for this country
            setSelectedCountry(pickerCountry);
            setShowSubmissionForm(true);
          }}
          onClose={() => setShowCategoryPicker(false)}
        />
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          onClose={() => setShowProfileModal(false)}
          onPlayVideo={(video, category) => {
            setCurrentVideo({ video, category });
          }}
          onEditSubmission={handleEditSubmission}
          initialData={profileData}
          mapSources={mapSources}
          onToggleMapSource={(key, value) => setMapSources((prev) => ({ ...prev, [key]: value }))}
          initialTab={profileModalTab}
        />
      )}

      {/* Category Info Modal */}
      {showCategoryInfo && (
        <CategoryInfoCard
          activeCategory={categoryInfoCategory}
          onChangeCategory={(cat) => setCategoryInfoCategory(cat)}
          onClose={() => setShowCategoryInfo(false)}
        />
      )}

      {/* Toast Notification */}
      {showToast && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 100,
          backgroundColor: toastMessage.title === 'No More Videos' || toastMessage.title === 'No Videos Available' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '15px',
          fontWeight: '500',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <span style={{ fontSize: '20px' }}>
            {toastMessage.title === 'No More Videos' || toastMessage.title === 'No Videos Available' ? '⚠️' : '✓'}
          </span>
          <div>
            <div style={{ fontWeight: '600' }}>{toastMessage.title}</div>
            <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>
              {toastMessage.description}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
