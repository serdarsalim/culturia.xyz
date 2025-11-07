'use client';

import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface AdminNavProps {
  pendingCount?: number;
  adminEmail: string;
}

export default function AdminNav({ pendingCount = 0, adminEmail }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/admin');
  }

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📊', badge: null },
    { href: '/admin/pending', label: 'Pending', icon: '⏳', badge: pendingCount > 0 ? pendingCount : null },
    { href: '/admin/all', label: 'All Submissions', icon: '📹', badge: null },
    { href: '/admin/rejected', label: 'Rejected', icon: '❌', badge: null },
  ];

  return (
    <div className="w-64 bg-zinc-900 min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">CULTURIA</h1>
            <p className="text-xs text-zinc-400">Admin Panel</p>
          </div>
        </div>
        <p className="text-xs text-zinc-500 truncate">{adminEmail}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </div>
              {item.badge !== null && (
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                  isActive
                    ? 'bg-white text-amber-600'
                    : 'bg-amber-500 text-white'
                }`}>
                  {item.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800 space-y-2">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
        >
          <span className="text-xl">🌍</span>
          <span className="font-medium">View Site</span>
        </a>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
        >
          <span className="text-xl">🚪</span>
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
