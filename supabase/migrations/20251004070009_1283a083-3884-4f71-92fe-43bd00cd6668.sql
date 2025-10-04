-- Update get_agent_visible_plans to allow admins OR approved agents
CREATE OR REPLACE FUNCTION public.get_agent_visible_plans()
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
  FROM public.esim_plans
  WHERE is_active = true 
    AND admin_only = false
    AND (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.agent_profiles ap
        WHERE ap.user_id = auth.uid()
          AND ap.status = 'approved'::agent_status
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_visible_plans() TO authenticated;