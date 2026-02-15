-- Add lived_there toggle field to country entries

ALTER TABLE country_entries
  ADD COLUMN IF NOT EXISTS lived_there BOOLEAN NOT NULL DEFAULT FALSE;
