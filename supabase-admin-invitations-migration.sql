-- JITS Notes additive Teacher Admin invitation support.
-- Uses Supabase Auth's managed, expiring, single-use invite link.
-- No raw invitation token is stored in this table.

ALTER TABLE public.admin_profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  teacher_name TEXT,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_invitations_pending_email_key
  ON public.admin_invitations (lower(email))
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_admin_invitations_status
  ON public.admin_invitations (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_auth_user
  ON public.admin_invitations (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_invited_by
  ON public.admin_invitations (invited_by);

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profiles
    WHERE id = auth.uid()
      AND is_super_admin = true
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_cms_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.admin_profiles p ON p.id = u.id
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND p.is_active = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.is_cms_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cms_admin() TO authenticated;

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.admin_invitations TO authenticated;

DROP POLICY IF EXISTS "Super admins can read invitations" ON public.admin_invitations;
CREATE POLICY "Super admins can read invitations"
  ON public.admin_invitations
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can create invitations" ON public.admin_invitations;
CREATE POLICY "Super admins can create invitations"
  ON public.admin_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() AND invited_by = auth.uid());

DROP POLICY IF EXISTS "Super admins can update invitations" ON public.admin_invitations;
CREATE POLICY "Super admins can update invitations"
  ON public.admin_invitations
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "CMS admins can manage units" ON public.units;
CREATE POLICY "CMS admins can manage units" ON public.units
  FOR ALL TO authenticated USING (public.is_cms_admin()) WITH CHECK (public.is_cms_admin());
DROP POLICY IF EXISTS "Admins can manage units" ON public.units;

DROP POLICY IF EXISTS "CMS admins can manage categories" ON public.document_categories;
CREATE POLICY "CMS admins can manage categories" ON public.document_categories
  FOR ALL TO authenticated USING (public.is_cms_admin()) WITH CHECK (public.is_cms_admin());
DROP POLICY IF EXISTS "Admins can manage document categories" ON public.document_categories;

DROP POLICY IF EXISTS "CMS admins can manage documents" ON public.documents;
CREATE POLICY "CMS admins can manage documents" ON public.documents
  FOR ALL TO authenticated USING (public.is_cms_admin()) WITH CHECK (public.is_cms_admin());
DROP POLICY IF EXISTS "Admins can manage documents" ON public.documents;

DROP POLICY IF EXISTS "CMS admins can read admin activity" ON public.admin_activity;
CREATE POLICY "CMS admins can read admin activity" ON public.admin_activity
  FOR SELECT TO authenticated USING (public.is_cms_admin());
DROP POLICY IF EXISTS "Admins can read admin activity" ON public.admin_activity;

DROP POLICY IF EXISTS "CMS admins can write admin activity" ON public.admin_activity;
CREATE POLICY "CMS admins can write admin activity" ON public.admin_activity
  FOR INSERT TO authenticated
  WITH CHECK (public.is_cms_admin() AND actor_id = auth.uid());
DROP POLICY IF EXISTS "Admins can write admin activity" ON public.admin_activity;

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
