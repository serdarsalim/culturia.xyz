-- Fix recursive RLS on admin_users after enabling row level security
-- Run this entire script in the Supabase SQL editor whenever the
-- admin_users policies need to be reset.

-- 1) Drop every existing policy on admin_users so we start clean.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'admin_users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON admin_users;', pol.policyname);
  END LOOP;
END $$;

-- 2) Helper functions (security definer) so policies can check admin status
--    without recursively querying admin_users.
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
    SELECT 1 FROM admin_users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- 3) Recreate the policies using the helper functions.
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
