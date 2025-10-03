-- ============================================
-- SECURITY FIX: Hide wholesale prices and supplier info from agents
-- ============================================

-- Step 1: Create a secure view for agents that ONLY exposes retail-safe data
CREATE OR REPLACE VIEW public.agent_safe_plans AS
SELECT 
  id,
  title,
  description,
  country_name,
  country_code,
  data_amount,
  validity_days,
  currency,
  is_active,
  admin_only,
  created_at,
  updated_at
  -- EXPLICITLY EXCLUDING: wholesale_price, supplier_name, supplier_plan_id
FROM public.esim_plans;

-- Step 2: Grant SELECT permission on the view to authenticated users
GRANT SELECT ON public.agent_safe_plans TO authenticated;

-- Step 3: Drop the existing permissive RLS policy that exposes sensitive data
DROP POLICY IF EXISTS "Approved agents can view active eSIM plans" ON public.esim_plans;

-- Step 4: Create a RESTRICTIVE policy that prevents agents from accessing esim_plans directly
-- Only admins and service role can access esim_plans
CREATE POLICY "Only admins can view esim_plans with wholesale data"
ON public.esim_plans
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Step 5: Similarly secure the orders table - create a view for agents
CREATE OR REPLACE VIEW public.agent_safe_orders AS
SELECT 
  id,
  agent_id,
  plan_id,
  retail_price,
  status,
  customer_name,
  customer_email,
  customer_phone,
  esim_iccid,
  esim_qr_code,
  esim_expiry_date,
  activation_code,
  smdp_address,
  real_status,
  manual_code,
  device_brand_id,
  device_model_id,
  compatibility_checked,
  compatibility_warning_shown,
  created_at,
  updated_at
  -- EXPLICITLY EXCLUDING: wholesale_price, supplier_order_id
FROM public.orders;

-- Grant SELECT on agent_safe_orders
GRANT SELECT ON public.agent_safe_orders TO authenticated;

-- Step 6: Update orders RLS policy to be more restrictive
DROP POLICY IF EXISTS "Agents can view their own orders without wholesale data" ON public.orders;

CREATE POLICY "Only admins can view orders with wholesale data"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Step 7: Add comment to document security
COMMENT ON VIEW public.agent_safe_plans IS 'Secure view that hides wholesale_price, supplier_name, and supplier_plan_id from agents';
COMMENT ON VIEW public.agent_safe_orders IS 'Secure view that hides wholesale_price and supplier_order_id from agents';

-- Step 8: Verify no other columns expose supplier info
-- The following columns are now ONLY accessible to admins:
-- esim_plans: wholesale_price, supplier_name, supplier_plan_id
-- orders: wholesale_price, supplier_order_id