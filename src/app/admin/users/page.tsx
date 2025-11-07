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
      // Fetch all users from auth.users
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) throw authError;

      // Fetch submission counts for each user
      const { data: submissions, error: submissionsError } = await supabase
        .from('video_submissions')
        .select('user_id');

      if (submissionsError) throw submissionsError;

      // Count submissions per user
      const submissionCounts = submissions?.reduce((acc: Record<string, number>, sub) => {
        acc[sub.user_id] = (acc[sub.user_id] || 0) + 1;
        return acc;
      }, {});

      // Combine user data with submission counts
      const usersWithCounts = authUsers.users.map(user => ({
        id: user.id,
        email: user.email || 'No email',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        banned_until: user.banned_until,
        submission_count: submissionCounts?.[user.id] || 0,
      }));

      setUsers(usersWithCounts);
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
      // Ban user for 100 years (effectively permanent)
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: '876000h', // 100 years
      });

      if (error) throw error;

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
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      });

      if (error) throw error;

      showToast('User unsuspended successfully', 'success');
      fetchUsers();
    } catch (error) {
      console.error('Error unsuspending user:', error);
      showToast('Failed to unsuspend user', 'error');
    }
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`⚠️ WARNING: Are you sure you want to permanently delete ${email}?\n\nThis will delete:\n- Their account\n- All their submissions\n- All their data\n\nThis action CANNOT be undone!`)) {
      return;
    }

    try {
      // First delete all their submissions
      const { error: submissionsError } = await supabase
        .from('video_submissions')
        .delete()
        .eq('user_id', userId);

      if (submissionsError) throw submissionsError;

      // Then delete the user
      const { error: userError } = await supabase.auth.admin.deleteUser(userId);

      if (userError) throw userError;

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
              gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr',
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
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr',
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
                <div style={{ color: '#a1a1aa', fontSize: '14px' }}>
                  {new Date(user.created_at).toLocaleDateString()}
                </div>
                <div>
                  {user.banned_until ? (
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
