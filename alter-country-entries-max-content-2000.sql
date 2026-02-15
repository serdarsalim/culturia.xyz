-- Increase country_entries content limit from 1000 to 2000 chars

ALTER TABLE country_entries
  DROP CONSTRAINT IF EXISTS country_entries_content_check;

ALTER TABLE country_entries
  ADD CONSTRAINT country_entries_content_check
  CHECK (char_length(content) <= 2000);
