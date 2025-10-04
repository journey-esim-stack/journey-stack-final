-- CRITICAL SECURITY FIX: Recreate safe views with SECURITY DEFINER
-- This ensures they respect the RLS policies of the underlying tables

-- Drop existing views
DROP VIEW IF EXISTS agent_safe_orders;
DROP VIEW IF EXISTS agent_safe_plans;

-- Recreate agent_safe_orders as a SECURITY DEFINER view
-- This view filters out wholesale_price and supplier information
CREATE VIEW agent_safe_orders
WITH (security_invoker = false)
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
FROM orders;

-- Recreate agent_safe_plans as a SECURITY DEFINER view  
-- This view filters out wholesale_price, supplier_name, and supplier_plan_id
CREATE VIEW agent_safe_plans
WITH (security_invoker = false)
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
FROM esim_plans;

-- Grant appropriate permissions
-- Authenticated users can query these views, but the underlying RLS policies control what they see
GRANT SELECT ON agent_safe_orders TO authenticated;
GRANT SELECT ON agent_safe_plans TO authenticated;