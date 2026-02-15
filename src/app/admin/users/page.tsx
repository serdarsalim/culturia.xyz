'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { type VideoSubmission, type VideoCategory } from '@/types';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  submission_count?: number;
  rejected_count?: number;
  is_admin?: boolean;
  is_private?: boolean;
}

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedUserForVideos, setSelectedUserForVideos] = useState<User | null>(null);
  const [selectedUserForActions, setSelectedUserForActions] = useState<User | null>(null);
  const [userVideos, setUserVideos] = useState<VideoSubmission[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDangerous?: boolean;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

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
    setConfirmDialog({
      show: true,
      title: 'Suspend User',
      message: `Are you sure you want to suspend ${email}?\n\nThey will not be able to sign in.`,
      confirmText: 'Suspend',
      isDangerous: true,
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, show: false });
        await performSuspendUser(userId, email);
      },
    });
  }

  async function performSuspendUser(userId: string, email: string) {
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
    setConfirmDialog({
      show: true,
      title: 'Unsuspend User',
      message: `Are you sure you want to unsuspend ${email}?`,
      confirmText: 'Unsuspend',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, show: false });
        await performUnsuspendUser(userId, email);
      },
    });
  }

  async function performUnsuspendUser(userId: string, email: string) {
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

    setConfirmDialog({
      show: true,
      title: 'Reject All Videos',
      message: `Are you sure you want to reject ALL ${submissionCount} video(s) from ${email}?\n\nThis will:\n• Mark all their submissions as rejected\n• Remove all approved videos from the site\n• Move pending videos to rejected\n\nYou can re-approve videos individually later if needed.`,
      confirmText: 'Reject All',
      isDangerous: true,
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, show: false });
        await performRejectAllVideos(userId, email, submissionCount);
      },
    });
  }

  async function performRejectAllVideos(userId: string, email: string, submissionCount: number) {
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

    setConfirmDialog({
      show: true,
      title: 'Approve All Videos',
      message: `Are you sure you want to approve ALL ${submissionCount} video(s) from ${email}?\n\nThis will:\n• Mark all their submissions as approved\n• Publish all videos to the site\n• Override any rejected videos\n\n⚠️ Make sure you trust this user!`,
      confirmText: 'Approve All',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, show: false });
        await performApproveAllVideos(userId, email, submissionCount);
      },
    });
  }

  async function performApproveAllVideos(userId: string, email: string, submissionCount: number) {
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
    setConfirmDialog({
      show: true,
      title: '⚠️ Delete User',
      message: `WARNING: Are you sure you want to permanently delete ${email}?\n\nThis will delete:\n• Their account\n• All their submissions\n• All their data\n\nThis action CANNOT be undone!`,
      confirmText: 'Delete Permanently',
      isDangerous: true,
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, show: false });
        await performDeleteUser(userId, email);
      },
    });
  }

  async function performDeleteUser(userId: string, email: string) {
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

  async function viewUserVideos(user: User) {
    setSelectedUserForVideos(user);
    setLoadingVideos(true);
    setUserVideos([]);

    try {
      const { data, error } = await supabase
        .from('video_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUserVideos(data || []);
    } catch (error) {
      console.error('Error fetching user videos:', error);
      showToast('Failed to load user videos', 'error');
    } finally {
      setLoadingVideos(false);
    }
  }

  function closeUserVideos() {
    setSelectedUserForVideos(null);
    setUserVideos([]);
  }

  function openUserActions(user: User) {
    setSelectedUserForActions(user);
  }

  function closeUserActions() {
    setSelectedUserForActions(null);
  }

  function getUserStatus(user: User): string | null {
    if (user.email === 'slmxyz@gmail.com') return 'Superadmin';
    if (user.is_admin) return 'Admin';
    if (user.banned_until) return 'Suspended';

    const approved = (user.submission_count || 0) - (user.rejected_count || 0);
    const rejected = user.rejected_count || 0;

    if (user.submission_count && user.submission_count > 0) {
      if (rejected === user.submission_count) return 'All Videos Rejected';
      if (approved === user.submission_count) return 'All Videos Approved';
    }

    return null;
  }

  async function makeAdmin(userId: string, email: string) {
    setConfirmDialog({
      show: true,
      title: 'Make Admin',
      message: `Are you sure you want to make ${email} an admin?\n\nThey will have full access to:\n• User management\n• Video moderation\n• All admin features`,
      confirmText: 'Make Admin',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, show: false });
        await performMakeAdmin(userId, email);
      },
    });
  }

  async function performMakeAdmin(userId: string, email: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'make_admin', userId, email }),
      });

      if (!response.ok) throw new Error('Failed to make admin');

      showToast('User promoted to admin successfully', 'success');
      fetchUsers();
    } catch (error) {
      console.error('Error making admin:', error);
      showToast('Failed to promote user to admin', 'error');
    }
  }

  async function removeAdmin(userId: string, email: string) {
    setConfirmDialog({
      show: true,
      title: 'Remove Admin',
      message: `Are you sure you want to remove admin privileges from ${email}?`,
      confirmText: 'Remove Admin',
      isDangerous: true,
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, show: false });
        await performRemoveAdmin(userId, email);
      },
    });
  }

  async function performRemoveAdmin(userId: string, email: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'remove_admin', userId, email }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error === 'Cannot demote superadmin') {
          showToast('Cannot demote superadmin', 'error');
        } else {
          throw new Error('Failed to remove admin');
        }
        return;
      }

      showToast('Admin privileges removed successfully', 'success');
      fetchUsers();
    } catch (error) {
      console.error('Error removing admin:', error);
      showToast('Failed to remove admin privileges', 'error');
    }
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
              gridTemplateColumns: '3fr 1fr 1fr 1fr 2fr',
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
            </div>

            {/* Table Rows */}
            {filteredUsers.map((user, index) => (
              <div
                key={user.id}
                onClick={() => openUserActions(user)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '3fr 1fr 1fr 1fr 2fr',
                  padding: '20px 24px',
                  borderBottom: index < filteredUsers.length - 1 ? '1px solid #27272a' : 'none',
                  alignItems: 'center',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      background: user.is_private ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                      border: user.is_private ? '1px solid #ef4444' : '1px solid #22c55e',
                      color: user.is_private ? '#ef4444' : '#22c55e',
                    }}>
                      {user.is_private ? 'Private account' : 'Public account'}
                    </span>
                    {getUserStatus(user) && (
                      <span style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '8px',
                        background: user.email === 'slmxyz@gmail.com'
                          ? 'rgba(168, 85, 247, 0.2)'
                          : user.is_admin
                          ? 'rgba(245, 158, 11, 0.2)'
                          : user.banned_until
                          ? 'rgba(239, 68, 68, 0.2)'
                          : (user.rejected_count === user.submission_count)
                          ? 'rgba(239, 68, 68, 0.2)'
                          : 'rgba(34, 197, 94, 0.2)',
                        border: user.email === 'slmxyz@gmail.com'
                          ? '1px solid #a855f7'
                          : user.is_admin
                          ? '1px solid #f59e0b'
                          : user.banned_until
                          ? '1px solid #ef4444'
                          : (user.rejected_count === user.submission_count)
                          ? '1px solid #ef4444'
                          : '1px solid #22c55e',
                        color: user.email === 'slmxyz@gmail.com'
                          ? '#a855f7'
                          : user.is_admin
                          ? '#f59e0b'
                          : user.banned_until
                          ? '#ef4444'
                          : (user.rejected_count === user.submission_count)
                          ? '#ef4444'
                          : '#22c55e',
                      }}>
                        {getUserStatus(user)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User Actions Modal */}
        {selectedUserForActions && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              padding: '20px',
            }}
            onClick={closeUserActions}
          >
            <div
              style={{
                background: '#18181b',
                borderRadius: '16px',
                maxWidth: '500px',
                width: '100%',
                border: '1px solid #27272a',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '24px',
                borderBottom: '1px solid #27272a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                    {selectedUserForActions.email}
                  </h2>
                  <p style={{ color: '#a1a1aa', fontSize: '13px' }}>
                    {selectedUserForActions.submission_count || 0} submission{selectedUserForActions.submission_count !== 1 ? 's' : ''}
                    {selectedUserForActions.rejected_count ? ` • ${selectedUserForActions.rejected_count} rejected` : ''}
                  </p>
                </div>
                <button
                  onClick={closeUserActions}
                  style={{
                    background: '#27272a',
                    border: 'none',
                    borderRadius: '8px',
                    width: '36px',
                    height: '36px',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: '#a1a1aa',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#3f3f46'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#27272a'}
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* View Videos Button */}
                {(selectedUserForActions.submission_count ?? 0) > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      viewUserVideos(selectedUserForActions);
                      closeUserActions();
                    }}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
                  >
                    📹 View All Videos
                  </button>
                )}

                {selectedUserForActions.email !== 'slmxyz@gmail.com' && (
                  <>
                    {/* Admin Toggle */}
                    {selectedUserForActions.is_admin ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAdmin(selectedUserForActions.id, selectedUserForActions.email);
                          closeUserActions();
                        }}
                        style={{
                          width: '100%',
                          padding: '14px',
                          background: '#7c3aed',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#6d28d9'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#7c3aed'}
                      >
                        👤 Remove Admin
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          makeAdmin(selectedUserForActions.id, selectedUserForActions.email);
                          closeUserActions();
                        }}
                        style={{
                          width: '100%',
                          padding: '14px',
                          background: '#8b5cf6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#7c3aed'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#8b5cf6'}
                      >
                        👑 Make Admin
                      </button>
                    )}

                    {/* Suspend/Unsuspend */}
                    {selectedUserForActions.banned_until ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unsuspendUser(selectedUserForActions.id, selectedUserForActions.email);
                          closeUserActions();
                        }}
                        style={{
                          width: '100%',
                          padding: '14px',
                          background: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#16a34a'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#22c55e'}
                      >
                        ✅ Unsuspend User
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          suspendUser(selectedUserForActions.id, selectedUserForActions.email);
                          closeUserActions();
                        }}
                        style={{
                          width: '100%',
                          padding: '14px',
                          background: '#ca8a04',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#a16207'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#ca8a04'}
                      >
                        ⛔ Suspend User
                      </button>
                    )}

                    {/* Approve/Reject All */}
                    {(selectedUserForActions.submission_count ?? 0) > 0 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            approveAllVideos(selectedUserForActions.id, selectedUserForActions.email, selectedUserForActions.submission_count || 0);
                            closeUserActions();
                          }}
                          style={{
                            width: '100%',
                            padding: '14px',
                            background: '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#15803d'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#16a34a'}
                        >
                          ✓ Approve All Videos
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            rejectAllVideos(selectedUserForActions.id, selectedUserForActions.email, selectedUserForActions.submission_count || 0);
                            closeUserActions();
                          }}
                          style={{
                            width: '100%',
                            padding: '14px',
                            background: '#ea580c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#c2410c'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#ea580c'}
                        >
                          ✕ Reject All Videos
                        </button>
                      </>
                    )}

                    {/* Delete User */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteUser(selectedUserForActions.id, selectedUserForActions.email);
                        closeUserActions();
                      }}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        marginTop: '12px',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#b91c1c'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#dc2626'}
                    >
                      🗑️ Delete User & All Data
                    </button>
                  </>
                )}

                {selectedUserForActions.email === 'slmxyz@gmail.com' && (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#a1a1aa',
                    fontSize: '14px',
                  }}>
                    <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>👑</span>
                    <p style={{ fontWeight: '600', color: '#a855f7', marginBottom: '8px' }}>Superadmin Account</p>
                    <p>This account is protected and cannot be modified.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* User Videos Modal */}
        {selectedUserForVideos && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              padding: '20px',
            }}
            onClick={closeUserVideos}
          >
            <div
              style={{
                background: '#18181b',
                borderRadius: '16px',
                maxWidth: '1200px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #27272a',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '24px',
                borderBottom: '1px solid #27272a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                    {selectedUserForVideos.email}'s Videos
                  </h2>
                  <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
                    {userVideos.length} video{userVideos.length !== 1 ? 's' : ''} submitted
                  </p>
                </div>
                <button
                  onClick={closeUserVideos}
                  style={{
                    background: '#27272a',
                    border: 'none',
                    borderRadius: '8px',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    fontSize: '20px',
                    color: '#a1a1aa',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#3f3f46'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#27272a'}
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                {loadingVideos ? (
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
                    <p style={{ marginTop: '16px', color: '#a1a1aa' }}>Loading videos...</p>
                  </div>
                ) : userVideos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: '#a1a1aa' }}>
                    <span style={{ fontSize: '60px', display: 'block', marginBottom: '16px' }}>🎬</span>
                    <p style={{ fontSize: '18px' }}>No videos found</p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '16px',
                  }}>
                    {userVideos.map((video) => (
                      <div
                        key={video.id}
                        style={{
                          background: '#09090b',
                          border: '1px solid #27272a',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          transition: 'transform 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        {/* Video Thumbnail */}
                        <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000' }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${video.youtube_video_id}`}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              border: 'none',
                            }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>

                        {/* Video Info */}
                        <div style={{ padding: '16px' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '8px',
                          }}>
                            <span style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: '600',
                              borderRadius: '6px',
                              background: video.status === 'approved'
                                ? 'rgba(34, 197, 94, 0.2)'
                                : video.status === 'rejected'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(245, 158, 11, 0.2)',
                              border: video.status === 'approved'
                                ? '1px solid #22c55e'
                                : video.status === 'rejected'
                                ? '1px solid #ef4444'
                                : '1px solid #f59e0b',
                              color: video.status === 'approved'
                                ? '#22c55e'
                                : video.status === 'rejected'
                                ? '#ef4444'
                                : '#f59e0b',
                            }}>
                              {video.status.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '12px', color: '#71717a' }}>
                              {video.category}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '13px',
                            color: '#a1a1aa',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}>
                            <span>🌍 {video.country_code}</span>
                            <span>{new Date(video.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmDialog.show && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '20px',
            }}
            onClick={() => setConfirmDialog({ ...confirmDialog, show: false })}
          >
            <div
              style={{
                background: '#18181b',
                borderRadius: '12px',
                maxWidth: '450px',
                width: '100%',
                border: confirmDialog.isDangerous ? '2px solid #dc2626' : '1px solid #27272a',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Dialog Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #27272a',
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: confirmDialog.isDangerous ? '#ef4444' : 'white',
                  margin: 0,
                }}>
                  {confirmDialog.title}
                </h3>
              </div>

              {/* Dialog Content */}
              <div style={{ padding: '24px' }}>
                <p style={{
                  color: '#d1d5db',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  margin: 0,
                  whiteSpace: 'pre-line',
                }}>
                  {confirmDialog.message}
                </p>
              </div>

              {/* Dialog Actions */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #27272a',
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => setConfirmDialog({ ...confirmDialog, show: false })}
                  style={{
                    padding: '10px 20px',
                    background: '#27272a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#3f3f46'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#27272a'}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  style={{
                    padding: '10px 20px',
                    background: confirmDialog.isDangerous ? '#dc2626' : '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = confirmDialog.isDangerous ? '#b91c1c' : '#7c3aed'}
                  onMouseOut={(e) => e.currentTarget.style.background = confirmDialog.isDangerous ? '#dc2626' : '#8b5cf6'}
                >
                  {confirmDialog.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
