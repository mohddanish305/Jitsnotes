-- Thumbnail upload migration for JitsNotes
-- Safe to re-run: all statements are idempotent.

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'subject-thumbnails',
  'subject-thumbnails',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can read subject thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload subject thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete subject thumbnails" ON storage.objects;

CREATE POLICY "Public can read subject thumbnails"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'subject-thumbnails');

CREATE POLICY "Admins can upload subject thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'subject-thumbnails'
    AND auth.role() = 'authenticated'
    AND public.is_admin()
  );

CREATE POLICY "Admins can delete subject thumbnails"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'subject-thumbnails'
    AND auth.role() = 'authenticated'
    AND public.is_admin()
  );
