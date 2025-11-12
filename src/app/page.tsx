'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import WorldMap from '@/components/WorldMap';
import CountrySidebar from '@/components/CountrySidebar';
import VideoPlayer from '@/components/VideoPlayer';
import AuthModal from '@/components/AuthModal';
import AddVideoModal from '@/components/AddVideoModal';
import ProfileModal from '@/components/ProfileModal';
import CategoryPicker from '@/components/CategoryPicker';
import { VISIBLE_CATEGORIES, CATEGORY_LABELS, type VideoSubmission, type VideoCategory } from '@/types';

const CATEGORY_ICON_MAP: Record<VideoCategory, string> = {
  inspiration: '💡',
  music: '🎵',
  comedy: '😄',
  daily_life: '📹',
  talks: '🎤',
};

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<{ video: VideoSubmission; category: VideoCategory } | null>(null);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<{ username: string | null; display_name: string | null; is_private: boolean | null } | null>(null);
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
    daily_life: 0,
    talks: 0,
  });
  const [mapSources, setMapSources] = useState<{ all: boolean; favorites: boolean; mine: boolean }>(() => {
    // Load from localStorage on initial render
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mapSources');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse mapSources from localStorage:', e);
        }
      }
    }
    return {
      all: true,
      favorites: false,
      mine: false,
    };
  });
  const pendingSubmissionCountryRef = useRef<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<VideoCategory | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Set of countries that currently have at least one approved video
  const countriesWithVideos = useMemo(() => {
    const set = new Set<string>();

    // If "My submissions" is enabled, show ONLY user's submissions
    if (mapSources.mine && profileData) {
      for (const sub of profileData.submissions) {
        if (sub.country_code) set.add(sub.country_code);
      }
      return set; // Return early, ignore other sources
    }

    // Otherwise combine "All videos" and "My favorites"
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
        fetchUserProfile(session.user.id);
      } else {
        setProfileData(null);
        setUserProfile(null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        preloadProfileData(session.user.id);
        fetchUserProfile(session.user.id);
      } else {
        setProfileData(null);
        setUserProfile(null);
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

      const visibleFavorites = favorites.filter((fav) =>
        VISIBLE_CATEGORIES.includes(fav.category)
      );
      // Allow user to see their own submissions even if not in visible categories
      const visibleSubmissions = submissions.filter(
        (submission: VideoSubmission) =>
          VISIBLE_CATEGORIES.includes(submission.category as VideoCategory)
      );

      setProfileData({ favorites: visibleFavorites, submissions: submissions });
    } catch (error) {
      console.error('Error preloading profile data:', error);
    }
  }

  async function fetchUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('username, display_name, is_private')
        .eq('id', userId)
        .single();

      if (error) {
        // If no profile row yet, clear state silently
        if (error.code === 'PGRST116') {
          setUserProfile({
            username: null,
            display_name: null,
            is_private: false,
          });
          return;
        }
        console.error('Error fetching user profile:', error);
        return;
      }

      if (data) {
        setUserProfile({
          username: data.username ?? null,
          display_name: data.display_name ?? null,
          is_private: data.is_private ?? false,
        });
      } else {
        setUserProfile({
          username: null,
          display_name: null,
          is_private: false,
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }

  function getCategoryCountsForCountry(countryCode: string | null): Record<VideoCategory, number> {
    const counts: Record<VideoCategory, number> = {
      inspiration: 0,
      music: 0,
      comedy: 0,
      daily_life: 0,
      talks: 0,
    };

    if (!countryCode) {
      return counts;
    }

    // Filter videos based on current map source
    let filteredVideos = videoCache.filter(v => v.country_code === countryCode);

    // Apply mapSources filter
    if (mapSources.mine && user?.id) {
      filteredVideos = filteredVideos.filter(v => v.user_id === user.id);
    } else if (mapSources.favorites && profileData?.favorites) {
      const favoriteVideoIds = new Set(profileData.favorites.map(fav => fav.video.id));
      filteredVideos = filteredVideos.filter(v => favoriteVideoIds.has(v.id));
    }

    filteredVideos.forEach((video) => {
      counts[video.category as VideoCategory]++;
    });

    return counts;
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

      const { data: privateProfiles, error: privacyError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('is_private', true);

      if (privacyError) {
        console.error('Error fetching private profiles:', privacyError);
      }

      const privateIds = new Set((privateProfiles || []).map(profile => profile.id));
      const currentUserId = user?.id || null;

      const videos = data || [];
      const filteredVideos = videos
        .filter((video) => VISIBLE_CATEGORIES.includes(video.category as VideoCategory))
        .filter((video) => !privateIds.has(video.user_id) || video.user_id === currentUserId);

      let combinedVideos = [...filteredVideos];

      if (currentUserId) {
        const { data: userVideos, error: userVideosError } = await supabase
          .from('video_submissions')
          .select('*')
          .eq('user_id', currentUserId);

        if (!userVideosError && userVideos) {
          userVideos
            .filter(video => VISIBLE_CATEGORIES.includes(video.category as VideoCategory))
            .forEach(video => {
              if (!combinedVideos.some(existing => existing.id === video.id)) {
                combinedVideos.push(video);
              }
            });
        }
      }

      setVideoCache(combinedVideos);
      setVideoCacheReady(true);

      // Calculate category counts from cached data
      const counts: Record<VideoCategory, number> = {
        inspiration: 0,
        music: 0,
        comedy: 0,
        daily_life: 0,
        talks: 0,
      };

      combinedVideos.forEach((video) => {
        counts[video.category as VideoCategory]++;
      });

      setCategoryCounts(counts);
      console.log(`✅ Cache refreshed: ${combinedVideos.length} videos (visible cats), counts:`, counts);
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

  useEffect(() => {
    refreshVideoCache();
  }, [user?.id]);

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

    // Get filtered videos based on current map source
    let availableVideos = videoCache.filter(v => v.country_code === countryCode);

    // Apply mapSources filter
    if (mapSources.mine && user?.id) {
      availableVideos = availableVideos.filter(v => v.user_id === user.id);
    } else if (mapSources.favorites && profileData?.favorites) {
      const favoriteVideoIds = new Set(profileData.favorites.map(fav => fav.video.id));
      availableVideos = availableVideos.filter(v => favoriteVideoIds.has(v.id));
    }

    const categoriesToTry = selectedCategoryFilter
      ? [selectedCategoryFilter, ...VISIBLE_CATEGORIES.filter(cat => cat !== selectedCategoryFilter)]
      : VISIBLE_CATEGORIES;

    for (const categoryOption of categoriesToTry) {
      const matches = availableVideos.filter(v => v.category === categoryOption);

      if (matches.length > 0) {
        const randomVideo = matches[Math.floor(Math.random() * matches.length)];
        setCurrentVideo({ video: randomVideo, category: categoryOption });
        setSelectedCountry(null);
        return;
      }
    }

    const latest = availableVideos[0];
    if (latest) {
      setCurrentVideo({ video: latest, category: latest.category as VideoCategory });
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

  function handleProfileSettingsChange(updates: { username: string | null; display_name: string | null; is_private: boolean }) {
    setUserProfile({
      username: updates.username,
      display_name: updates.display_name,
      is_private: updates.is_private,
    });
    // Refresh video cache to update visibility filters
    refreshVideoCache();
  }

  function handleNextVideo() {
    if (!currentVideo || !videoCacheReady) return;

    // Filter cached videos for same category and country, excluding current
    let matchingVideos = videoCache.filter(v =>
      v.country_code === currentVideo.video.country_code &&
      v.category === currentVideo.category &&
      v.id !== currentVideo.video.id
    );

    // Apply mapSources filter
    if (mapSources.mine && user?.id) {
      matchingVideos = matchingVideos.filter(v => v.user_id === user.id);
    } else if (mapSources.favorites && profileData?.favorites) {
      const favoriteVideoIds = new Set(profileData.favorites.map(fav => fav.video.id));
      matchingVideos = matchingVideos.filter(v => favoriteVideoIds.has(v.id));
    }

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

  function getCurrentPlaylist(): VideoSubmission[] {
    if (!currentVideo || !videoCacheReady) return [];

    // Get all videos for the same country and category
    let filtered = videoCache.filter(v =>
      v.country_code === currentVideo.video.country_code &&
      v.category === currentVideo.category
    );

    // Apply mapSources filter
    if (mapSources.mine && user?.id) {
      // Only show user's own videos
      filtered = filtered.filter(v => v.user_id === user.id);
    } else if (mapSources.favorites && profileData?.favorites) {
      // Only show favorited videos
      const favoriteVideoIds = new Set(profileData.favorites.map(fav => fav.video.id));
      filtered = filtered.filter(v => favoriteVideoIds.has(v.id));
    }

    return filtered;
  }

  function handleSelectVideoFromPlaylist(video: VideoSubmission) {
    if (!currentVideo) return;
    setCurrentVideo({ video, category: currentVideo.category });
  }

  function handleChangeCategoryInPlayer(newCategory: VideoCategory) {
    if (!currentVideo || !videoCacheReady) return;
    const country = currentVideo.video.country_code;
    let matches = videoCache.filter(v => v.country_code === country && v.category === newCategory);

    // Apply mapSources filter
    if (mapSources.mine && user?.id) {
      matches = matches.filter(v => v.user_id === user.id);
    } else if (mapSources.favorites && profileData?.favorites) {
      const favoriteVideoIds = new Set(profileData.favorites.map(fav => fav.video.id));
      matches = matches.filter(v => favoriteVideoIds.has(v.id));
    }

    if (matches.length > 0) {
      const randomVideo = matches[Math.floor(Math.random() * matches.length)];
      setCurrentVideo({ video: randomVideo, category: newCategory });
    } else {
      setToastMessage({ title: 'No Videos', description: 'No videos in this category for this country' });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }

  function handleGlobalCategoryClick(category: VideoCategory) {
    handleCategoryFilterToggle(category);
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
    setSelectedCountry(null);
    setToastMessage({
      title: 'Submitted for Review',
      description: 'Your submission will be reviewed by our team'
    });
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);

    // Refresh video cache and profile data to show new submission immediately
    refreshVideoCache();
    if (user) {
      preloadProfileData(user.id);
    }
  }

  function handleCategoryFilterToggle(category: VideoCategory) {
    setSelectedCategoryFilter(prev => (prev === category ? null : category));
  }

  function handleMapSourceToggle(key: 'all' | 'favorites' | 'mine', value: boolean) {
    setMapSources(prev => {
      const next = { ...prev };

      if (key === 'all') {
        next.all = value;
        if (value) {
          next.favorites = false;
          next.mine = false;
        }
      } else if (key === 'favorites') {
        next.favorites = value;
        if (value) {
          next.all = false;
        }
      } else if (key === 'mine') {
        next.mine = value;
        if (value) {
          next.all = false;
        }
      }

      // Save to localStorage
      localStorage.setItem('mapSources', JSON.stringify(next));

      // Show success message
      if (key === 'mine' && value) {
        setToastMessage({
          title: 'My Submissions',
          description: 'Now showing only your submissions on the map'
        });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      } else if (key === 'favorites' && value) {
        setToastMessage({
          title: 'My Favorites',
          description: 'Now showing only your favorites on the map'
        });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      } else if (key === 'all' && value) {
        setToastMessage({
          title: 'All Videos',
          description: 'Now showing all approved videos on the map'
        });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }

      return next;
    });
  }

  const sanitizedUsername = userProfile?.username ? userProfile.username.replace(/^@/, '').trim() : '';
  const primaryIdentity =
    userProfile?.display_name?.trim() ||
    sanitizedUsername ||
    (user?.email ? user.email.split('@')[0] : 'Explorer');
  const secondaryIdentity = sanitizedUsername ? `@${sanitizedUsername}` : (user?.email || '');

  const identityDisplay = secondaryIdentity && secondaryIdentity !== primaryIdentity
    ? `${primaryIdentity} • ${secondaryIdentity}`
    : primaryIdentity;

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
        {selectedCountry && !showSubmissionForm ? (
          <CountrySidebar
            countryCode={selectedCountry}
            onClose={handleCloseSidebar}
            onVideoSelect={handleVideoSelect}
            onSubmitClick={handleSubmitClick}
            videoCache={videoCache}
            videoCacheReady={videoCacheReady}
            signedInLabel={user ? identityDisplay : null}
            selectedCategoryFilter={selectedCategoryFilter}
            onCategoryFilterToggle={handleCategoryFilterToggle}
          />
        ) : (
          <div className="h-full flex flex-col" style={{ padding: isMobile ? '34px 16px 16px' : '32px' }}>
            {/* Header - Logo and Auth Links */}
            {isMobile ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <button
                    onClick={() => setShowAboutModal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
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
                  </button>
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
              </>
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
                <button
                  onClick={() => setShowAboutModal(true)}
                  style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                >
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
                </button>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : '1fr',
                gap: isMobile ? '10px' : '8px'
              }}>
                {VISIBLE_CATEGORIES.map((key) => {
                  const icon = CATEGORY_ICON_MAP[key];
                  const label = CATEGORY_LABELS[key];
                  const isSelected = selectedCategoryFilter === key;
                  return (
                  <button
                    key={key}
                    onClick={() => handleGlobalCategoryClick(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: isSelected ? '2px solid #f97316' : '1px solid rgba(145, 152, 171, 0.3)',
                      background: isSelected
                        ? 'linear-gradient(135deg, #fff7ed, #ffe4d1)'
                        : 'linear-gradient(135deg, #ffffff, #f8fafc)',
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
                )})}
              </div>
            </div>

            {/* Footer - Subtitle and Links */}
            <div style={{ marginTop: 'auto', paddingTop: '24px', paddingBottom: isMobile ? '32px' : '60px' }}>
              <p style={{
                fontSize: isMobile ? '13px' : '13px',
                color: '#4b5563',
                marginBottom: '8px',
                lineHeight: '1.5',
                textAlign: isMobile ? 'center' : 'left'
              }}>
                Discover authentic cultural content from around the world
              </p>
              {user && (
                <div style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  textAlign: isMobile ? 'center' : 'left',
                  marginTop: '-4px',
                  marginBottom: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  justifyContent: isMobile ? 'center' : 'flex-start',
                  width: '100%'
                }}>
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '10px', color: '#94a3b8' }}>
                    Signed in as:
                  </span>
                  <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '12px' }}>
                    {identityDisplay}
                  </span>
                </div>
              )}
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
          categoryCounts={getCategoryCountsForCountry(currentVideo.video.country_code)}
          onChangeCategory={handleChangeCategoryInPlayer}
          playlist={getCurrentPlaylist()}
          onSelectVideo={handleSelectVideoFromPlaylist}
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
        <AddVideoModal
          countryCode={selectedCountry}
          onClose={() => {
            setShowSubmissionForm(false);
            setSelectedCountry(null);
          }}
          onSuccess={handleSubmissionSuccess}
        />
      )}

      {/* Category Picker */}
      {showCategoryPicker && pickerCountry && (
        <CategoryPicker
          countryCode={pickerCountry}
          counts={getCategoryCountsForCountry(pickerCountry)}
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
          onClose={() => {
            setShowProfileModal(false);
            if (user?.id) {
              fetchUserProfile(user.id);
            }
          }}
          onPlayVideo={(video, category) => {
            setCurrentVideo({ video, category });
          }}
          onEditSubmission={handleEditSubmission}
          initialData={profileData}
          initialProfile={userProfile}
          onProfileSettingsChange={handleProfileSettingsChange}
          mapSources={mapSources}
          onToggleMapSource={handleMapSourceToggle}
          initialTab={profileModalTab}
        />
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 220,
            backgroundColor: 'rgba(3,7,18,0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
          onClick={() => setShowAboutModal(false)}
        >
          <div
            style={{
              maxWidth: '720px',
              width: '100%',
              background: 'radial-gradient(circle at top, #0f172a 0%, #020617 80%)',
              color: '#f8fafc',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: '0 30px 80px rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(248, 250, 252, 0.08)',
              position: 'relative',
              overflowY: 'auto',
              maxHeight: '90vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAboutModal(false)}
              aria-label="Close About Modal"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '36px',
                height: '36px',
                borderRadius: '999px',
                border: '1px solid rgba(248, 250, 252, 0.2)',
                background: 'rgba(2,6,23,0.6)',
                color: '#f8fafc',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '28px' }}>🌍</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>CULTURIA - Discover the World Through Authentic Voices</h2>
                <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>Experience real culture, in real languages, from real people.</p>
              </div>
            </div>
            <p style={{ lineHeight: 1.6, color: '#e2e8f0' }}>
              Most content online is translated, dubbed, or made for tourists. CULTURIA is different. We show you what it's actually like to live somewhere—through videos created by locals, in their native language, speaking authentically.
            </p>

            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', letterSpacing: '0.2em', color: '#f97316', marginBottom: '12px' }}>WHY THESE 4 CATEGORIES?</h3>
              <div style={{ display: 'grid', gap: '16px' }}>
                {[
                  { icon: '🎤', title: 'Talks', body: 'Listen to real people discuss ideas, share stories, give speeches, and have conversations. This is where you hear how people think and communicate.' },
                  { icon: '🎵', title: 'Music', body: 'Every culture expresses itself through music. From traditional folk songs to modern hits, experience the sounds that define a place.' },
                  { icon: '😄', title: 'Comedy', body: 'Humor reveals what a culture finds funny, clever, or absurd. It’s cultural insight wrapped in entertainment.' },
                  { icon: '📹', title: 'Daily Life', body: 'Experience authentic everyday moments—market scenes, local customs, daily routines, and cultural practices that reveal how people truly live.' },
                ].map(({ icon, title, body }) => (
                  <div key={title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '24px' }}>{icon}</span>
                    <div>
                      <strong style={{ fontSize: '15px' }}>{title}</strong>
                      <p style={{ margin: '4px 0 0', lineHeight: 1.5, color: '#cbd5f5' }}>{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '24px', padding: '20px', borderRadius: '18px', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
              <h3 style={{ margin: 0, color: '#fb923c', fontSize: '14px', letterSpacing: '0.15em' }}>OUR MISSION</h3>
              <p style={{ marginTop: '8px', lineHeight: 1.6, color: '#f8fafc' }}>
                No translations. No tourist content. Just authentic cultural moments, captured in the source language, showing you what it really means to be from somewhere.
              </p>
            </div>

            <div style={{ marginTop: '24px', padding: '16px', borderRadius: '18px', background: '#0f172a', border: '1px solid rgba(248, 250, 252, 0.06)' }}>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                Click any country. Pick a category. Immerse yourself. <span style={{ color: '#38bdf8', fontWeight: 600 }}>Let authentic voices guide you.</span>
              </p>
            </div>
          </div>
        </div>
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
