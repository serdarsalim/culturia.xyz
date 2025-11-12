-- CULTURIA Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Video Submissions Table
CREATE TABLE IF NOT EXISTS video_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code VARCHAR(3) NOT NULL, -- ISO 3166-1 alpha-3
  category VARCHAR(50) NOT NULL CHECK (category IN ('inspiration', 'music', 'comedy', 'cooking', 'street_voices')),
  youtube_url TEXT NOT NULL,
  youtube_video_id VARCHAR(20) NOT NULL,
  title TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  flagged BOOLEAN DEFAULT FALSE,
  flag_count INTEGER DEFAULT 0,
  flag_reasons TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: One submission per user per category per country
  UNIQUE(user_id, country_code, category)
);

-- Video Flags Table
CREATE TABLE IF NOT EXISTS video_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES video_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('broken', 'wrong_category', 'inappropriate', 'other')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One flag per user per submission
  UNIQUE(submission_id, user_id)
);

-- Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Country Comments Table
CREATE TABLE IF NOT EXISTS country_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code VARCHAR(3) NOT NULL, -- ISO 3166-1 alpha-3
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: One comment per user per country
  UNIQUE(user_id, country_code)
);

-- Insert initial admin user (update with your email)
INSERT INTO admin_users (id, email, role)
SELECT id, email, 'super_admin'
FROM auth.users
WHERE email = 'slmxyz@gmail.com'
ON CONFLICT (email) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_submissions_country ON video_submissions(country_code);
CREATE INDEX IF NOT EXISTS idx_video_submissions_category ON video_submissions(category);
CREATE INDEX IF NOT EXISTS idx_video_submissions_status ON video_submissions(status);
CREATE INDEX IF NOT EXISTS idx_video_submissions_user ON video_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_submissions_flagged ON video_submissions(flagged);
CREATE INDEX IF NOT EXISTS idx_video_flags_submission ON video_flags(submission_id);
CREATE INDEX IF NOT EXISTS idx_country_comments_country ON country_comments(country_code);
CREATE INDEX IF NOT EXISTS idx_country_comments_user ON country_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_country_comments_updated ON country_comments(updated_at DESC);

-- Check for duplicate video IDs within same country/category
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_video_per_country_category
ON video_submissions(youtube_video_id, country_code, category)
WHERE status = 'approved';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_video_submissions_updated_at
  BEFORE UPDATE ON video_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at for comments
CREATE TRIGGER update_country_comments_updated_at
  BEFORE UPDATE ON country_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment flag count when a flag is added
CREATE OR REPLACE FUNCTION increment_flag_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE video_submissions
  SET
    flag_count = flag_count + 1,
    flagged = TRUE,
    flag_reasons = array_append(flag_reasons, NEW.reason::TEXT)
  WHERE id = NEW.submission_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment flag count
CREATE TRIGGER on_video_flag_insert
  AFTER INSERT ON video_flags
  FOR EACH ROW
EXECUTE FUNCTION increment_flag_count();

-- Helper functions for admin checks to avoid recursive policies
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

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE video_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_comments ENABLE ROW LEVEL SECURITY;

-- Video Submissions Policies

-- Anyone can view approved submissions
CREATE POLICY "Public can view approved submissions"
ON video_submissions FOR SELECT
USING (status = 'approved');

-- Authenticated users can insert their own submissions
CREATE POLICY "Authenticated users can insert submissions"
ON video_submissions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own submissions
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

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
ON video_submissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

-- Admins can update all submissions
CREATE POLICY "Admins can update all submissions"
ON video_submissions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

-- Admins can delete submissions
CREATE POLICY "Admins can delete submissions"
ON video_submissions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

-- Video Flags Policies

-- Authenticated users can flag videos
CREATE POLICY "Authenticated users can flag videos"
ON video_flags FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own flags
CREATE POLICY "Users can view own flags"
ON video_flags FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all flags
CREATE POLICY "Admins can view all flags"
ON video_flags FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

-- Admin Users Policies

-- Allow authenticated users to read their own admin row (needed during login)
CREATE POLICY "Users can view own admin record"
ON admin_users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admins can view admin list
CREATE POLICY "Admins can view admin list"
ON admin_users FOR SELECT
TO authenticated
USING (public.is_admin());

-- Super admins can insert new admins
CREATE POLICY "Super admins can insert admins"
ON admin_users FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

-- Super admins can update admins
CREATE POLICY "Super admins can update admins"
ON admin_users FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Country Comments Policies

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

-- Comments
COMMENT ON TABLE video_submissions IS 'Stores all video submissions from users';
COMMENT ON TABLE video_flags IS 'Stores flags/reports on video submissions';
COMMENT ON TABLE admin_users IS 'Stores admin user information';
COMMENT ON TABLE country_comments IS 'Stores user comments/perspectives for each country';
