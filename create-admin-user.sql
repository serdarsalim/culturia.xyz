-- CULTURIA: Create Admin User
-- Run this in your Supabase SQL Editor

-- Step 1: First, check if your user exists in auth.users
SELECT id, email FROM auth.users WHERE email = 'slmxyz@gmail.com';

-- Step 2: If the user exists above, insert them into admin_users
-- Replace 'YOUR_USER_ID_HERE' with the id from Step 1
-- OR if the query above returns a result, you can use this dynamic version:

INSERT INTO admin_users (id, email, role)
SELECT id, email, 'super_admin'
FROM auth.users
WHERE email = 'slmxyz@gmail.com'
ON CONFLICT (id) DO NOTHING;

-- Step 3: Verify the admin was created
SELECT * FROM admin_users WHERE email = 'slmxyz@gmail.com';

-- If you don't have a user in auth.users yet:
-- Go to Supabase Dashboard > Authentication > Users > Add User
-- Email: slmxyz@gmail.com
-- Password: [choose a password]
-- Auto Confirm User: YES
-- Then run this script again
