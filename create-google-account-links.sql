-- Create google_account_links table
-- This maps Google accounts to Supabase user accounts

CREATE TABLE IF NOT EXISTS google_account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_id VARCHAR(255) NOT NULL UNIQUE,
  google_email VARCHAR(255) NOT NULL,
  google_name VARCHAR(255),
  google_picture_url TEXT,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_user_google UNIQUE(user_id, google_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_account_links_user_id ON google_account_links(user_id);
CREATE INDEX IF NOT EXISTS idx_google_account_links_google_id ON google_account_links(google_id);
CREATE INDEX IF NOT EXISTS idx_google_account_links_google_email ON google_account_links(google_email);

-- Enable RLS
ALTER TABLE google_account_links ENABLE ROW LEVEL SECURITY;

-- Users can view their own linked accounts
CREATE POLICY "Users can view own google links"
ON google_account_links FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own google links (unlink)
CREATE POLICY "Users can delete own google links"
ON google_account_links FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Only service role can insert/update (via API)
-- This prevents users from directly manipulating the links table

COMMENT ON TABLE google_account_links IS 'Maps Google OAuth accounts to Supabase users for authentication';
COMMENT ON COLUMN google_account_links.google_id IS 'Google sub (subject) claim from JWT';
COMMENT ON COLUMN google_account_links.google_email IS 'Email from Google account';
COMMENT ON COLUMN google_account_links.linked_at IS 'When the Google account was first linked';
COMMENT ON COLUMN google_account_links.last_login_at IS 'Last time user signed in via this Google account';
