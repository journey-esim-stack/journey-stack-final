-- Restore agent read access to esim_plans table
-- Agents can read the table but we'll ensure frontend doesn't expose wholesale_price and supplier_name
CREATE POLICY "Approved agents can view active eSIM plans" ON public.esim_plans
FOR SELECT
USING (
  is_active = true 
  AND admin_only = false
  AND EXISTS (
    SELECT 1 FROM agent_profiles 
    WHERE user_id = auth.uid() 
    AND status = 'approved'::agent_status
  )
);