-- JitsNotes Supabase SQL Setup (Run in Supabase SQL Editor)

-- ENABLE EXTENSION
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- YEARS
CREATE TABLE IF NOT EXISTS years (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SUBJECTS
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  year_id INTEGER REFERENCES years(id) ON DELETE CASCADE,
  drive_link TEXT NOT NULL,
  thumbnail_url TEXT,
  pdf_path TEXT,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ADMIN PROFILES
CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

UPDATE subjects
SET is_deleted = false
WHERE is_deleted IS NULL;

-- Keep public.users in sync with auth.users without exposing client writes
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

-- UNIQUE CONSTRAINT (NO DUPLICATE SUBJECT IN SAME YEAR)
ALTER TABLE subjects
ADD CONSTRAINT IF NOT EXISTS unique_subject_per_year UNIQUE (name, year_id);

-- INDEX (PERFORMANCE)
CREATE INDEX IF NOT EXISTS idx_subject_year ON subjects(year_id);

-- RLS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Public can read subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can insert subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can update subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can delete subjects" ON subjects;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Users can read own profile'
  ) THEN
    CREATE POLICY "Users can read own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Users can insert own profile'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (can_update_own_profile(id, role));
  END IF;
END $$;

-- Public read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subjects'
      AND policyname = 'Public can read subjects'
  ) THEN
    CREATE POLICY "Public can read subjects"
    ON subjects
    FOR SELECT
    USING (is_deleted = false);
  END IF;
END $$;

-- Admin delete
DO $$
BEGIN
  CREATE POLICY "Admins can insert subjects"
  ON subjects
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

  CREATE POLICY "Admins can update subjects"
  ON subjects
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

  CREATE POLICY "Admins can delete subjects"
  ON subjects
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
END $$;

