-- CRITICAL FIX: Restore agent access to esim_plans but with column restrictions
-- Views with security_invoker=on inherit RLS from the base table

-- Drop the restrictive policy that blocks all agent access
DROP POLICY IF EXISTS "Only admins can view esim_plans with wholesale data" ON public.esim_plans;

-- Recreate agent access policy
CREATE POLICY "Approved agents can view esim_plans"
ON public.esim_plans
FOR SELECT
TO authenticated
USING (
  is_active = true 
  AND admin_only = false 
  AND EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE user_id = auth.uid() 
    AND status = 'approved'::agent_status
  )
);

-- Create admin-only policy for full access
CREATE POLICY "Admins can view all esim_plans"
ON public.esim_plans
FOR SELECT
TO authenticated
USING (
  (SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  ))
);

-- Similar fix for orders table
DROP POLICY IF EXISTS "Only admins can view orders table with wholesale data" ON public.orders;

CREATE POLICY "Approved agents can view their orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT id FROM public.agent_profiles
    WHERE user_id = auth.uid() 
    AND status = 'approved'::agent_status
  )
);

CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  (SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  ))
);

-- Document the security model
COMMENT ON VIEW public.agent_safe_plans IS 'SECURITY: Use this view for agent queries. It excludes wholesale_price, supplier_name, supplier_plan_id. Admins should query esim_plans directly.';
COMMENT ON VIEW public.agent_safe_orders IS 'SECURITY: Use this view for agent queries. It excludes wholesale_price, supplier_order_id. Admins should query orders directly.';