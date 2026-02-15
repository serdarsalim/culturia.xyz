'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName } from '@/lib/countries';
import WorldMap from '@/components/WorldMap';
import CountrySidebar from '@/components/CountrySidebar';
import VideoPlayer from '@/components/VideoPlayer';
import CountryImpressionModal from '@/components/CountryImpressionModal';
import AuthModal from '@/components/AuthModal';
import AddVideoModal from '@/components/AddVideoModal';
import ProfileModal from '@/components/ProfileModal';
import CategoryPicker from '@/components/CategoryPicker';
import ListView from '@/components/ListView';
import { VISIBLE_CATEGORIES, type VideoSubmission, type VideoCategory, type CountryEntry } from '@/types';

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [submissionCountry, setSubmissionCountry] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<{ video: VideoSubmission; category: VideoCategory } | null>(null);
  const [activeCountryModal, setActiveCountryModal] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
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
  const [countryEntries, setCountryEntries] = useState<CountryEntry[]>([]);
  const [entryAuthorNames, setEntryAuthorNames] = useState<Record<string, string>>({});
  const [favoriteEntryIds, setFavoriteEntryIds] = useState<Set<string>>(new Set());
  const [privateEntryOwnerIds, setPrivateEntryOwnerIds] = useState<Set<string>>(new Set());
  const [entriesReady, setEntriesReady] = useState(false);
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
  const [entryPresenceFilters, setEntryPresenceFilters] = useState<{ been: boolean; lived: boolean }>({
    been: false,
    lived: false,
  });
  const pendingSubmissionCountryRef = useRef<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<VideoCategory | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const visibleEntries = useMemo(() => {
    return countryEntries.filter((entry) =>
      !privateEntryOwnerIds.has(entry.user_id) || entry.user_id === user?.id
    );
  }, [countryEntries, privateEntryOwnerIds, user?.id]);

  const filteredEntries = useMemo(() => {
    if (mapSources.mine && user?.id) {
      return visibleEntries.filter((entry) => entry.user_id === user.id);
    }
    if (mapSources.favorites) {
      return visibleEntries.filter((entry) => favoriteEntryIds.has(entry.id));
    }
    return visibleEntries;
  }, [mapSources, user?.id, favoriteEntryIds, visibleEntries]);

  const presenceFilteredEntries = useMemo(() => {
    if (!entryPresenceFilters.been && !entryPresenceFilters.lived) {
      return filteredEntries;
    }

    return filteredEntries.filter((entry) => {
      const matchesBeen = entryPresenceFilters.been && !!entry.been_there;
      const matchesLived = entryPresenceFilters.lived && !!entry.lived_there;
      return matchesBeen || matchesLived;
    });
  }, [filteredEntries, entryPresenceFilters]);

  // Set of countries highlighted on map based on post source filter
  const countriesWithVideos = useMemo(() => {
    const set = new Set<string>();
    for (const entry of presenceFilteredEntries) {
      if (entry.country_code) set.add(entry.country_code);
    }
    return set;
  }, [presenceFilteredEntries]);

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
        setIsAdminUser(false);
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
        setIsAdminUser(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && pendingSubmissionCountryRef.current) {
      const countryCode = pendingSubmissionCountryRef.current;
      pendingSubmissionCountryRef.current = null;
      setSelectedCountry(isMobile ? countryCode : null);
      setSubmissionCountry(countryCode);
      setShowSubmissionForm(true);
    }
  }, [user, isMobile]);

  useEffect(() => {
    if (showProfileModal && user?.id && !checkingAdmin) {
      checkAdminStatus(user.id);
    }
  }, [showProfileModal, user?.id, checkingAdmin]);

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
          .not('submission_id', 'is', null)
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

  async function checkAdminStatus(userId: string) {
    try {
      setCheckingAdmin(true);
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      setIsAdminUser(!!data);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Unable to verify admin status, defaulting to non-admin:', error);
      }
      setIsAdminUser(false);
    } finally {
      setCheckingAdmin(false);
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

  async function refreshCountryEntries() {
    try {
      const { data, error } = await supabase
        .from('country_entries')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const entries = (data || []) as CountryEntry[];
      setCountryEntries(entries);

      const userIds = Array.from(new Set(entries.map((entry) => entry.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, is_private')
          .in('id', userIds);

        if (profileError) {
          console.error('Error loading entry author names:', profileError);
          setEntryAuthorNames({});
          setPrivateEntryOwnerIds(new Set());
        } else {
          const names: Record<string, string> = {};
          const privateIds = new Set<string>();
          for (const profile of profiles || []) {
            const username = profile.username?.replace(/^@/, '').trim();
            const displayName = profile.display_name?.trim();
            names[profile.id] = displayName || (username ? `@${username}` : '');
            if (profile.is_private) privateIds.add(profile.id);
          }
          setEntryAuthorNames(names);
          setPrivateEntryOwnerIds(privateIds);
        }
      } else {
        setEntryAuthorNames({});
        setPrivateEntryOwnerIds(new Set());
      }

      setEntriesReady(true);
    } catch (error) {
      console.error('Error refreshing country entries:', error);
      setEntriesReady(true);
    }
  }

  async function refreshEntryFavorites() {
    if (!user?.id) {
      setFavoriteEntryIds(new Set());
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('country_entry_id')
        .eq('user_id', user.id)
        .not('country_entry_id', 'is', null);

      if (error) throw error;

      const ids = new Set<string>();
      for (const row of data || []) {
        if (row.country_entry_id) ids.add(row.country_entry_id);
      }
      setFavoriteEntryIds(ids);
    } catch (error) {
      console.error('Error refreshing entry favorites:', error);
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

  useEffect(() => {
    refreshEntryFavorites();
  }, [user?.id]);

  useEffect(() => {
    refreshCountryEntries();

    const subscription = supabase
      .channel('country_entries_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'country_entries',
        },
        () => {
          refreshCountryEntries();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  function handleCountryClick(countryCode: string) {
    setCurrentVideo(null);
    setSelectedCountry(null);
    setShowSubmissionForm(false);
    setShowCategoryPicker(false);
    setPickerCountry(null);
    setActiveCountryModal(countryCode);
  }

  function handleCloseSidebar() {
    setSelectedCountry(null);
    setCurrentVideo(null);
    setActiveCountryModal(null);
  }

  function handleBackgroundClick() {
    setSelectedCountry(null);
    setCurrentVideo(null);
    setActiveCountryModal(null);
  }

  function handleVideoSelect(video: VideoSubmission, category: VideoCategory) {
    setCurrentVideo({ video, category });
  }

  function handleCloseVideo() {
    setCurrentVideo(null);
  }

  function handleCloseCountryModal() {
    setActiveCountryModal(null);
  }

  function getCountryEntries(countryCode: string): CountryEntry[] {
    return visibleEntries.filter((entry) => entry.country_code === countryCode);
  }

  async function handleSaveCountryEntry(payload: {
    countryCode: string;
    content: string;
    pros: string[];
    cons: string[];
    beenThere: boolean;
    livedThere: boolean;
  }): Promise<boolean> {
    if (!user?.id) {
      return false;
    }

    try {
      const { error } = await supabase.from('country_entries').upsert(
        {
          user_id: user.id,
          country_code: payload.countryCode,
          content: payload.content,
          pros: payload.pros,
          cons: payload.cons,
          been_there: payload.beenThere,
          lived_there: payload.livedThere,
        },
        { onConflict: 'user_id,country_code' }
      );

      if (error) throw error;

      await refreshCountryEntries();
      return true;
    } catch (error) {
      console.error('Error saving country entry:', error);
      return false;
    }
  }

  async function handleDeleteCountryEntry(entryId: string): Promise<boolean> {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('country_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshCountryEntries();
      await refreshEntryFavorites();
      return true;
    } catch (error) {
      console.error('Error deleting country entry:', error);
      return false;
    }
  }

  function handleRequireAuthForEntry() {
    setAuthMode('login');
    setShowAuthModal(true);
  }

  async function handleToggleEntryFavorite(entryId: string): Promise<boolean> {
    if (!user?.id) {
      handleRequireAuthForEntry();
      return false;
    }

    try {
      if (favoriteEntryIds.has(entryId)) {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('country_entry_id', entryId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: user.id,
            country_entry_id: entryId,
          });
        if (error) throw error;
      }

      await refreshEntryFavorites();
      return true;
    } catch (error) {
      console.error('Error toggling entry favorite:', error);
      return false;
    }
  }

  function handleOpenSubmitFromPlayer(countryCode: string, category: VideoCategory) {
    setSelectedCountry(countryCode);
    setSubmissionCountry(countryCode);
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

    // Get all videos for the same country (all categories)
    let filtered = videoCache.filter(v =>
      v.country_code === currentVideo.video.country_code
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

  function handleSubmitClick() {
    // Allow submissions without login
    if (selectedCountry) {
      setSubmissionCountry(selectedCountry);
    }
    setShowSubmissionForm(true);
  }

  function handleEditSubmission(countryCode: string) {
    setSelectedCountry(countryCode);
    setSubmissionCountry(countryCode);
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
    setSubmissionCountry(null);
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

      if (!next.all && !next.favorites && !next.mine) {
        next.all = true;
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
          title: 'All Public Posts',
          description: 'Now showing all public posts on the map'
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
  const isAllPresenceFilter = !entryPresenceFilters.been && !entryPresenceFilters.lived;
  const presenceFilterCounts = useMemo(() => {
    const allCountries = new Set<string>();
    const beenCountries = new Set<string>();
    const livedCountries = new Set<string>();

    for (const entry of filteredEntries) {
      if (!entry.country_code) continue;
      allCountries.add(entry.country_code);
      if (entry.been_there) beenCountries.add(entry.country_code);
      if (entry.lived_there) livedCountries.add(entry.country_code);
    }

    return {
      all: allCountries.size,
      been: beenCountries.size,
      lived: livedCountries.size,
    };
  }, [filteredEntries]);

  const hideSidebarOnMobileList = isMobile && viewMode === 'list';
  const topCountries = useMemo(() => {
    if (!entriesReady || presenceFilteredEntries.length === 0) return [];

    const counts = new Map<string, number>();
    for (const entry of presenceFilteredEntries) {
      if (!entry.country_code) continue;
      counts.set(entry.country_code, (counts.get(entry.country_code) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([code, count]) => ({
        code,
        count,
        name: getCountryName(code),
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 6);
  }, [presenceFilteredEntries, entriesReady]);

  return (
    <div className="home-layout h-screen overflow-hidden">
      {/* Sidebar - bottom on mobile, left on desktop */}
      {!hideSidebarOnMobileList && (
      <div className="home-sidebar" style={{
        boxShadow: activeCountryModal ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        flexShrink: 0,
        overflowY: 'auto',
        backgroundColor: activeCountryModal ? 'transparent' : '#ffffff',
        color: '#000000',
        visibility: activeCountryModal ? 'hidden' : 'visible',
        pointerEvents: activeCountryModal ? 'none' : 'auto'
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
          <div className="h-full flex flex-col" style={{ padding: isMobile ? '20px 16px 16px' : '24px' }}>
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: isMobile ? '0px' : '48px' }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                alignItems: 'stretch',
                padding: isMobile ? '0 12px' : 0,
                width: '100%',
                marginTop: isMobile ? '12px' : '20px'
              }}>
                <h2 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 700, color: '#0f172a', margin: 0, textAlign: 'center' }}>
                  Top Posts
                </h2>
                {!entriesReady && (
                  <div style={{ fontSize: '13px', color: '#64748b' }}>Loading...</div>
                )}
                {entriesReady && topCountries.length === 0 && (
                  <div style={{ fontSize: '13px', color: '#64748b' }}>No posts yet.</div>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr',
                    gap: isMobile ? '8px' : '10px',
                    marginTop: '8px',
                  }}
                >
                  {topCountries.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => handleCountryClick(country.code)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: isMobile ? '10px 12px' : '12px 14px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: '#f8fafc',
                        color: '#0f172a',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>
                        {country.name}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {country.count} {country.count === 1 ? 'post' : 'posts'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer - Subtitle and Links */}
            <div style={{ marginTop: 'auto', paddingTop: '24px', paddingBottom: isMobile ? '32px' : '60px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: user ? '18px' : '14px',
                  fontSize: '14px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setEntryPresenceFilters({ been: false, lived: false })}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#475569',
                    cursor: 'pointer',
                    fontWeight: isAllPresenceFilter ? 700 : 500,
                    fontSize: '14px',
                  }}
                >
                  All ({presenceFilterCounts.all})
                </button>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <button
                  type="button"
                  onClick={() => setEntryPresenceFilters((prev) => ({ ...prev, been: !prev.been }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#475569',
                    cursor: 'pointer',
                    fontWeight: entryPresenceFilters.been ? 700 : 500,
                    fontSize: '14px',
                  }}
                >
                  Been ({presenceFilterCounts.been})
                </button>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <button
                  type="button"
                  onClick={() => setEntryPresenceFilters((prev) => ({ ...prev, lived: !prev.lived }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#475569',
                    cursor: 'pointer',
                    fontWeight: entryPresenceFilters.lived ? 700 : 500,
                    fontSize: '14px',
                  }}
                >
                  Lived ({presenceFilterCounts.lived})
                </button>
              </div>

              {user && (
                <div style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  textAlign: 'center',
                  marginTop: '0',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
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

              {/* Terms/Privacy/About - Centered */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
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
      )}

      {/* Map/List Container - takes remaining space */}
      <div
        className="home-map flex-1 relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
        style={hideSidebarOnMobileList ? { height: '100%' } : undefined}
      >
        {viewMode === 'map' ? (
          <WorldMap
            onCountryClick={handleCountryClick}
            selectedCountry={selectedCountry}
            onBackgroundClick={handleBackgroundClick}
            countriesWithVideos={countriesWithVideos}
          />
        ) : (
          <div style={{
            height: '100%',
            backgroundColor: '#475569',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {hideSidebarOnMobileList && (
              <div style={{
                padding: '18px 20px 22px',
                background: 'linear-gradient(135deg, #0f172a, #1e293b 60%, #334155)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <button
                  onClick={() => setViewMode('map')}
                  style={{
                    color: '#0f172a',
                    background: '#f8fafc',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '999px',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.45)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 14px 28px rgba(15, 23, 42, 0.55)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 10px 25px rgba(15, 23, 42, 0.45)';
                  }}
                >
                  <span role="img" aria-label="Map">🗺️</span>
                  Back to Map View
                </button>
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <ListView
                onVideoClick={(video, category) => {
                  setCurrentVideo({ video, category });
                }}
                categoryFilter={selectedCategoryFilter}
              />
            </div>
          </div>
        )}
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
          selectedCategoryFilter={selectedCategoryFilter}
        />
      )}

      {activeCountryModal && (
        <CountryImpressionModal
          key={activeCountryModal}
          countryCode={activeCountryModal}
          entries={getCountryEntries(activeCountryModal)}
          authorNames={entryAuthorNames}
          favoriteEntryIds={favoriteEntryIds}
          currentUserId={user?.id ?? null}
          onClose={handleCloseCountryModal}
          onRequireAuth={handleRequireAuthForEntry}
          onSaveEntry={handleSaveCountryEntry}
          onDeleteEntry={handleDeleteCountryEntry}
          onToggleFavorite={handleToggleEntryFavorite}
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
      {showSubmissionForm && submissionCountry && (
        <AddVideoModal
          countryCode={submissionCountry}
          onClose={() => {
            setShowSubmissionForm(false);
            setSelectedCountry(null);
            setSubmissionCountry(null);
          }}
          onSuccess={handleSubmissionSuccess}
          onChange={refreshVideoCache}
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
            setSubmissionCountry(pickerCountry);
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
          isAdmin={isAdminUser}
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
              maxWidth: '900px',
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
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Discover The World Cultures</h2>
            </div>
            <p style={{ lineHeight: 1.6, color: '#e2e8f0' }}>
              It is incredibly difficult to find good content for every country around the world. Culturia is here to help you learn the world without excessive YouTube searches. We show you what it is actually like in every part of the world. We also want you to hear every language from every country through videos created by locals, in their native language, speaking authentically.
            </p>

            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', letterSpacing: '0.2em', color: '#f97316', marginBottom: '12px' }}>WHY THESE 4 CATEGORIES?</h3>
              <div style={{ display: 'grid', gap: '16px' }}>
                {[
                  { icon: '🎤', title: 'Talks', body: 'Listen to people talking in their native language—discussing ideas, sharing stories, giving speeches, and having conversations.' },
                  { icon: '🎵', title: 'Music', body: 'Every culture expresses itself through music. From traditional folk songs to modern hits, experience the sounds that define a place.' },
                  { icon: '😄', title: 'Comedy', body: 'Humor reveals what a culture finds funny, clever, or absurd. It is cultural insight wrapped in entertainment.' },
                  { icon: '📹', title: 'Daily Life', body: 'Experience authentic everyday moments—food, market scenes, local customs, daily routines, cultural practices, and nature.' },
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
                Discover the world through curated Content and immerse yourself in world cultures and languages.
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
