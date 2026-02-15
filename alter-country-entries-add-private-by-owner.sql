-- Add per-post owner-controlled privacy

ALTER TABLE country_entries
  ADD COLUMN IF NOT EXISTS private_by_owner BOOLEAN NOT NULL DEFAULT FALSE;
