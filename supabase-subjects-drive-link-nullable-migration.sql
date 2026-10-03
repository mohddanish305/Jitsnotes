-- Migration: Make subjects.drive_link nullable for B2 document CMS architecture
-- Preserves all existing rows, constraints, and drive_link values

ALTER TABLE public.subjects
  ALTER COLUMN drive_link DROP NOT NULL;

-- Ensure CMS admins and Super Admins can insert, update, and delete subjects
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can insert subjects" ON public.subjects;
  CREATE POLICY "Admins can insert subjects"
    ON public.subjects
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin() OR public.is_cms_admin());

  DROP POLICY IF EXISTS "Admins can update subjects" ON public.subjects;
  CREATE POLICY "Admins can update subjects"
    ON public.subjects
    FOR UPDATE
    TO authenticated
    USING (public.is_admin() OR public.is_cms_admin())
    WITH CHECK (public.is_admin() OR public.is_cms_admin());

  DROP POLICY IF EXISTS "Admins can delete subjects" ON public.subjects;
  CREATE POLICY "Admins can delete subjects"
    ON public.subjects
    FOR DELETE
    TO authenticated
    USING (public.is_admin() OR public.is_cms_admin());
END $$;
