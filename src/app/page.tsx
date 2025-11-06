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
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);

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
    alert('Thank you! Your submission will be reviewed by our team.');
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map Container - full width */}
        <div className="w-full h-full">
          <WorldMap
            onCountryClick={handleCountryClick}
            selectedCountry={selectedCountry}
            onBackgroundClick={handleCloseSidebar}
          />
        </div>

        {/* Sidebar - always visible */}
        <div className="fixed left-0 top-0 bottom-0 w-80 shadow-2xl bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 z-50">
          {selectedCountry ? (
            <CountrySidebar
              countryCode={selectedCountry}
              onClose={handleCloseSidebar}
              onVideoSelect={handleVideoSelect}
              onSubmitClick={handleSubmitClick}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <h1 className="text-4xl font-bold text-white mb-4">
                🌍 CULTURIA
              </h1>
              <p className="text-slate-300 text-lg mb-6">
                Discover authentic cultural content from around the world
              </p>
              <div className="text-slate-400 text-sm space-y-3">
                <p>👆 Click on any country to explore:</p>
                <ul className="text-left space-y-2">
                  <li>💡 Inspiration</li>
                  <li>🎵 Music</li>
                  <li>😄 Comedy</li>
                  <li>🍳 Cooking</li>
                  <li>🎤 Street Voices</li>
                </ul>
              </div>
            </div>
          )}
        </div>
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
    </div>
  );
}
