-- CRITICAL SECURITY FIX: Prevent agents from seeing supplier names
-- Issue: Agents can query esim_plans table directly and see supplier_name column

-- Solution 1: Create a new secure function that agents must use
CREATE OR REPLACE FUNCTION get_agent_visible_plans()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  country_name text,
  country_code text,
  data_amount text,
  validity_days integer,
  currency text,
  is_active boolean,
  admin_only boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  FROM esim_plans
  WHERE is_active = true 
  AND admin_only = false
  AND EXISTS (
    SELECT 1 FROM agent_profiles
    WHERE user_id = auth.uid()
    AND status = 'approved'::agent_status
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_agent_visible_plans() TO authenticated;

-- Solution 2: Remove agent SELECT access from esim_plans table
-- Drop the policy that allows agents to SELECT
DROP POLICY IF EXISTS "Approved agents can view esim_plans" ON esim_plans;

-- Solution 3: Agents can only access through orders table (which joins to esim_plans)
-- This is controlled by orders RLS and only exposes specific fields through the join