# JitsNotes - Supabase Backend Integration

## Quick Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Note your **Project URL** and **anon/public key**

2. **Run Database Schema**
   - Open Supabase SQL Editor
   - Copy and paste contents of `supabase-schema.sql`
   - Click **Run** to create tables and RLS policies

3. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Fill in your Supabase credentials:
     ```
     VITE_SUPABASE_URL=your_project_url
     VITE_SUPABASE_ANON_KEY=your_anon_key
     ```

4. **Create Admin User**
   - In Supabase Auth, create a user (email/password)
   - In `users` table, set `role = 'admin'` for that user
   - Or create a trigger to auto-add new users as 'user' role

5. **Add Sample Subjects** (via Admin Panel)
   - Start the app: `npm run dev`
   - Click **Admin** → Login with admin credentials
   - Add subjects with Google Drive ZIP links

## Architecture

```
Frontend (React + Framer Motion)
    ↓
Supabase Client (lib/supabase.js)
    ↓
Supabase Auth + Database
    ↓
RLS Policies enforce access control
```

## Features

* ✅ Public browse notes (no login required)
* ✅ Year filtering
* ✅ Admin panel (CRUD subjects)
* ✅ Feedback form (stored in DB)
* ✅ Row Level Security (RLS)
* ✅ No custom backend needed

## API Layer

* `subjectsApi.getAll(year)` - fetch subjects by year
* `subjectsApi.create()` - admin only
* `subjectsApi.update()` - admin only
* `subjectsApi.delete()` - admin only (soft delete)
* `feedbackApi.submit()` - public
* `authApi.signIn()` / `signOut()` - admin

## Security

* RLS enabled on all tables
* `is_admin()` function checks admin role
* Public can only read active subjects
* Admin can manage subjects

## Development

```bash
npm install
npm run dev
```

## Production

Build with `npm run build` and deploy static files to any hosting (Vercel, Netlify, GitHub Pages).

Environment variables must be set in hosting platform.
