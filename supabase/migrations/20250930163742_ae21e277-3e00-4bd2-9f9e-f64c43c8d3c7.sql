-- Allow admins to manage (view/update/delete) pricing rules
CREATE POLICY "Admins can manage pricing rules"
ON public.pricing_rules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));