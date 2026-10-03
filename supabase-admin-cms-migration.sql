-- JITS Notes incremental CMS schema.
-- Run after the existing Supabase schema. This does not alter or remove legacy tables.

CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  unit_number INTEGER NOT NULL CHECK (unit_number > 0),
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_units_subject ON public.units(subject_id);
CREATE INDEX IF NOT EXISTS idx_units_active ON public.units(is_active);

CREATE TABLE IF NOT EXISTS public.document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.document_categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  storage_provider TEXT NOT NULL DEFAULT 'backblaze_b2'
    CHECK (storage_provider IN ('backblaze_b2', 'legacy_google_drive')),
  storage_object_key TEXT,
  file_name TEXT,
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  page_count INTEGER CHECK (page_count IS NULL OR page_count > 0),
  mime_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_pdf_mime_type CHECK (mime_type IS NULL OR mime_type = 'application/pdf'),
  CONSTRAINT documents_b2_key_required CHECK (
    storage_provider <> 'backblaze_b2' OR NULLIF(storage_object_key, '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_documents_subject ON public.documents(subject_id);
CREATE INDEX IF NOT EXISTS idx_documents_unit ON public.documents(unit_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_active ON public.documents(is_active);

CREATE TABLE IF NOT EXISTS public.admin_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON public.admin_activity(created_at DESC);

CREATE OR REPLACE FUNCTION public.is_cms_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE id = auth.uid()
  );
$$;

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active units" ON public.units;
CREATE POLICY "Public can read active units" ON public.units
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage units" ON public.units;
CREATE POLICY "Admins can manage units" ON public.units
  FOR ALL USING (is_cms_admin()) WITH CHECK (is_cms_admin());

DROP POLICY IF EXISTS "Public can read active categories" ON public.document_categories;
CREATE POLICY "Public can read active categories" ON public.document_categories
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage categories" ON public.document_categories;
CREATE POLICY "Admins can manage categories" ON public.document_categories
  FOR ALL USING (is_cms_admin()) WITH CHECK (is_cms_admin());

DROP POLICY IF EXISTS "Admins can manage documents" ON public.documents;
CREATE POLICY "Admins can manage documents" ON public.documents
  FOR ALL USING (is_cms_admin()) WITH CHECK (is_cms_admin());

DROP POLICY IF EXISTS "Admins can read activity" ON public.admin_activity;
CREATE POLICY "Admins can read activity" ON public.admin_activity
  FOR SELECT USING (is_cms_admin());

DROP POLICY IF EXISTS "Admins can write activity" ON public.admin_activity;
CREATE POLICY "Admins can write activity" ON public.admin_activity
  FOR INSERT WITH CHECK (is_cms_admin() AND actor_id = auth.uid());