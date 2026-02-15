'use client';

import { useState, useEffect, ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import AdminNav from './AdminNav';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<any>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/admin');
        return;
      }

      const { data: admin } = await supabase.from('admin_users').select('*').eq('id', session.user.id).single();

      if (!admin) {
        await supabase.auth.signOut();
        router.push('/admin');
        return;
      }

      setAdminUser(admin);
      setLoading(false);
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    // Wheel fallback to guarantee mouse scrolling on the admin content pane.
    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented) return;
      el.scrollTop += event.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (loading || !adminUser) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#18181b',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '2px solid #f59e0b',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              margin: '0 auto',
              animation: 'spin 1s linear infinite',
            }}
          ></div>
          <p style={{ marginTop: '16px', color: '#a1a1aa' }}>Loading admin panel...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#09090b',
        overflow: 'hidden',
      }}
    >
      <AdminNav adminEmail={adminUser.email} />
      <main
        ref={mainScrollRef}
        className="admin-main-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarGutter: 'stable',
        }}
      >
        {children}
      </main>
      <style jsx>{`
        .admin-main-scroll {
          scrollbar-width: thin;
          scrollbar-color: #475569 #0f172a;
        }
        .admin-main-scroll::-webkit-scrollbar {
          width: 10px;
        }
        .admin-main-scroll::-webkit-scrollbar-track {
          background: #0f172a;
        }
        .admin-main-scroll::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 9999px;
          border: 2px solid #0f172a;
        }
        .admin-main-scroll::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </div>
  );
}
