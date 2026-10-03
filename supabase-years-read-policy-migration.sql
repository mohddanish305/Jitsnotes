-- Academic years are public catalog metadata. Keep writes restricted by the
-- existing RLS state; add only the missing read policy.

ALTER TABLE public.years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read years" ON public.years;
CREATE POLICY "Public can read years"
  ON public.years
  FOR SELECT
  TO public
  USING (true);