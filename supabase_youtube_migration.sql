-- YouTube OAuth Tokens Table
CREATE TABLE IF NOT EXISTS youtube_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- YouTube Playlists Cache Table (to avoid repeated API searches)
CREATE TABLE IF NOT EXISTS youtube_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  category text NOT NULL,
  youtube_playlist_id text NOT NULL UNIQUE,
  playlist_name text NOT NULL,
  playlist_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(country_code, category)
);

-- YouTube Sync Logs Table (to track sync history)
CREATE TABLE IF NOT EXISTS youtube_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL, -- 'all', 'country', 'category'
  country_code text,
  category text,
  videos_synced integer NOT NULL DEFAULT 0,
  playlists_created integer NOT NULL DEFAULT 0,
  playlists_updated integer NOT NULL DEFAULT 0,
  status text NOT NULL, -- 'success', 'partial', 'failed'
  error_message text,
  synced_at timestamptz DEFAULT now()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_youtube_playlists_country_category ON youtube_playlists(country_code, category);
CREATE INDEX IF NOT EXISTS idx_youtube_sync_logs_synced_at ON youtube_sync_logs(synced_at DESC);

-- Add youtube_sync_enabled column to video_submissions (for future use)
ALTER TABLE video_submissions
ADD COLUMN IF NOT EXISTS youtube_sync_enabled boolean DEFAULT true;

COMMENT ON TABLE youtube_tokens IS 'Stores YouTube OAuth tokens for admin authentication';
COMMENT ON TABLE youtube_playlists IS 'Caches YouTube playlist IDs to avoid repeated API searches';
COMMENT ON TABLE youtube_sync_logs IS 'Tracks history of YouTube playlist sync operations';
