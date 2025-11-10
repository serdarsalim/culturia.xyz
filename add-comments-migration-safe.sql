-- Safe migration to add country comments table
-- This script checks for existing objects before creating them
-- Run this in Supabase SQL Editor

-- Country Comments Table (only if doesn't exist)
CREATE TABLE IF NOT EXISTS country_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code VARCHAR(3) NOT NULL, -- ISO 3166-1 alpha-3
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: One comment per user per country
  UNIQUE(user_id, country_code)
);

-- Indexes for performance (only if don't exist)
CREATE INDEX IF NOT EXISTS idx_country_comments_country ON country_comments(country_code);
CREATE INDEX IF NOT EXISTS idx_country_comments_user ON country_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_country_comments_updated ON country_comments(updated_at DESC);

-- Trigger to automatically update updated_at for comments (safe creation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_country_comments_updated_at'
  ) THEN
    CREATE TRIGGER update_country_comments_updated_at
      BEFORE UPDATE ON country_comments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE country_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public can view all comments" ON country_comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON country_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON country_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON country_comments;
DROP POLICY IF EXISTS "Admins can delete any comment" ON country_comments;

-- Create RLS Policies

-- Anyone (including anonymous) can view all comments
CREATE POLICY "Public can view all comments"
ON country_comments FOR SELECT
USING (true);

-- Authenticated users can insert comments
CREATE POLICY "Authenticated users can insert comments"
ON country_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON country_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON country_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can delete any comment
CREATE POLICY "Admins can delete any comment"
ON country_comments FOR DELETE
TO authenticated
USING (public.is_admin());

-- Comment on table
COMMENT ON TABLE country_comments IS 'Stores user comments/perspectives for each country';

-- Verify the setup
SELECT
  'country_comments table created' as status,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'country_comments';
