'use client';

import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface AdminNavProps {
  adminEmail: string;
}

export default function AdminNav({ adminEmail }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/admin');
  }

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/admin/all', label: 'Posts', icon: '📝' },
    { href: '/admin/users', label: 'Users', icon: '👥' },
  ];

  return (
    <div
      style={{
        width: '256px',
        background: '#18181b',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '24px',
          borderBottom: '1px solid #27272a',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>C</span>
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>CULTURIA</h1>
            <p style={{ fontSize: '12px', color: '#a1a1aa' }}>Admin Panel</p>
          </div>
        </div>
        <p
          style={{
            fontSize: '12px',
            color: '#71717a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {adminEmail}
        </p>
      </div>

      <nav
        style={{
          flex: 1,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'all 0.2s',
                background: isActive ? 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)' : 'transparent',
                color: isActive ? 'white' : '#a1a1aa',
                boxShadow: isActive ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                <span style={{ fontWeight: '500' }}>{item.label}</span>
              </div>
            </a>
          );
        })}
      </nav>

      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #27272a',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            color: '#a1a1aa',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: '20px' }}>🌍</span>
          <span style={{ fontWeight: '500' }}>View Site</span>
        </a>
        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            color: '#a1a1aa',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '16px',
          }}
        >
          <span style={{ fontSize: '20px' }}>🚪</span>
          <span style={{ fontWeight: '500' }}>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
