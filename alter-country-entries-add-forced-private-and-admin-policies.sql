-- Add per-post moderation privacy flag and allow admins to moderate any post

ALTER TABLE country_entries
  ADD COLUMN IF NOT EXISTS forced_private BOOLEAN NOT NULL DEFAULT FALSE;

DROP POLICY IF EXISTS "Admins can update any country entry" ON country_entries;
CREATE POLICY "Admins can update any country entry"
ON country_entries FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

DROP POLICY IF EXISTS "Admins can delete any country entry" ON country_entries;
CREATE POLICY "Admins can delete any country entry"
ON country_entries FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));
