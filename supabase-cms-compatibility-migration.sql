-- JITS Notes CMS compatibility migration for the live Android schema.
-- This migration intentionally preserves the existing units, document_categories,
-- and documents definitions, values, foreign keys, and storage_provider values.

CREATE TABLE IF NOT EXISTS public.admin_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at
  ON public.admin_activity (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_actor_id
  ON public.admin_activity (actor_id);

CREATE INDEX IF NOT EXISTS idx_admin_activity_resource
  ON public.admin_activity (resource_type, resource_id);

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_cms_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.units'::regclass
      AND tgname = 'set_units_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER set_units_updated_at
      BEFORE UPDATE ON public.units
      FOR EACH ROW
      EXECUTE FUNCTION public.set_cms_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.admin_activity TO authenticated;

DROP POLICY IF EXISTS "Admins can read admin activity" ON public.admin_activity;
CREATE POLICY "Admins can read admin activity"
  ON public.admin_activity
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.admin_profiles
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can write admin activity" ON public.admin_activity;
CREATE POLICY "Admins can write admin activity"
  ON public.admin_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.admin_profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Public clients may read academic metadata, but never the private B2 object key
-- or the creator identity. Storage authorization is handled server-side.
REVOKE SELECT ON public.documents FROM anon, authenticated;
GRANT SELECT (
  id,
  title,
  description,
  subject_id,
  unit_id,
  category_id,
  storage_provider,
  mime_type,
  file_size,
  page_count,
  is_active,
  created_at,
  updated_at
) ON public.documents TO anon, authenticated;

DROP POLICY IF EXISTS "Allow public read active documents" ON public.documents;
DROP POLICY IF EXISTS "Public can read active document metadata" ON public.documents;
CREATE POLICY "Public can read active document metadata"
  ON public.documents
  FOR SELECT
  TO public
  USING (is_active = true);