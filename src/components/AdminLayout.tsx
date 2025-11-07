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
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/admin');
        return;
      }

      const { data: admin } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!admin) {
        await supabase.auth.signOut();
        router.push('/admin');
        return;
      }

      setAdminUser(admin);

      // Fetch pending count for badge
      const { count } = await supabase
        .from('video_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setPendingCount(count || 0);
      setLoading(false);
    }

    checkAuth();
  }, [router]);

  if (loading || !adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-zinc-400">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <AdminNav pendingCount={pendingCount} adminEmail={adminUser.email} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
