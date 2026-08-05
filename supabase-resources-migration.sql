-- ============================================
-- JitsNotes Resources Schema and RLS Policies
-- ============================================

-- Create resources table
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  resource_type TEXT,
  academic_year TEXT,
  drive_link TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);

-- Indexing for performance optimization
CREATE INDEX IF NOT EXISTS idx_resources_deleted ON public.resources(is_deleted);

-- Enable Row Level Security (RLS)
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Access: Anyone can read resources that are not deleted
DROP POLICY IF EXISTS "Public can read resources" ON public.resources;
CREATE POLICY "Public can read resources"
  ON public.resources FOR SELECT
  USING (is_deleted = false);

-- 2. Admin Insert: Only authenticated admins can insert resources
DROP POLICY IF EXISTS "Admins can insert resources" ON public.resources;
CREATE POLICY "Admins can insert resources"
  ON public.resources FOR INSERT
  WITH CHECK (is_admin());

-- 3. Admin Update: Only authenticated admins can update resources
DROP POLICY IF EXISTS "Admins can update resources" ON public.resources;
CREATE POLICY "Admins can update resources"
  ON public.resources FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- 4. Admin Delete: Only authenticated admins can delete resources
DROP POLICY IF EXISTS "Admins can delete resources" ON public.resources;
CREATE POLICY "Admins can delete resources"
  ON public.resources FOR DELETE
  USING (is_admin());
