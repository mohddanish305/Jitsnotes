-- Migration: Create academic_year_assets table and academic-assets storage bucket
-- Configures central, academic year illustrations (Year 1: Blue, Year 2: Teal, Year 3: Orange, Year 4: Purple)

-- 1. Ensure public bucket 'academic-assets' exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('academic-assets', 'academic-assets', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage object policies for academic-assets
DROP POLICY IF EXISTS "Public can view academic assets" ON storage.objects;
CREATE POLICY "Public can view academic assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'academic-assets');

DROP POLICY IF EXISTS "Admins can manage academic assets" ON storage.objects;
CREATE POLICY "Admins can manage academic assets"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'academic-assets' AND public.is_cms_admin())
WITH CHECK (bucket_id = 'academic-assets' AND public.is_cms_admin());

-- 2. Create academic_year_assets table
CREATE TABLE IF NOT EXISTS public.academic_year_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id INTEGER NOT NULL UNIQUE REFERENCES public.years(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.academic_year_assets ENABLE ROW LEVEL SECURITY;

-- Policies for academic_year_assets
DROP POLICY IF EXISTS "Public can read academic year assets" ON public.academic_year_assets;
CREATE POLICY "Public can read academic year assets"
ON public.academic_year_assets FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Admins can insert academic year assets" ON public.academic_year_assets;
CREATE POLICY "Admins can insert academic year assets"
ON public.academic_year_assets FOR INSERT
TO authenticated
WITH CHECK (public.is_cms_admin());

DROP POLICY IF EXISTS "Admins can update academic year assets" ON public.academic_year_assets;
CREATE POLICY "Admins can update academic year assets"
ON public.academic_year_assets FOR UPDATE
TO authenticated
USING (public.is_cms_admin())
WITH CHECK (public.is_cms_admin());

DROP POLICY IF EXISTS "Admins can delete academic year assets" ON public.academic_year_assets;
CREATE POLICY "Admins can delete academic year assets"
ON public.academic_year_assets FOR DELETE
TO authenticated
USING (public.is_cms_admin());

-- 3. Seed Year 1, 2, 3, 4
INSERT INTO public.academic_year_assets (year_id, image_url, storage_path)
VALUES
  (1, 'https://bzoqsgkrbwnqnvsorxjb.supabase.co/storage/v1/object/public/academic-assets/years/year-1-blue.png', 'years/year-1-blue.png'),
  (2, 'https://bzoqsgkrbwnqnvsorxjb.supabase.co/storage/v1/object/public/academic-assets/years/year-2-teal.png', 'years/year-2-teal.png'),
  (3, 'https://bzoqsgkrbwnqnvsorxjb.supabase.co/storage/v1/object/public/academic-assets/years/year-3-orange.png', 'years/year-3-orange.png'),
  (4, 'https://bzoqsgkrbwnqnvsorxjb.supabase.co/storage/v1/object/public/academic-assets/years/year-4-purple.png', 'years/year-4-purple.png')
ON CONFLICT (year_id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  storage_path = EXCLUDED.storage_path,
  updated_at = now();
