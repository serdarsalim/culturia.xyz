'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import WorldMap from '@/components/WorldMap';
import CountrySidebar from '@/components/CountrySidebar';
import VideoPlayer from '@/components/VideoPlayer';
import AuthModal from '@/components/AuthModal';
import SubmissionForm from '@/components/SubmissionForm';
import type { VideoSubmission, VideoCategory } from '@/types';

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<{ video: VideoSubmission; category: VideoCategory } | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Check authentication
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  function handleCountryClick(countryCode: string) {
    console.log('handleCountryClick called with:', countryCode);
    setSelectedCountry(countryCode);
    setCurrentVideo(null);
    console.log('Country selected:', countryCode);
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

  async function handleNextVideo() {
    if (!currentVideo) return;

    try {
      // Fetch another random video from same category and country
      const { data, error } = await supabase
        .from('video_submissions')
        .select('*')
        .eq('country_code', currentVideo.video.country_code)
        .eq('category', currentVideo.category)
        .eq('status', 'approved')
        .neq('id', currentVideo.video.id) // Exclude current video
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching next video:', error);
        return;
      }

      if (data && data.length > 0) {
        const randomVideo = data[Math.floor(Math.random() * data.length)];
        setCurrentVideo({ video: randomVideo, category: currentVideo.category });
      } else {
        alert('No more videos available in this category');
      }
    } catch (error) {
      console.error('Error fetching next video:', error);
    }
  }

  function handleSubmitClick() {
    // Allow submissions without login
    setShowSubmissionForm(true);
  }

  function handleAuthSuccess() {
    setShowAuthModal(false);
    // Keep submission form open if it was already open
    // User can now click submit again after logging in
  }

  function handleSubmissionSuccess() {
    setShowSubmissionForm(false);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar - always visible on the left */}
      <div style={{
        width: '280px',
        height: '100%',
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
          />
        ) : (
          <div className="h-full flex flex-col" style={{ padding: '32px' }}>
            {/* Auth Links at top left */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', fontSize: '14px' }}>
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
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
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
                  Log Out
                </button>
              )}
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '80px' }}>
              <h1 style={{
                fontSize: '32px',
                fontWeight: '600',
                color: '#000000',
                marginBottom: '12px',
                letterSpacing: '-0.02em'
              }}>
                🌍 CULTURIA
              </h1>
              <p style={{
                fontSize: '15px',
                color: '#4b5563',
                marginBottom: '32px',
                lineHeight: '1.6',
                maxWidth: '100%'
              }}>
                Discover authentic cultural content from around the world
              </p>
              <div>
                <p style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#6b7280',
                  marginBottom: '16px'
                }}>
                  Click on any country to explore
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#000000' }}>
                    <span style={{ fontSize: '20px' }}>💡</span> Inspiration
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#000000' }}>
                    <span style={{ fontSize: '20px' }}>🎵</span> Music
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#000000' }}>
                    <span style={{ fontSize: '20px' }}>😄</span> Comedy
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#000000' }}>
                    <span style={{ fontSize: '20px' }}>🍳</span> Cooking
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#000000' }}>
                    <span style={{ fontSize: '20px' }}>🎤</span> Street Voices
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Container - takes remaining space */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
        <WorldMap
          onCountryClick={handleCountryClick}
          selectedCountry={selectedCountry}
          onBackgroundClick={handleBackgroundClick}
        />
      </div>

      {/* Video Player Overlay */}
      {currentVideo && (
        <VideoPlayer
          video={currentVideo.video}
          category={currentVideo.category}
          onClose={handleCloseVideo}
          onNext={handleNextVideo}
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

      {/* Toast Notification */}
      {showToast && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 100,
          backgroundColor: '#10b981',
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
          <span style={{ fontSize: '20px' }}>✓</span>
          <div>
            <div style={{ fontWeight: '600' }}>Submitted for Review</div>
            <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>
              Your submission will be reviewed by our team
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
