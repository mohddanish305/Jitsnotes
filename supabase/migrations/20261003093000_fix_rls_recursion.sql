-- Migration: Fix RLS recursion on admin_profiles, folders, documents
-- Eliminates self-referential subquery on admin_profiles and separates public SELECT from admin write

-- 1. Fix admin_profiles policies to eliminate self-recursion
DROP POLICY IF EXISTS "Only super admins can manage admin profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "Admins can read admin profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "Admins can read own profile" ON public.admin_profiles;
DROP POLICY IF EXISTS "Super admins can insert admin profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "Super admins can update admin profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "Super admins can delete admin profiles" ON public.admin_profiles;

CREATE POLICY "Admins can read own profile"
ON public.admin_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Super admins can insert admin profiles"
ON public.admin_profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update admin profiles"
ON public.admin_profiles
FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete admin profiles"
ON public.admin_profiles
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- 2. Fix folders policies: separate SELECT from INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Admins can manage folders" ON public.folders;
DROP POLICY IF EXISTS "Public can read active folders" ON public.folders;
DROP POLICY IF EXISTS "Admins can read all folders" ON public.folders;
DROP POLICY IF EXISTS "Admins can insert folders" ON public.folders;
DROP POLICY IF EXISTS "Admins can update folders" ON public.folders;
DROP POLICY IF EXISTS "Admins can delete folders" ON public.folders;

CREATE POLICY "Public can read active folders"
ON public.folders
FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can read all folders"
ON public.folders
FOR SELECT
TO authenticated
USING (public.is_cms_admin());

CREATE POLICY "Admins can insert folders"
ON public.folders
FOR INSERT
TO authenticated
WITH CHECK (public.is_cms_admin());

CREATE POLICY "Admins can update folders"
ON public.folders
FOR UPDATE
TO authenticated
USING (public.is_cms_admin())
WITH CHECK (public.is_cms_admin());

CREATE POLICY "Admins can delete folders"
ON public.folders
FOR DELETE
TO authenticated
USING (public.is_cms_admin());

-- 3. Fix documents policies: separate SELECT from INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "CMS admins can manage documents" ON public.documents;
DROP POLICY IF EXISTS "Public can read active document metadata" ON public.documents;
DROP POLICY IF EXISTS "Public can read active documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can read all documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;

CREATE POLICY "Public can read active documents"
ON public.documents
FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can read all documents"
ON public.documents
FOR SELECT
TO authenticated
USING (public.is_cms_admin());

CREATE POLICY "Admins can insert documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (public.is_cms_admin());

CREATE POLICY "Admins can update documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (public.is_cms_admin())
WITH CHECK (public.is_cms_admin());

CREATE POLICY "Admins can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (public.is_cms_admin());

-- 4. Clean up any redundant policies on subjects
DROP POLICY IF EXISTS "Admins can delete subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can insert subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.subjects;
DROP POLICY IF EXISTS "Allow public read" ON public.subjects;
DROP POLICY IF EXISTS "Public can read active subjects" ON public.subjects;
DROP POLICY IF EXISTS "public_read" ON public.subjects;

CREATE POLICY "Public can read active subjects"
ON public.subjects
FOR SELECT
TO public
USING (is_deleted = false);

CREATE POLICY "Admins can insert subjects"
ON public.subjects
FOR INSERT
TO authenticated
WITH CHECK (public.is_cms_admin());

CREATE POLICY "Admins can update subjects"
ON public.subjects
FOR UPDATE
TO authenticated
USING (public.is_cms_admin())
WITH CHECK (public.is_cms_admin());

CREATE POLICY "Admins can delete subjects"
ON public.subjects
FOR DELETE
TO authenticated
USING (public.is_cms_admin());
