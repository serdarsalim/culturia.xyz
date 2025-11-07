-- Fix RLS policy to allow users to update their own submissions regardless of status
-- This allows editing approved videos and resetting them to pending
-- Run this in your Supabase SQL Editor

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can update own pending submissions" ON video_submissions;

-- Create new policy that allows users to update ANY of their own submissions
-- The application code will handle setting status to 'pending' on resubmission
CREATE POLICY "Users can update own submissions"
ON video_submissions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
