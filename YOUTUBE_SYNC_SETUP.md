# YouTube Sync Feature - Setup Instructions

## ✅ Completed

The YouTube sync feature has been fully implemented! Here's what was built:

### 1. Database Tables
- `youtube_tokens` - Stores OAuth tokens
- `youtube_playlists` - Caches playlist IDs (saves API quota)
- `youtube_sync_logs` - Tracks sync history
- Added `youtube_sync_enabled` column to `video_submissions` (for future use)

### 2. API Routes
- `/api/auth/youtube` - Initiate OAuth
- `/api/auth/youtube/callback` - Handle OAuth callback
- `/api/auth/youtube/status` - Check connection status
- `/api/auth/youtube/disconnect` - Disconnect YouTube
- `/api/admin/youtube/sync` - Main sync endpoint

### 3. Admin UI
- New `/admin/youtube` page with full sync interface
- Connection status display
- Sync All button
- Collapsible country list with category breakdown
- Individual sync buttons per country/category

### 4. Features
- Playlist naming: `"Palestine Music 🇵🇸 | Culturia"`
- Playlist description: Links to culturia.xyz
- Smart caching to save API quota
- Auto-refresh expired tokens
- Success/error messages with stats

---

## 🔧 What You Need to Do

### Step 1: Run Database Migration

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `culturia`
3. Go to **SQL Editor**
4. Open the migration file: `supabase_youtube_migration.sql`
5. Copy all the SQL and paste into the SQL Editor
6. Click **Run** to create the tables

### Step 2: Test Locally

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Go to: http://localhost:3000/admin
3. Log in as admin
4. Click "YouTube Sync" in the sidebar
5. Click "Connect YouTube Account"
6. Log in with **slmxyz@gmail.com** (your YouTube account)
7. Grant permissions
8. You should be redirected back and see "Connected ✓"
9. Try clicking "Sync All" to test!

### Step 3: Deploy to Production

1. The environment variables are already in Vercel ✅
2. Commit and push the code (see git commands below)
3. Vercel will auto-deploy
4. After deploy, go to: https://culturia.xyz/admin/youtube
5. Connect YouTube again (production needs separate auth)
6. Start syncing!

---

## 📝 Git Commands

```bash
# Stage all changes
git add .

# Commit
git commit -m "Add YouTube playlist sync feature

- Install googleapis package
- Create database tables for OAuth tokens, playlist cache, and sync logs
- Implement YouTube OAuth flow (connect, callback, status, disconnect)
- Create sync service with playlist management
- Build admin UI with country/category sync controls
- Add YouTube nav item to admin panel
- Cache playlist IDs to save API quota
- Auto-refresh expired tokens
- Playlist naming: 'CountryName Category Flag | Culturia'

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to main
git push origin main
```

---

## 🎯 How to Use

### First Time Setup
1. Connect your YouTube account (slmxyz@gmail.com)
2. Click "Sync All" to create all playlists

### Regular Usage
- **Sync All**: Updates all playlists with new videos
- **Sync Country**: Syncs all categories for one country
- **Sync Category**: Syncs one specific playlist

### What Happens During Sync
1. Fetches all approved videos from Supabase
2. Groups by country + category
3. For each group:
   - Checks if playlist exists (uses cache)
   - Creates playlist if needed
   - Adds only new videos (skips duplicates)
4. Shows success message with stats

---

## 📊 API Quota Info

Current usage with 50 videos:
- ~4,000 units (well under 10,000 daily limit) ✅

When you scale to 1000+ videos:
- You might hit quota limits
- Solution: Remove "Sync All" button
- Use country/category syncs instead

---

## 🔍 Troubleshooting

### "YouTube not connected"
- Click "Connect YouTube Account"
- Make sure you're logging in with slmxyz@gmail.com

### "Failed to sync"
- Check browser console for errors
- Verify database migration ran successfully
- Check that environment variables are set in Vercel

### Playlists not appearing on YouTube
- Wait a few seconds and refresh YouTube
- Check YouTube Studio → Content → Playlists

### Token expired
- The system auto-refreshes tokens
- If it fails, disconnect and reconnect

---

## 🎉 You're Done!

The YouTube sync feature is fully implemented and ready to use. Just:
1. Run the database migration
2. Test locally
3. Commit and push
4. Connect YouTube in production
5. Start syncing!

Enjoy! 🚀
