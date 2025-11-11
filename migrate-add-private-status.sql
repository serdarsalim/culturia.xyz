BEGIN;

-- FIRST: Drop existing check constraint
ALTER TABLE video_submissions
DROP CONSTRAINT IF EXISTS video_submissions_status_check;

-- SECOND: Add new check constraint with 'private' status
ALTER TABLE video_submissions
ADD CONSTRAINT video_submissions_status_check
CHECK (status IN ('private', 'pending', 'approved', 'rejected'));

-- THIRD: Update any existing pending submissions to private (optional, depends on what you want)
-- Comment this out if you want to keep existing pending videos as pending
-- UPDATE video_submissions
-- SET status = 'private'
-- WHERE status = 'pending';

COMMIT;
