-- ============================================
-- JitsNotes Feedback Schema and RLS Policies
-- ============================================

-- 1. Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Performance index for admin viewing recent feedback
CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 4. Public Insert Policy: Anyone can submit feedback
DROP POLICY IF EXISTS "Public can insert feedback" ON public.feedback;
CREATE POLICY "Public can insert feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (true);

-- 5. Admin Read Policy: Only admins can view feedback
DROP POLICY IF EXISTS "Admins can read feedback" ON public.feedback;
CREATE POLICY "Admins can read feedback"
  ON public.feedback FOR SELECT
  USING (is_admin());
