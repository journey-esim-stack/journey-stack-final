-- ============================================
-- SECURITY FIX: Hide wholesale prices and supplier info from agents
-- ============================================

-- Step 1: Create secure views if they don't exist
DO $$ 
BEGIN
  -- Create agent_safe_plans view
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

  -- Create agent_safe_orders view
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
END $$;

-- Step 2: Grant permissions
GRANT SELECT ON public.agent_safe_plans TO authenticated;
GRANT SELECT ON public.agent_safe_orders TO authenticated;

-- Step 3: Drop old permissive policies
DROP POLICY IF EXISTS "Approved agents can view active eSIM plans" ON public.esim_plans;
DROP POLICY IF EXISTS "Agents can view their own orders without wholesale data" ON public.orders;

-- Step 4: Only recreate the orders policy (esim_plans policy already exists from previous migration)
DROP POLICY IF EXISTS "Only admins can view orders with wholesale data" ON public.orders;
CREATE POLICY "Only admins can view orders with wholesale data"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Step 5: Add documentation
COMMENT ON VIEW public.agent_safe_plans IS 'Secure view that hides wholesale_price, supplier_name, and supplier_plan_id from agents';
COMMENT ON VIEW public.agent_safe_orders IS 'Secure view that hides wholesale_price and supplier_order_id from agents';