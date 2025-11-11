-- Migration: Rename categories to match new schema
-- 1. 'cooking' -> 'daily_life'
-- 2. 'street_voices' -> 'talks'
-- This updates all existing category entries in video_submissions table

BEGIN;

-- FIRST: Drop existing check constraint (must happen before updating data)
ALTER TABLE video_submissions
DROP CONSTRAINT IF EXISTS video_submissions_category_check;

-- SECOND: Update all cooking category entries to daily_life
UPDATE video_submissions
SET category = 'daily_life'
WHERE category = 'cooking';

-- THIRD: Update all street_voices category entries to talks
UPDATE video_submissions
SET category = 'talks'
WHERE category = 'street_voices';

-- FOURTH: Add new check constraint with updated category values
ALTER TABLE video_submissions
ADD CONSTRAINT video_submissions_category_check
CHECK (category IN ('inspiration', 'music', 'comedy', 'daily_life', 'talks'));

COMMIT;

-- Verification query (run this separately to check the migration)
-- SELECT category, COUNT(*) FROM video_submissions GROUP BY category;
