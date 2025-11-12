import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Superadmin email that cannot be demoted
const SUPERADMIN_EMAIL = 'slmxyz@gmail.com';

// Create admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request: Request) {
  try {
    // Verify the requester is an admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (adminError || !adminUser) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 });
    }

    // Fetch all users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      throw authError;
    }

    // Fetch submission counts
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from('video_submissions')
      .select('user_id, status');

    if (submissionsError) {
      throw submissionsError;
    }

    // Fetch all admin users
    const { data: adminUsers, error: adminUsersError } = await supabaseAdmin
      .from('admin_users')
      .select('id');

    if (adminUsersError) {
      throw adminUsersError;
    }

    const adminUserIds = new Set(adminUsers?.map(a => a.id) || []);

    // Count total and rejected submissions per user
    const submissionCounts: Record<string, number> = {};
    const rejectedCounts: Record<string, number> = {};

    submissions?.forEach(sub => {
      submissionCounts[sub.user_id] = (submissionCounts[sub.user_id] || 0) + 1;
      if (sub.status === 'rejected') {
        rejectedCounts[sub.user_id] = (rejectedCounts[sub.user_id] || 0) + 1;
      }
    });

    // Combine user data with submission counts and admin status
    const usersWithCounts = authUsers.users.map(u => ({
      id: u.id,
      email: u.email || 'No email',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      // 'banned_until' is present at runtime from GoTrue but not typed in @supabase/supabase-js
      banned_until: (u as any).banned_until ?? null,
      submission_count: submissionCounts[u.id] || 0,
      rejected_count: rejectedCounts[u.id] || 0,
      is_admin: adminUserIds.has(u.id),
    }));

    return NextResponse.json({ users: usersWithCounts });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (adminError || !adminUser) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 });
    }

    const { action, userId, email } = await request.json();

    if (action === 'suspend') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: '876000h', // 100 years
      });

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'User suspended' });
    }

    if (action === 'unsuspend') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      });

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'User unsuspended' });
    }

    if (action === 'reject_all_videos') {
      // Reject all submissions from this user
      const { data, error } = await supabaseAdmin
        .from('video_submissions')
        .update({ status: 'rejected' })
        .eq('user_id', userId)
        .select();

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'All videos rejected', count: data?.length || 0 });
    }

    if (action === 'approve_all_videos') {
      // Approve all submissions from this user
      const { data, error } = await supabaseAdmin
        .from('video_submissions')
        .update({ status: 'approved' })
        .eq('user_id', userId)
        .select();

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'All videos approved', count: data?.length || 0 });
    }

    if (action === 'delete') {
      // Prevent deleting superadmin
      if (email === SUPERADMIN_EMAIL) {
        return NextResponse.json({ error: 'Cannot delete superadmin' }, { status: 403 });
      }

      // First delete all their submissions
      const { error: submissionsError } = await supabaseAdmin
        .from('video_submissions')
        .delete()
        .eq('user_id', userId);

      if (submissionsError) throw submissionsError;

      // Then delete the user
      const { error: userDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (userDeleteError) throw userDeleteError;

      return NextResponse.json({ success: true, message: 'User deleted' });
    }

    if (action === 'make_admin') {
      // Add user to admin_users table
      const { error } = await supabaseAdmin
        .from('admin_users')
        .insert({
          id: userId,
          email: email,
          role: 'admin'
        });

      if (error) {
        // If already exists, that's fine
        if (error.code !== '23505') {
          throw error;
        }
      }

      return NextResponse.json({ success: true, message: 'User promoted to admin' });
    }

    if (action === 'remove_admin') {
      // Prevent removing superadmin
      if (email === SUPERADMIN_EMAIL) {
        return NextResponse.json({ error: 'Cannot demote superadmin' }, { status: 403 });
      }

      // Remove user from admin_users table
      const { error } = await supabaseAdmin
        .from('admin_users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Admin privileges removed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing user:', error);
    return NextResponse.json({ error: 'Failed to manage user' }, { status: 500 });
  }
}
