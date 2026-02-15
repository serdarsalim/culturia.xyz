'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryName, getCountryFlag } from '@/lib/countries';
import { CATEGORY_LABELS, type VideoCategory, type VideoSubmission, type CountryEntry } from '@/types';
import EditSubmissionModal from './EditSubmissionModal';

interface ProfileModalProps {
  onClose: () => void;
  onPlayVideo: (video: VideoSubmission, category: VideoCategory) => void;
  onEditSubmission: (countryCode: string) => void;
  initialData?: {
    favorites: Array<{ video: VideoSubmission; category: VideoCategory }>;
    submissions: VideoSubmission[];
  } | null;
  mapSources: { all: boolean; favorites: boolean; mine: boolean };
  onToggleMapSource: (key: 'all' | 'favorites' | 'mine', value: boolean) => void;
  initialTab?: 'favorites' | 'submissions' | 'settings';
  initialProfile?: { username: string | null; display_name: string | null; is_private: boolean | null } | null;
  onProfileSettingsChange?: (data: { username: string | null; display_name: string | null; is_private: boolean }) => void;
  isAdmin?: boolean;
}

export default function ProfileModal({
  onClose,
  onPlayVideo,
  onEditSubmission,
  initialData,
  mapSources,
  onToggleMapSource,
  initialTab = 'favorites',
  initialProfile,
  onProfileSettingsChange,
  isAdmin = false
}: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'favorites' | 'submissions' | 'settings'>(initialTab);
  const [favorites, setFavorites] = useState<Array<{ video: VideoSubmission; category: VideoCategory }>>(initialData?.favorites || []);
  const [entryFavorites, setEntryFavorites] = useState<CountryEntry[]>([]);
  const [entrySubmissions, setEntrySubmissions] = useState<CountryEntry[]>([]);
  const [expandedEntryCountries, setExpandedEntryCountries] = useState<Set<string>>(new Set());
  const [expandedSubmissionCountries, setExpandedSubmissionCountries] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<VideoSubmission[]>(initialData?.submissions || []);
  const [loading, setLoading] = useState(!initialData);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', description: '', type: 'success' as 'success' | 'error' });
  const [showLibraryFavorites, setShowLibraryFavorites] = useState(true);
  const [showLibrarySubmissions, setShowLibrarySubmissions] = useState(true);

  // Profile settings state
  const [username, setUsername] = useState(initialProfile?.username || '');
  const [displayName, setDisplayName] = useState(initialProfile?.display_name || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(!!initialProfile);
  const [initialUsername, setInitialUsername] = useState(initialProfile?.username || '');
  const [editingSubmission, setEditingSubmission] = useState<VideoSubmission | null>(null);
  const [initialDisplayName, setInitialDisplayName] = useState(initialProfile?.display_name || '');
  const [isPrivate, setIsPrivate] = useState<boolean | null>(
    initialProfile?.is_private ?? false
  );
  const [initialIsPrivate, setInitialIsPrivate] = useState(initialProfile?.is_private ?? false);
  const [updatingSubmissionId, setUpdatingSubmissionId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveState, setProfileSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [profileDirty, setProfileDirty] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || null;

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch both favorites and submissions on mount only if no initial data
  useEffect(() => {
    if (!initialData) {
      fetchAllData();
    }
    if (!initialProfile) {
      fetchProfile();
    } else {
      setProfileLoaded(true);
    }
  }, [initialProfile]);

  useEffect(() => {
    if (initialProfile) {
      setUsername(initialProfile.username || '');
      setDisplayName(initialProfile.display_name || '');
      setIsPrivate(initialProfile.is_private ?? false);
      setInitialUsername(initialProfile.username || '');
      setInitialDisplayName(initialProfile.display_name || '');
      setInitialIsPrivate(initialProfile.is_private ?? false);
    }
  }, [initialProfile]);

  // Refetch when tab changes
  useEffect(() => {
    if (activeTab === 'favorites') {
      fetchFavorites();
    } else if (activeTab === 'submissions' && entrySubmissions.length === 0) {
      fetchEntrySubmissions();
    } else if (activeTab === 'settings') {
      if (favorites.length === 0) fetchFavorites();
      if (submissions.length === 0) fetchSubmissions();
    }
  }, [activeTab]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // Invalidate all refresh tokens for this user to avoid silent reauth in other tabs
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      console.error('Global sign-out error:', error);
    }

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign-out error:', error);
    }

    try {
      if (typeof window !== 'undefined') {
        if (projectRef) {
          const keyPrefix = `sb-${projectRef}-auth-token`;
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith(keyPrefix)) {
              localStorage.removeItem(key);
            }
          });
        }
        window.location.href = '/';
      }
    } finally {
      setLoggingOut(false);
    }
  }

  async function fetchAllData() {
    setLoading(true);
    try {
      await Promise.all([fetchFavorites(), fetchSubmissions()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFavorites() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_favorites')
        .select(`
          submission_id,
          country_entry_id,
          video_submissions (*),
          country_entries (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const favoritesData = (data || [])
        .filter((fav: any) => !!fav.submission_id && !!fav.video_submissions)
        .map((fav: any) => ({
        video: fav.video_submissions,
        category: fav.video_submissions.category as VideoCategory
      })) || [];
      const entryFavoritesData = (data || [])
        .filter((fav: any) => !!fav.country_entry_id && !!fav.country_entries)
        .map((fav: any) => fav.country_entries as CountryEntry);

      setFavorites(favoritesData);
      setEntryFavorites(entryFavoritesData);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  }

  function toggleEntryCountry(countryCode: string) {
    setExpandedEntryCountries((prev) => {
      const next = new Set(prev);
      if (next.has(countryCode)) {
        next.delete(countryCode);
      } else {
        next.add(countryCode);
      }
      return next;
    });
  }

  function toggleSubmissionCountry(countryCode: string) {
    setExpandedSubmissionCountries((prev) => {
      const next = new Set(prev);
      if (next.has(countryCode)) {
        next.delete(countryCode);
      } else {
        next.add(countryCode);
      }
      return next;
    });
  }

  async function fetchSubmissions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('video_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  }

  async function fetchEntrySubmissions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('country_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setEntrySubmissions((data || []) as CountryEntry[]);
    } catch (error) {
      console.error('Error fetching entry submissions:', error);
    }
  }

  async function fetchData() {
    if (activeTab === 'favorites') {
      await fetchFavorites();
    } else {
      await fetchSubmissions();
    }
  }

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('username, display_name, is_private')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        const fetchedUsername = data.username || '';
        const fetchedDisplayName = data.display_name || '';
        const fetchedIsPrivate = data.is_private ?? false;
        setUsername(fetchedUsername);
        setDisplayName(fetchedDisplayName);
        setIsPrivate(fetchedIsPrivate);
        // Store initial values to compare against later
        setInitialUsername(fetchedUsername);
        setInitialDisplayName(fetchedDisplayName);
        setInitialIsPrivate(fetchedIsPrivate);
      }
      // Mark profile as loaded after setting initial values
      setProfileLoaded(true);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfileLoaded(true); // Still mark as loaded even on error
    }
  }

  function hasProfileChanges() {
    return (
      username !== initialUsername ||
      displayName !== initialDisplayName ||
      isPrivate !== initialIsPrivate
    );
  }

  useEffect(() => {
    if (!profileLoaded) return;
    setProfileDirty(hasProfileChanges());
    if (profileSaveState === 'saved' && hasProfileChanges()) {
      setProfileSaveState('idle');
    }
  }, [username, displayName, isPrivate, profileLoaded]);

  async function handleSaveProfile() {
    if (!profileLoaded || profileSaving || !hasProfileChanges()) {
      return;
    }

    setUsernameError('');
    setProfileSaveState('idle');

    try {
      setProfileSaving(true);
      setProfileSaveState('saving');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
        setUsernameError('Username can only contain letters, numbers, and underscores');
        throw new Error('validation');
      }

      if (username && username.length < 3) {
        setUsernameError('Username must be at least 3 characters');
        throw new Error('validation');
      }

      if (isPrivate === null) return;

      const { error } = await supabase
        .from('user_profiles')
        .update({
          username: username || null,
          display_name: displayName || null,
          is_private: isPrivate,
        })
        .eq('id', user.id);

      if (error) {
        if (error.code === '23505') {
          setUsernameError('Username already taken');
          throw new Error('validation');
        }
        throw error;
      }

      setInitialUsername(username);
      setInitialDisplayName(displayName);
      setInitialIsPrivate(isPrivate);
      onProfileSettingsChange?.({
        username: username || null,
        display_name: displayName || null,
        is_private: isPrivate,
      });

      setProfileDirty(false);
      setProfileSaveState('saved');
      setTimeout(() => setProfileSaveState('idle'), 2000);
    } catch (error) {
      if ((error as Error).message === 'validation') {
        setProfileSaveState('idle');
      } else {
        console.error('Error saving profile:', error);
        setProfileSaveState('error');
        setToastMessage({
          title: 'Save Failed',
          description: 'Please try again',
          type: 'error'
        });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } finally {
      setProfileSaving(false);
    }
  }

  function handleDisplayNameChange(value: string) {
    setDisplayName(value);
  }

  function handleUsernameChange(value: string) {
    setUsername(value);
    setUsernameError('');
  }

  function renderProfileStatus() {
    if (profileSaveState === 'saving') return 'Saving…';
    if (profileSaveState === 'saved') return 'Saved';
    if (profileSaveState === 'error') return 'Save failed';
    if (profileDirty) return 'Unsaved changes';
    return null;
  }

  async function handleDeleteSubmission(id: string) {
    if (!confirm('Are you sure you want to delete this submission?')) return;

    try {
      const { error } = await supabase
        .from('video_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setToastMessage({
        title: 'Submission Deleted',
        description: 'Your submission has been removed',
        type: 'success'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Refresh submissions
      fetchData();
    } catch (error) {
      console.error('Error deleting submission:', error);
      setToastMessage({
        title: 'Failed to Delete',
        description: 'Please try again later',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }

  async function handleToggleVisibility(video: VideoSubmission) {
    try {
      setUpdatingSubmissionId(video.id);
      let newStatus: 'private' | 'pending' | 'approved';

      // Toggle between private and public
      if (video.status === 'private') {
        if (isAdmin || video.was_approved) {
          newStatus = 'approved';
        } else {
          newStatus = 'pending';
        }
      } else {
        // Make private (works for both pending and approved)
        newStatus = 'private';
      }

      const updateData: Partial<VideoSubmission> = { status: newStatus };
      if (newStatus === 'approved') {
        updateData.was_approved = true;
      }

      const { error } = await supabase
        .from('video_submissions')
        .update(updateData)
        .eq('id', video.id);

      if (error) throw error;

      // Update local state
      setSubmissions(prev => prev.map(s =>
        s.id === video.id
          ? { ...s, status: newStatus, ...(newStatus === 'approved' ? { was_approved: true } : {}) }
          : s
      ));

      setToastMessage({
        title: newStatus === 'private'
          ? 'Made Private'
          : newStatus === 'approved'
            ? 'Now Public'
            : 'Submitted for Review',
        description: newStatus === 'private'
          ? 'Your video is now private and removed from the map'
          : newStatus === 'approved'
            ? 'Your video is now live and visible to everyone'
            : 'Your video has been submitted for admin approval',
        type: 'success'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Error toggling visibility:', error);
      setToastMessage({
        title: 'Update Failed',
        description: 'Please try again later',
        type: 'error'
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setUpdatingSubmissionId(null);
    }
  }

  function renderStatusBadge(status: string) {
    const statusConfig = {
      private: { text: 'Private', icon: '🔒', bg: '#f3f4f6', color: '#4b5563' },
      pending: { text: 'Pending', icon: '⏳', bg: '#fef3c7', color: '#92400e' },
      approved: { text: 'Public', icon: '🌐', bg: '#d1fae5', color: '#065f46' },
      rejected: { text: 'Rejected', icon: '✕', bg: '#fee2e2', color: '#991b1b' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];

    return (
      <span style={{
        display: 'inline-block',
        padding: isMobile ? '2px 4px' : '4px 10px',
        borderRadius: '4px',
        backgroundColor: config.bg,
        color: config.color,
        fontSize: isMobile ? '10px' : '12px',
        fontWeight: '600',
        lineHeight: '1'
      }}>
        {isMobile ? config.icon : config.text}
      </span>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 60,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        maxWidth: '900px',
        width: '100%',
        maxHeight: isMobile ? '85vh' : '90vh',
        padding: isMobile ? '24px 20px' : '32px',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }} onClick={(e) => e.stopPropagation()}>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            cursor: 'pointer',
            border: 'none',
            backgroundColor: '#f3f4f6',
            borderRadius: '50%',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e5e7eb';
            e.currentTarget.style.color = '#000000';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
            e.currentTarget.style.color = '#6b7280';
          }}
        >
          ✕
        </button>


        {/* Tabs */}
        <div style={{ display: 'flex', gap: isMobile ? '4px' : '8px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <button
            onClick={() => setActiveTab('favorites')}
            style={{
              padding: isMobile ? '10px 12px' : '12px 24px',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '600',
              color: activeTab === 'favorites' ? '#f97316' : '#6b7280',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'favorites' ? '2px solid #f97316' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flex: isMobile ? 1 : 'initial'
            }}
          >
            {isMobile ? '❤️' : '❤️ Favorites'}
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            style={{
              padding: isMobile ? '10px 12px' : '12px 24px',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '600',
              color: activeTab === 'submissions' ? '#f97316' : '#6b7280',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'submissions' ? '2px solid #f97316' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flex: isMobile ? 1 : 'initial'
            }}
          >
            {isMobile ? '📤' : '📤 Submissions'}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: isMobile ? '10px 12px' : '12px 24px',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '600',
              color: activeTab === 'settings' ? '#f97316' : '#6b7280',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'settings' ? '2px solid #f97316' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flex: isMobile ? 1 : 'initial'
            }}
          >
            {isMobile ? '⚙️' : '⚙️ Settings'}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
              Loading...
            </div>
          ) : activeTab === 'favorites' ? (
            favorites.length === 0 && entryFavorites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                <p style={{ fontSize: '48px', marginBottom: '16px' }}>🤍</p>
                <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No favorites yet</p>
                <p style={{ fontSize: '14px' }}>Start exploring and save posts or videos you love!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {Object.entries(
                  favorites.reduce((acc, f) => {
                    const cc = f.video.country_code;
                    (acc[cc] ||= []).push(f);
                    return acc;
                  }, {} as Record<string, Array<{ video: VideoSubmission; category: VideoCategory }>>)
                ).map(([cc, favs]) => (
                  <div key={cc} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                    {/* Country header */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '22px' }}>{getCountryFlag(cc)}</span>
                      <span style={{ fontWeight: 700, color: '#111827' }}>{getCountryName(cc)}</span>
                    </div>
                    {/* Favorites list for country */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {favs.map(({ video, category }) => (
                        <div
                          key={video.id}
                          onClick={() => onPlayVideo(video, category)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                              {CATEGORY_LABELS[category]}
                            </span>
                            <span style={{ fontSize: '14px', color: '#111827', fontWeight: 600 }}>
                              {video.title || 'Untitled'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {Object.entries(
                  entryFavorites.reduce((acc, entry) => {
                    const cc = entry.country_code;
                    (acc[cc] ||= []).push(entry);
                    return acc;
                  }, {} as Record<string, CountryEntry[]>)
                ).map(([cc, entries]) => (
                  <div key={`entry-${cc}`} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                    <button
                      onClick={() => toggleEntryCountry(cc)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '22px' }}>{getCountryFlag(cc)}</span>
                        <span style={{ fontWeight: 700, color: '#111827' }}>{getCountryName(cc)}</span>
                      </div>
                      <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 600 }}>
                        {expandedEntryCountries.has(cc) ? 'Hide' : 'Show'} ({entries.length})
                      </span>
                    </button>
                    {!expandedEntryCountries.has(cc) && (
                      <div style={{ padding: '10px 16px', color: '#4b5563', fontSize: '13px' }}>
                        {(entries[0]?.content || '').slice(0, 140)}
                        {(entries[0]?.content || '').length > 140 ? '...' : ''}
                      </div>
                    )}
                    {expandedEntryCountries.has(cc) && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {entries.map((entry) => (
                          <div key={entry.id} style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6' }}>
                            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Post</span>
                            <div style={{ marginTop: '4px', fontSize: '14px', color: '#111827', whiteSpace: 'pre-wrap' }}>
                              {entry.content}
                            </div>
                            {(entry.pros?.length > 0 || entry.cons?.length > 0) && (
                              <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#111827' }}>
                                  {entry.pros?.length > 0 ? (
                                    <>
                                      <strong>Pros:</strong> {entry.pros.join(', ')}
                                    </>
                                  ) : null}
                                </div>
                                <div style={{ fontSize: '12px', color: '#111827' }}>
                                  {entry.cons?.length > 0 ? (
                                    <>
                                      <strong>Cons:</strong> {entry.cons.join(', ')}
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'submissions' ? (
            entrySubmissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                <p style={{ fontSize: '48px', marginBottom: '16px' }}>📤</p>
                <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No submissions yet</p>
                <p style={{ fontSize: '14px' }}>Share your country entries.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {Object.entries(
                  entrySubmissions.reduce((acc, entry) => {
                    (acc[entry.country_code] ||= []).push(entry);
                    return acc;
                  }, {} as Record<string, CountryEntry[]>)
                ).map(([cc, entries]) => (
                  <div key={cc} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                    <button
                      onClick={() => toggleSubmissionCountry(cc)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '22px' }}>{getCountryFlag(cc)}</span>
                        <span style={{ fontWeight: 700, color: '#111827' }}>{getCountryName(cc)}</span>
                      </div>
                      <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 600 }}>
                        {expandedSubmissionCountries.has(cc) ? 'Hide' : 'Show'} ({entries.length})
                      </span>
                    </button>
                    {!expandedSubmissionCountries.has(cc) && (
                      <div style={{ padding: '10px 16px', color: '#4b5563', fontSize: '13px' }}>
                        {(entries[0]?.content || '').slice(0, 140)}
                        {(entries[0]?.content || '').length > 140 ? '...' : ''}
                      </div>
                    )}
                    {expandedSubmissionCountries.has(cc) && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {entries.map((entry) => (
                          <div key={entry.id} style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6' }}>
                            <div style={{ marginTop: '4px', fontSize: '14px', color: '#111827', whiteSpace: 'pre-wrap' }}>
                              {entry.content}
                            </div>
                            {(entry.pros?.length > 0 || entry.cons?.length > 0) && (
                              <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#111827' }}>
                                  {entry.pros?.length > 0 ? (
                                    <>
                                      <strong>Pros:</strong> {entry.pros.join(', ')}
                                    </>
                                  ) : null}
                                </div>
                                <div style={{ fontSize: '12px', color: '#111827' }}>
                                  {entry.cons?.length > 0 ? (
                                    <>
                                      <strong>Cons:</strong> {entry.cons.join(', ')}
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '20px' }}>
              {/* Profile Settings */}
              <div>
                <div style={{
                  marginBottom: isMobile ? '8px' : '12px'
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Profile Information</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '18px', maxWidth: '100%' }}>
                  {/* Display Name, Username, and Save - 3 column grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '8px' : '12px', alignItems: 'start' }}>
                    {/* Display Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => handleDisplayNameChange(e.target.value)}
                        placeholder="Your full name"
                        maxLength={100}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          color: '#000000',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Username */}
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="your_username"
                        maxLength={30}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: `1px solid ${usernameError ? '#ef4444' : '#d1d5db'}`,
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          color: '#000000',
                          outline: 'none'
                        }}
                      />
                      {usernameError && (
                        <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                          {usernameError}
                        </p>
                      )}
                    </div>

                    {/* Save Button */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      paddingTop: isMobile ? '0' : '27px',
                      paddingLeft: isMobile ? '0' : '20px',
                      paddingRight: isMobile ? '0' : '20px',
                      marginBottom: isMobile ? '12px' : '0'
                    }}>
                      <div style={{ width: '100%' }}>
                        <button
                          type="button"
                          onClick={handleSaveProfile}
                          disabled={!profileDirty || profileSaving}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: (!profileDirty || profileSaving) ? '#e5e7eb' : '#0f172a',
                            color: (!profileDirty || profileSaving) ? '#94a3b8' : '#ffffff',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: (!profileDirty || profileSaving) ? 'default' : 'pointer',
                            transition: 'background-color 0.2s',
                            height: '42px'
                          }}
                        >
                          {profileSaving ? 'Saving…' : 'Save Profile'}
                        </button>
                        {renderProfileStatus() && (
                          <p style={{
                            fontSize: '12px',
                            color: profileSaveState === 'error'
                              ? '#b91c1c'
                              : profileSaveState === 'saved'
                                ? '#15803d'
                                : '#6b7280',
                            marginTop: '4px',
                            textAlign: 'center'
                          }}>
                            {renderProfileStatus()}
                          </p>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Map Visibility */}
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: isMobile ? '2px' : '4px' }}>Map Visibility</h3>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: isMobile ? '6px' : '8px' }}>Choose what the map highlights.</p>
                <div style={{
                  display: isMobile ? 'flex' : 'grid',
                  flexDirection: isMobile ? 'column' : undefined,
                  gridTemplateColumns: isMobile ? undefined : 'repeat(3, 1fr)',
                  gap: isMobile ? '6px' : '8px'
                }}>
                  {([
                    { key: 'all', label: 'All public posts', desc: 'Public, approved content' },
                    { key: 'favorites', label: 'My favorites', desc: 'Places you starred', requiresAuth: true },
                    { key: 'mine', label: 'My submissions', desc: 'Countries you contributed to', requiresAuth: true },
                  ] as Array<{ key: 'all' | 'favorites' | 'mine'; label: string; desc: string; requiresAuth?: boolean }>).map(opt => {
                    const checked = mapSources[opt.key];
                    return (
                      <label key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '14px', color: '#111827', fontWeight: 600 }}>{opt.label}</span>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>{opt.desc}</span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={checked}
                          onClick={() => onToggleMapSource(opt.key, !checked)}
                          style={{
                            width: '48px',
                            height: '28px',
                            borderRadius: '9999px',
                            border: '1px solid ' + (checked ? '#34d399' : '#d1d5db'),
                            backgroundColor: checked ? '#34d399' : '#e5e7eb',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          aria-label={`Toggle ${opt.label}`}
                        >
                          <span style={{
                            position: 'absolute',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            left: checked ? '22px' : '2px',
                            width: '22px',
                            height: '22px',
                            borderRadius: '9999px',
                            backgroundColor: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            transition: 'left 0.15s ease'
                          }} />
                        </button>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Account Actions */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: isMobile ? '12px' : '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: isMobile ? '6px' : '8px' }}>Account</h3>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#ef4444',
                    backgroundColor: loggingOut ? '#fef2f2' : '#ffffff',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    cursor: loggingOut ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!loggingOut) {
                      e.currentTarget.style.backgroundColor = '#fef2f2';
                      e.currentTarget.style.borderColor = '#ef4444';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loggingOut) {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#fecaca';
                    }
                  }}
                >
                  {loggingOut ? 'Logging out...' : 'Log Out'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Toast Notification */}
        {showToast && (
          <div style={{
            position: 'fixed',
            bottom: '32px',
            right: '32px',
            zIndex: 100,
            backgroundColor: toastMessage.type === 'error' ? '#ef4444' : '#10b981',
            color: '#ffffff',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '15px',
            fontWeight: '500'
          }}>
            <span style={{ fontSize: '20px' }}>
              {toastMessage.type === 'error' ? '⚠️' : '✓'}
            </span>
            <div>
              <div style={{ fontWeight: '600' }}>{toastMessage.title}</div>
              <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>
                {toastMessage.description}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Submission Modal */}
      {editingSubmission && (
        <EditSubmissionModal
          submission={editingSubmission}
          onClose={() => setEditingSubmission(null)}
          onSuccess={() => {
            setEditingSubmission(null);
            fetchAllData();
            setToastMessage({
              title: 'Success',
              description: 'Submission updated successfully',
              type: 'success'
            });
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
          }}
        />
      )}
    </div>
  );
}
