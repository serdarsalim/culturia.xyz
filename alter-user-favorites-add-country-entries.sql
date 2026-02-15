-- Extend existing user_favorites to support favoriting country entries
-- while keeping existing video favorites mechanism.

ALTER TABLE user_favorites
  ADD COLUMN IF NOT EXISTS country_entry_id UUID REFERENCES country_entries(id) ON DELETE CASCADE;

ALTER TABLE user_favorites
  ALTER COLUMN submission_id DROP NOT NULL;

-- Ensure each row points to exactly one target type.
ALTER TABLE user_favorites
  DROP CONSTRAINT IF EXISTS user_favorites_target_check;

ALTER TABLE user_favorites
  ADD CONSTRAINT user_favorites_target_check
  CHECK (
    (submission_id IS NOT NULL AND country_entry_id IS NULL)
    OR
    (submission_id IS NULL AND country_entry_id IS NOT NULL)
  );

-- Keep/ensure uniqueness per favorite target.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_user_submission_unique
  ON user_favorites(user_id, submission_id)
  WHERE submission_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_user_country_entry_unique
  ON user_favorites(user_id, country_entry_id)
  WHERE country_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_favorites_country_entry
  ON user_favorites(country_entry_id)
  WHERE country_entry_id IS NOT NULL;
