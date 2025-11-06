-- Fix infinite recursion in RLS policies
-- Run this in your Supabase SQL Editor

-- First, drop all existing policies
DROP POLICY IF EXISTS "Public can view approved submissions" ON video_submissions;
DROP POLICY IF EXISTS "Authenticated users can insert submissions" ON video_submissions;
DROP POLICY IF EXISTS "Users can view own submissions" ON video_submissions;
DROP POLICY IF EXISTS "Users can update own pending submissions" ON video_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON video_submissions;
DROP POLICY IF EXISTS "Admins can update all submissions" ON video_submissions;
DROP POLICY IF EXISTS "Admins can delete submissions" ON video_submissions;

-- Recreate policies without recursion issues

-- Anyone can view approved submissions (no auth check, no recursion)
CREATE POLICY "Public can view approved submissions"
ON video_submissions FOR SELECT
USING (status = 'approved');

-- Authenticated users can insert their own submissions
CREATE POLICY "Authenticated users can insert submissions"
ON video_submissions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own submissions (simple auth check, no admin_users lookup)
CREATE POLICY "Users can view own submissions"
ON video_submissions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own pending submissions
CREATE POLICY "Users can update own pending submissions"
ON video_submissions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id);

-- For admin operations, we'll handle them at the application level
-- or use a service role key instead of RLS policies to avoid recursion
