-- ============================================
-- JitsNotes Database Schema for Supabase
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE (linked to Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TIMESTAMP DEFAULT now()
);

-- Index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- 2. SUBJECTS TABLE (CORE)
-- ============================================
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 4),
  drive_link TEXT NOT NULL,
  thumbnail_url TEXT,
  pdf_path TEXT,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT unique_subject UNIQUE (short_name, year)
);

-- Performance index for year filtering
CREATE INDEX IF NOT EXISTS idx_subject_year ON subjects(year);
CREATE INDEX IF NOT EXISTS idx_subject_active ON subjects(is_active);
CREATE INDEX IF NOT EXISTS idx_subject_deleted ON subjects(is_deleted);

-- ============================================
-- 3. FEEDBACK TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Index for admin viewing recent feedback
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper to keep client-side updates from changing the stored role
CREATE OR REPLACE FUNCTION can_update_own_profile(target_id uuid, proposed_role text)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = target_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = target_id
        AND u.role = proposed_role
    );
$$;

-- Auto-provision profile rows from auth.users without exposing writes to the client
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    CASE
      WHEN LOWER(NEW.email) = 'muhammeddanish305@gmail.com' THEN 'admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = CASE
          WHEN LOWER(EXCLUDED.email) = 'muhammeddanish305@gmail.com' THEN 'admin'
          ELSE public.users.role
        END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

INSERT INTO public.users (id, email, role)
SELECT
  id,
  LOWER(email),
  CASE
    WHEN LOWER(email) = 'muhammeddanish305@gmail.com' THEN 'admin'
    ELSE 'user'
  END
FROM auth.users
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = CASE
        WHEN LOWER(EXCLUDED.email) = 'muhammeddanish305@gmail.com' THEN 'admin'
        ELSE public.users.role
      END;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- ============ USERS POLICIES ============

DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Users can read their own profile only
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can create their own profile row during first login
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND (
      role = 'user'
      OR (
        role = 'admin'
        AND LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'muhammeddanish305@gmail.com'
      )
    )
  );

-- Users can update their own profile row, but the role must remain unchanged
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (can_update_own_profile(id, role));

-- ============ SUBJECTS POLICIES ============

DROP POLICY IF EXISTS "Public read active subjects" ON subjects;
DROP POLICY IF EXISTS "Public can read subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can insert subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can update subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can delete subjects" ON subjects;

-- Public: Anyone can read subjects that are not deleted
CREATE POLICY "Public can read subjects"
  ON subjects FOR SELECT
  USING (is_deleted = false);

-- Admin: Full CRUD on subjects
CREATE POLICY "Admins can insert subjects"
  ON subjects FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update subjects"
  ON subjects FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete subjects"
  ON subjects FOR DELETE
  USING (is_admin());

-- ============ FEEDBACK POLICIES ============

-- Public: Anyone can submit feedback
CREATE POLICY "Public can insert feedback"
  ON feedback FOR INSERT
  WITH CHECK (true);

-- Admin: Admins can read all feedback
CREATE POLICY "Admins can read feedback"
  ON feedback FOR SELECT
  USING (is_admin());

