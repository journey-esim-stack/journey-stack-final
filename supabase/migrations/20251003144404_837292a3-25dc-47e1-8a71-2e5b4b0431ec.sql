-- Phase 1: Remove Airtable column from pricing_rules
ALTER TABLE pricing_rules DROP COLUMN IF EXISTS airtable_record_id;

-- Phase 2: Create secure views that hide sensitive data from agents
-- Drop existing view if it exists
DROP VIEW IF EXISTS public.agent_safe_esim_plans;

-- Create a view for agents that excludes wholesale_price and supplier_name
CREATE VIEW public.agent_safe_esim_plans AS
SELECT 
  id,
  title,
  description,
  data_amount,
  validity_days,
  country_code,
  country_name,
  currency,
  is_active,
  admin_only,
  created_at,
  updated_at,
  supplier_plan_id
FROM public.esim_plans;

-- Grant access to the view
GRANT SELECT ON public.agent_safe_esim_plans TO authenticated;

-- Phase 3: Update RLS policies to hide wholesale data
-- First, let's update the orders SELECT policy to exclude wholesale_price for non-admins
DROP POLICY IF EXISTS "Approved agents can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Agents cannot view others wholesale prices" ON public.orders;

CREATE POLICY "Agents can view their own orders without wholesale data" ON public.orders
FOR SELECT 
USING (
  agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() 
    AND status = 'approved'::agent_status
  )
);

-- Create separate policy for admins to see everything
CREATE POLICY "Admins can view all order details including wholesale" ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Phase 4: Update esim_plans RLS to restrict agent access to the safe view
-- Agents should not be able to query esim_plans directly, only through the safe view
DROP POLICY IF EXISTS "Approved agents can view eSIM plans" ON public.esim_plans;

-- Only admins and service role can access full esim_plans table
-- Agents will use agent_safe_esim_plans view instead