-- Migration: Folders architecture for JITS Notes
-- Replaces Unit concept with optional Folders while preserving complete backward compatibility with units

-- 1. Create folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT folders_subject_name_unique UNIQUE (subject_id, name)
);

CREATE INDEX IF NOT EXISTS idx_folders_subject ON public.folders(subject_id);
CREATE INDEX IF NOT EXISTS idx_folders_active ON public.folders(is_active);

-- 2. Migrate existing units to folders
INSERT INTO public.folders (id, subject_id, name, is_active, created_at, updated_at)
SELECT id, subject_id, title, is_active, created_at, updated_at
FROM public.units
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      updated_at = EXCLUDED.updated_at;

-- 3. Sync trigger from folders to units for backward compatibility with legacy apps
CREATE OR REPLACE FUNCTION public.sync_folder_to_units()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    SELECT COALESCE(MAX(unit_number), 0) + 1 INTO next_num
    FROM public.units WHERE subject_id = NEW.subject_id;
    
    INSERT INTO public.units (id, subject_id, unit_number, title, is_active, created_at, updated_at)
    VALUES (NEW.id, NEW.subject_id, next_num, NEW.name, NEW.is_active, NEW.created_at, NEW.updated_at)
    ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE public.units
    SET title = NEW.name,
        is_active = NEW.is_active,
        updated_at = NEW.updated_at
    WHERE id = NEW.id;
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM public.units WHERE id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_folder_to_units ON public.folders;
CREATE TRIGGER trg_sync_folder_to_units
AFTER INSERT OR UPDATE OR DELETE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.sync_folder_to_units();

-- 4. Update documents table to add folder_id and make unit_id nullable
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents(folder_id);

-- Backfill existing documents
UPDATE public.documents
SET folder_id = unit_id
WHERE folder_id IS NULL AND unit_id IS NOT NULL;

-- Make unit_id nullable for documents uploaded without a folder
ALTER TABLE public.documents ALTER COLUMN unit_id DROP NOT NULL;

-- 5. Sync trigger on documents to maintain folder_id <-> unit_id
CREATE OR REPLACE FUNCTION public.sync_document_folder_unit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.folder_id IS NOT NULL AND NEW.unit_id IS NULL THEN
    NEW.unit_id = NEW.folder_id;
  ELSIF NEW.folder_id IS NULL AND NEW.unit_id IS NOT NULL THEN
    NEW.folder_id = NEW.unit_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_document_folder_unit ON public.documents;
CREATE TRIGGER trg_sync_document_folder_unit
BEFORE INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.sync_document_folder_unit();

-- 6. Row Level Security for folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active folders" ON public.folders;
CREATE POLICY "Public can read active folders"
  ON public.folders
  FOR SELECT
  TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage folders" ON public.folders;
CREATE POLICY "Admins can manage folders"
  ON public.folders
  FOR ALL
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.admin_profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.admin_profiles
      WHERE id = auth.uid()
    )
  );

GRANT SELECT ON public.folders TO anon, authenticated;
GRANT ALL ON public.folders TO authenticated;

-- 7. Grant select on folder_id to public clients
GRANT SELECT (
  id,
  title,
  description,
  subject_id,
  unit_id,
  folder_id,
  category_id,
  storage_provider,
  mime_type,
  file_size,
  page_count,
  is_active,
  created_at,
  updated_at
) ON public.documents TO anon, authenticated;
