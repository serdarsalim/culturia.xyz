-- This migration enables automatic account linking for users
-- It allows the same email to be used with multiple providers (email/password + Google OAuth)

-- Check current identities for debugging
-- Run this first to see if you have duplicate accounts:
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Note: Supabase handles account linking automatically in most cases.
-- If you're having issues, the problem is usually one of these:

-- 1. Email confirmation is required but not completed
--    Solution: Disable email confirmation in Dashboard → Authentication → Providers → Email

-- 2. The Google account email doesn't match exactly
--    Solution: Make sure you're using the exact same email address

-- 3. Multiple user records exist
--    This SQL helps identify and clean up duplicates:

-- Find users with the same email
SELECT
  u.id,
  u.email,
  u.created_at,
  u.confirmed_at,
  array_agg(i.provider) as providers
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id
GROUP BY u.id, u.email, u.created_at, u.confirmed_at
HAVING COUNT(*) > 0
ORDER BY u.email, u.created_at;

-- If you need to manually link accounts (advanced, be careful!):
-- This should only be done if you have duplicate user records for the same email
-- and want to merge them. Replace the UUIDs with your actual user IDs.

-- Example (DO NOT RUN without replacing UUIDs):
-- UPDATE auth.identities
-- SET user_id = 'keep-this-user-id'
-- WHERE user_id = 'delete-this-user-id';
--
-- DELETE FROM auth.users
-- WHERE id = 'delete-this-user-id';
