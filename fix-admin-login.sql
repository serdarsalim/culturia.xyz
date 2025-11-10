-- Fix admin login by updating RLS policies
-- The issue is that authenticated users can't read their own admin_users record during login
-- and recursive policies on admin_users caused infinite recursion once RLS was enabled.

-- Helper functions (security definer) so policies don't recurse on admin_users itself
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Reset policies to use the helper functions
DROP POLICY IF EXISTS "Users can view own admin record" ON admin_users;
DROP POLICY IF EXISTS "Users can check their own admin status" ON admin_users;
DROP POLICY IF EXISTS "Admins can view admin list" ON admin_users;
DROP POLICY IF EXISTS "Admins can view all admin records" ON admin_users;
DROP POLICY IF EXISTS "Super admins can insert admins" ON admin_users;
DROP POLICY IF EXISTS "Super admins can update admins" ON admin_users;

CREATE POLICY "Users can view own admin record"
ON admin_users FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view admin list"
ON admin_users FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Super admins can insert admins"
ON admin_users FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update admins"
ON admin_users FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Verify the policies
SELECT * FROM pg_policies WHERE tablename = 'admin_users';

-- Test the query that the login page uses
SELECT * FROM admin_users WHERE id = auth.uid();
