'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import AdminLayout from '@/components/AdminLayout';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  submission_count?: number;
  rejected_count?: number;
  is_admin?: boolean;
}

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Fetch users via API route
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const { users: fetchedUsers } = await response.json();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function suspendUser(userId: string, email: string) {
    if (!confirm(`Are you sure you want to suspend ${email}? They will not be able to sign in.`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'suspend', userId, email }),
      });

      if (!response.ok) throw new Error('Failed to suspend user');

      showToast('User suspended successfully', 'success');
      fetchUsers();
    } catch (error) {
      console.error('Error suspending user:', error);
      showToast('Failed to suspend user', 'error');
    }
  }

  async function unsuspendUser(userId: string, email: string) {
    if (!confirm(`Are you sure you want to unsuspend ${email}?`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'unsuspend', userId, email }),
      });

      if (!response.ok) throw new Error('Failed to unsuspend user');

      showToast('User unsuspended successfully', 'success');
      fetchUsers();
    } catch (error) {
      console.error('Error unsuspending user:', error);
      showToast('Failed to unsuspend user', 'error');
    }
  }

  async function rejectAllVideos(userId: string, email: string, submissionCount: number) {
    if (submissionCount === 0) {
      showToast('User has no submissions to reject', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to reject ALL ${submissionCount} video(s) from ${email}?\n\nThis will:\n- Mark all their submissions as rejected\n- Remove all approved videos from the site\n- Move pending videos to rejected\n\nYou can re-approve videos individually later if needed.`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reject_all_videos', userId, email }),
      });

      if (!response.ok) throw new Error('Failed to reject videos');

      const result = await response.json();
      showToast(`Rejected ${result.count || submissionCount} video(s) successfully`, 'success');
      fetchUsers();
    } catch (error) {
      console.error('Error rejecting videos:', error);
      showToast('Failed to reject videos', 'error');
    }
  }

  async function approveAllVideos(userId: string, email: string, submissionCount: number) {
    if (submissionCount === 0) {
      showToast('User has no submissions to approve', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to approve ALL ${submissionCount} video(s) from ${email}?\n\nThis will:\n- Mark all their submissions as approved\n- Publish all videos to the site\n- Override any rejected videos\n\n⚠️ Make sure you trust this user!`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve_all_videos', userId, email }),
      });

      if (!response.ok) throw new Error('Failed to approve videos');

      const result = await response.json();
      showToast(`Approved ${result.count || submissionCount} video(s) successfully`, 'success');
      fetchUsers();
    } catch (error) {
      console.error('Error approving videos:', error);
      showToast('Failed to approve videos', 'error');
    }
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`⚠️ WARNING: Are you sure you want to permanently delete ${email}?\n\nThis will delete:\n- Their account\n- All their submissions\n- All their data\n\nThis action CANNOT be undone!`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'delete', userId, email }),
      });

      if (!response.ok) throw new Error('Failed to delete user');

      showToast('User and all data deleted successfully', 'success');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Failed to delete user', 'error');
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div style={{ padding: '32px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
            Users Management
          </h1>
          <p style={{ color: '#a1a1aa' }}>Manage user accounts and permissions</p>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 50,
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            background: toast.type === 'success' ? '#16a34a' : '#dc2626',
            color: 'white',
            fontWeight: '500',
          }}>
            {toast.message}
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email or user ID..."
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '12px 16px',
              background: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        {/* Users Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <div style={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '8px' }}>Total Users</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>{users.length}</div>
          </div>
          <div style={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '8px' }}>Active Users</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#22c55e' }}>
              {users.filter(u => !u.banned_until).length}
            </div>
          </div>
          <div style={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '8px' }}>Suspended</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ef4444' }}>
              {users.filter(u => u.banned_until).length}
            </div>
          </div>
        </div>

        {/* Users List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '2px solid #f59e0b',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              margin: '0 auto',
              animation: 'spin 1s linear infinite',
            }}></div>
            <p style={{ marginTop: '16px', color: '#a1a1aa' }}>Loading users...</p>
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{
            background: '#18181b',
            borderRadius: '12px',
            padding: '48px',
            textAlign: 'center',
            border: '1px solid #27272a',
          }}>
            <span style={{ fontSize: '60px', display: 'block', marginBottom: '16px' }}>👤</span>
            <p style={{ fontSize: '20px', color: '#a1a1aa' }}>No users found</p>
            <p style={{ color: '#71717a', marginTop: '8px' }}>Try adjusting your search</p>
          </div>
        ) : (
          <div style={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 2fr',
              padding: '16px 24px',
              background: '#09090b',
              borderBottom: '1px solid #27272a',
              fontSize: '12px',
              fontWeight: '600',
              color: '#a1a1aa',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <div>Email</div>
              <div>Submissions</div>
              <div>Rejected</div>
              <div>Joined</div>
              <div>Status</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            {/* Table Rows */}
            {filteredUsers.map((user, index) => (
              <div
                key={user.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 2fr',
                  padding: '20px 24px',
                  borderBottom: index < filteredUsers.length - 1 ? '1px solid #27272a' : 'none',
                  alignItems: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#27272a'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  color: 'white',
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user.email}
                </div>
                <div style={{ color: '#a1a1aa', fontSize: '14px' }}>
                  {user.submission_count}
                </div>
                <div style={{ color: user.rejected_count ? '#ef4444' : '#a1a1aa', fontSize: '14px' }}>
                  {user.rejected_count || 0}
                </div>
                <div style={{ color: '#a1a1aa', fontSize: '14px' }}>
                  {new Date(user.created_at).toLocaleDateString()}
                </div>
                <div>
                  {user.is_admin ? (
                    <span style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.2)',
                      border: '1px solid #f59e0b',
                      color: '#f59e0b',
                    }}>
                      Admin
                    </span>
                  ) : user.banned_until ? (
                    <span style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      color: '#ef4444',
                    }}>
                      Suspended
                    </span>
                  ) : (
                    <span style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      background: 'rgba(34, 197, 94, 0.2)',
                      border: '1px solid #22c55e',
                      color: '#22c55e',
                    }}>
                      Active
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  {user.is_admin ? (
                    <span style={{ fontSize: '12px', color: '#71717a', fontStyle: 'italic' }}>
                      Protected
                    </span>
                  ) : (
                    <>
                      {user.banned_until ? (
                        <button
                          onClick={() => unsuspendUser(user.id, user.email)}
                          style={{
                            padding: '6px 12px',
                            background: '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#16a34a'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#22c55e'}
                        >
                          Unsuspend
                        </button>
                      ) : (
                        <button
                          onClick={() => suspendUser(user.id, user.email)}
                          style={{
                            padding: '6px 12px',
                            background: '#ca8a04',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#a16207'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#ca8a04'}
                        >
                          Suspend
                        </button>
                      )}
                      {user.submission_count > 0 && (
                        <>
                          <button
                            onClick={() => approveAllVideos(user.id, user.email, user.submission_count || 0)}
                            style={{
                              padding: '6px 12px',
                              background: '#16a34a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#15803d'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#16a34a'}
                          >
                            Approve All
                          </button>
                          <button
                            onClick={() => rejectAllVideos(user.id, user.email, user.submission_count || 0)}
                            style={{
                              padding: '6px 12px',
                              background: '#ea580c',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#c2410c'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#ea580c'}
                          >
                            Reject All
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteUser(user.id, user.email)}
                        style={{
                          padding: '6px 12px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#b91c1c'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#dc2626'}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
