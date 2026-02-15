'use client';

import { useState, useEffect, ReactNode } from 'react';
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
        minHeight: '100vh',
        background: '#09090b',
      }}
    >
      <AdminNav adminEmail={adminUser.email} />
      <main
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}
