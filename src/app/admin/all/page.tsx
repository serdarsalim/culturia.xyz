'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getCountryFlag, getCountryName } from '@/lib/countries';
import { type CountryEntry } from '@/types';
import AdminLayout from '@/components/AdminLayout';

export default function AllPostsPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CountryEntry[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchEntries();
  }, []);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  function toggleExpanded(id: string) {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function fetchEntries() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('country_entries').select('*').order('updated_at', { ascending: false });
      if (error) throw error;

      const list = (data || []) as CountryEntry[];
      setEntries(list);

      const userIds = Array.from(new Set(list.map((entry) => entry.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, username, display_name')
          .in('id', userIds);

        if (!profileError && profiles) {
          const names: Record<string, string> = {};
          for (const profile of profiles) {
            const display = profile.display_name?.trim();
            const username = profile.username?.replace(/^@/, '').trim();
            names[profile.id] = display || (username ? `@${username}` : `user-${profile.id.slice(0, 6)}`);
          }
          setAuthorNames(names);
        }
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      showToast('Failed to load posts', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post? This cannot be undone.')) return;

    setBusyPostId(id);
    try {
      const { error } = await supabase.from('country_entries').delete().eq('id', id);
      if (error) throw error;
      showToast('Post deleted', 'success');
      await fetchEntries();
    } catch (error) {
      console.error('Error deleting post:', error);
      showToast('Failed to delete post', 'error');
    } finally {
      setBusyPostId(null);
    }
  }

  async function toggleForcePrivate(entry: CountryEntry) {
    setBusyPostId(entry.id);
    try {
      const next = !entry.forced_private;
      const { error } = await supabase.from('country_entries').update({ forced_private: next }).eq('id', entry.id);
      if (error) throw error;

      setEntries((prev) => prev.map((item) => (item.id === entry.id ? { ...item, forced_private: next } : item)));
      showToast(next ? 'Post forced private' : 'Post set public', 'success');
    } catch (error) {
      console.error('Error toggling forced private:', error);
      showToast('Failed to update post visibility', 'error');
    } finally {
      setBusyPostId(null);
    }
  }

  const uniqueCountries = useMemo(() => Array.from(new Set(entries.map((e) => e.country_code))).sort(), [entries]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      if (countryFilter !== 'all' && entry.country_code !== countryFilter) return false;

      if (!query) return true;

      const author = (authorNames[entry.user_id] || '').toLowerCase();
      const country = getCountryName(entry.country_code).toLowerCase();
      const content = (entry.content || '').toLowerCase();
      const pros = (entry.pros || []).join(' ').toLowerCase();
      const cons = (entry.cons || []).join(' ').toLowerCase();

      return content.includes(query) || pros.includes(query) || cons.includes(query) || country.includes(query) || author.includes(query);
    });
  }, [entries, countryFilter, searchQuery, authorNames]);

  return (
    <AdminLayout>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>All Posts</h1>
          <p style={{ color: '#a1a1aa' }}>Browse and moderate country posts</p>
        </div>

        {toast && (
          <div
            style={{
              position: 'fixed',
              top: '16px',
              right: '16px',
              zIndex: 50,
              padding: '14px 18px',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              background: toast.type === 'success' ? '#16a34a' : '#dc2626',
              color: 'white',
              fontWeight: '500',
            }}
          >
            {toast.message}
          </div>
        )}

        <div
          style={{
            background: '#18181b',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            border: '1px solid #27272a',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#a1a1aa', marginBottom: '6px' }}>Country</label>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', color: 'white' }}
            >
              <option value="all">All countries</option>
              {uniqueCountries.map((code) => (
                <option key={code} value={code}>
                  {getCountryName(code)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#a1a1aa', marginBottom: '6px' }}>Search</label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Content, pros, cons, country, author"
              style={{ width: '100%', padding: '9px 12px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', color: 'white' }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1', fontSize: '13px', color: '#a1a1aa', paddingTop: '4px' }}>
            Showing <strong style={{ color: 'white' }}>{filtered.length}</strong> of <strong style={{ color: 'white' }}>{entries.length}</strong> posts
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#a1a1aa' }}>Loading posts...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#a1a1aa' }}>
            No posts found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map((entry) => {
              const expanded = expandedPostIds.has(entry.id);
              const preview = (entry.content || '').slice(0, 200);

              return (
                <div key={entry.id} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{ fontSize: '22px' }}>{getCountryFlag(entry.country_code)}</span>
                      <span style={{ color: 'white', fontWeight: 700 }}>{getCountryName(entry.country_code)}</span>
                      <span style={{ color: '#52525b' }}>•</span>
                      <span style={{ color: '#d4d4d8', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {authorNames[entry.user_id] || `user-${entry.user_id.slice(0, 6)}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {entry.forced_private && (
                        <span style={{ fontSize: '11px', color: '#fca5a5', border: '1px solid #7f1d1d', borderRadius: '999px', padding: '3px 8px' }}>Suspended</span>
                      )}
                      <button
                        onClick={() => toggleExpanded(entry.id)}
                        style={{
                          padding: '6px 10px',
                          background: '#3f3f46',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {expanded ? 'Collapse' : 'Expand'}
                      </button>
                      <button
                        onClick={() => toggleForcePrivate(entry)}
                        disabled={busyPostId === entry.id}
                        style={{
                          padding: '6px 10px',
                          background: entry.forced_private ? '#0f766e' : '#7f1d1d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: busyPostId === entry.id ? 'not-allowed' : 'pointer',
                          opacity: busyPostId === entry.id ? 0.7 : 1,
                        }}
                      >
                        {entry.forced_private ? 'Make Public' : 'Force Private'}
                      </button>
                      <button
                        onClick={() => deletePost(entry.id)}
                        disabled={busyPostId === entry.id}
                        style={{
                          padding: '6px 10px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: busyPostId === entry.id ? 'not-allowed' : 'pointer',
                          opacity: busyPostId === entry.id ? 0.7 : 1,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', color: '#e4e4e7', fontSize: '14px', lineHeight: 1.5, whiteSpace: expanded ? 'pre-wrap' : 'normal' }}>
                    {expanded ? entry.content : preview}
                    {!expanded && entry.content.length > 200 ? '...' : ''}
                  </div>

                  {expanded && (entry.pros?.length > 0 || entry.cons?.length > 0) && (
                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#d4d4d8' }}>{entry.pros?.length ? <><strong>Pros:</strong> {entry.pros.join(', ')}</> : null}</div>
                      <div style={{ fontSize: '12px', color: '#d4d4d8' }}>{entry.cons?.length ? <><strong>Cons:</strong> {entry.cons.join(', ')}</> : null}</div>
                    </div>
                  )}

                  <div style={{ marginTop: '10px', color: '#71717a', fontSize: '11px', textAlign: 'right' }}>
                    Updated {new Date(entry.updated_at || entry.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
