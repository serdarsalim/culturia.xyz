-- Fix admin login by updating RLS policies
-- The issue is that authenticated users can't read their own admin_users record during login

-- First, check existing policies
SELECT * FROM pg_policies WHERE tablename = 'admin_users';

-- Drop the restrictive policy that requires you to already be an admin to check if you're an admin
DROP POLICY IF EXISTS "Admins can view admin list" ON admin_users;

-- Create a new policy that allows authenticated users to check if THEY are an admin
CREATE POLICY "Users can check their own admin status"
ON admin_users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Re-create the admin-only view policy for viewing OTHER admins
CREATE POLICY "Admins can view all admin records"
ON admin_users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

-- Verify the policies
SELECT * FROM pg_policies WHERE tablename = 'admin_users';

-- Test the query that the login page uses
SELECT * FROM admin_users WHERE id = auth.uid();
