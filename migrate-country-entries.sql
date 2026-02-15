-- Country entries pivot (text-based impressions)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS country_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code VARCHAR(3) NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  pros TEXT[] NOT NULL DEFAULT '{}'::TEXT[] CHECK (array_length(pros, 1) IS NULL OR array_length(pros, 1) <= 5),
  cons TEXT[] NOT NULL DEFAULT '{}'::TEXT[] CHECK (array_length(cons, 1) IS NULL OR array_length(cons, 1) <= 5),
  been_there BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, country_code)
);

CREATE INDEX IF NOT EXISTS idx_country_entries_country ON country_entries(country_code);
CREATE INDEX IF NOT EXISTS idx_country_entries_user ON country_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_country_entries_updated ON country_entries(updated_at DESC);

-- Reuse existing function from schema if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'update_country_entries_updated_at'
    ) THEN
      CREATE TRIGGER update_country_entries_updated_at
        BEFORE UPDATE ON country_entries
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END
$$;

ALTER TABLE country_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view country entries" ON country_entries;
CREATE POLICY "Public can view country entries"
ON country_entries FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert country entries" ON country_entries;
CREATE POLICY "Authenticated users can insert country entries"
ON country_entries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own country entries" ON country_entries;
CREATE POLICY "Users can update own country entries"
ON country_entries FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own country entries" ON country_entries;
CREATE POLICY "Users can delete own country entries"
ON country_entries FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
