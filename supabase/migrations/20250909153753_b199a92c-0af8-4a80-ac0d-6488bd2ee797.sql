-- Prevent agents from editing markup fields; only admins can change them
-- Helper function to compare markups against stored values
CREATE OR REPLACE FUNCTION public.profile_markups_equal(_id uuid, _markup_type text, _markup_value numeric)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_profiles p
    WHERE p.id = _id
      AND p.markup_type IS NOT DISTINCT FROM _markup_type
      AND p.markup_value IS NOT DISTINCT FROM _markup_value
  );
$$;

-- Replace existing agent update policy with one that forbids markup changes
DO $$ BEGIN
  DROP POLICY IF EXISTS "Agents can update their own profile" ON public.agent_profiles;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Agents can update their own non-markup fields"
ON public.agent_profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.profile_markups_equal(id, markup_type, markup_value)
)
WITH CHECK (
  auth.uid() = user_id
  AND public.profile_markups_equal(id, markup_type, markup_value)
);