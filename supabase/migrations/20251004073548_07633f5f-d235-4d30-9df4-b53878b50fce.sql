-- Replace get_agent_visible_plans by dropping and recreating with extended columns
DROP FUNCTION IF EXISTS public.get_agent_visible_plans();

CREATE OR REPLACE FUNCTION public.get_agent_visible_plans()
RETURNS TABLE(
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
  wholesale_price numeric,
  supplier_plan_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    wholesale_price,
    supplier_plan_id,
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
$function$;