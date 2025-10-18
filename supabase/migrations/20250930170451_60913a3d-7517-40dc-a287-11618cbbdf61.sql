-- Fix pricing_rules SELECT access without restrictive conflicts
DROP POLICY IF EXISTS "Admins can manage pricing rules" ON public.pricing_rules;
DROP POLICY IF EXISTS "Approved agents can view pricing rules" ON public.pricing_rules;

CREATE POLICY "Admins or approved agents can view pricing rules"
ON public.pricing_rules
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.agent_profiles ap
    WHERE ap.user_id = auth.uid() AND ap.status = 'approved'::agent_status
  )
);