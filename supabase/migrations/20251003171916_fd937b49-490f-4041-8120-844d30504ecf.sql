-- Fix security definer view warnings by dropping and recreating with security invoker

-- Drop existing views
DROP VIEW IF EXISTS public.agent_safe_plans CASCADE;
DROP VIEW IF EXISTS public.agent_safe_orders CASCADE;
DROP VIEW IF EXISTS public.agent_safe_esim_plans CASCADE;

-- Recreate agent_safe_plans with security invoker
CREATE VIEW public.agent_safe_plans 
WITH (security_invoker = true)
AS
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
FROM public.esim_plans;

-- Recreate agent_safe_orders with security invoker  
CREATE VIEW public.agent_safe_orders
WITH (security_invoker = true)
AS
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
FROM public.orders;

-- Grant permissions
GRANT SELECT ON public.agent_safe_plans TO authenticated;
GRANT SELECT ON public.agent_safe_orders TO authenticated;

-- Add documentation
COMMENT ON VIEW public.agent_safe_plans IS 'Security invoker view that hides wholesale_price, supplier_name, and supplier_plan_id from agents';
COMMENT ON VIEW public.agent_safe_orders IS 'Security invoker view that hides wholesale_price and supplier_order_id from agents';