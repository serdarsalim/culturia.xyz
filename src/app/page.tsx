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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    setSelectedCountry(countryCode);
    setSidebarOpen(true);
    setCurrentVideo(null);
  }

  function handleCloseSidebar() {
    setSelectedCountry(null);
    setSidebarOpen(false);
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
    if (!user) {
      setShowAuthModal(true);
    } else {
      setShowSubmissionForm(true);
    }
  }

  function handleAuthSuccess() {
    setShowAuthModal(false);
    setShowSubmissionForm(true);
  }

  function handleSubmissionSuccess() {
    setShowSubmissionForm(false);
    alert('Thank you! Your submission will be reviewed by our team.');
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            CULTURIA
          </h1>
        </div>

        {/* Only show user info when logged in, hide sign in button */}
        {user && (
          <nav className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign Out
            </button>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar - on left */}
        {sidebarOpen && selectedCountry && (
          <div className="hidden lg:block w-2/5 border-r border-gray-200 shadow-2xl bg-white">
            <CountrySidebar
              countryCode={selectedCountry}
              onClose={handleCloseSidebar}
              onVideoSelect={handleVideoSelect}
              onSubmitClick={handleSubmitClick}
            />
          </div>
        )}

        {/* Map Container */}
        <div className={`transition-all duration-300 ${sidebarOpen ? 'w-full lg:w-3/5' : 'w-full'} relative`}>
          <WorldMap
            onCountryClick={handleCountryClick}
            selectedCountry={selectedCountry}
            onBackgroundClick={handleCloseSidebar}
          />
        </div>

        {/* Mobile Bottom Sheet */}
        {sidebarOpen && selectedCountry && (
          <div className="lg:hidden fixed inset-x-0 bottom-0 h-1/2 bg-white shadow-2xl z-40 overflow-hidden rounded-t-3xl">
            <CountrySidebar
              countryCode={selectedCountry}
              onClose={handleCloseSidebar}
              onVideoSelect={handleVideoSelect}
              onSubmitClick={handleSubmitClick}
            />
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
        />
      )}

      {/* Footer */}
      <footer className="bg-white/90 backdrop-blur-sm border-t border-gray-200 px-6 py-2 text-center text-xs text-gray-600 z-10">
        <p>
          © {new Date().getFullYear()} CULTURIA • Discover authentic cultural content
          {' • '}
          <a href="/terms" className="text-blue-600 hover:text-blue-700 transition-colors">Terms</a>
        </p>
      </footer>
    </div>
  );
}
