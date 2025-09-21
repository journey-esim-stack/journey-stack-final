-- Add additional security policies and functions for better data protection

-- Create function to validate agent access to orders
CREATE OR REPLACE FUNCTION public.validate_agent_order_access(_agent_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    INNER JOIN public.agent_profiles ap ON o.agent_id = ap.id
    WHERE o.id = _order_id 
      AND ap.id = _agent_id
      AND ap.user_id = auth.uid()
      AND ap.status = 'approved'::agent_status
  );
$$;

-- Create function to validate agent wallet access
CREATE OR REPLACE FUNCTION public.validate_agent_wallet_access(_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_profiles ap
    WHERE ap.id = _agent_id
      AND ap.user_id = auth.uid()
      AND ap.status = 'approved'::agent_status
  );
$$;

-- Add stricter policy for customer data in orders
DROP POLICY IF EXISTS "Approved agents can view their own orders" ON public.orders;
CREATE POLICY "Approved agents can view their own orders" 
ON public.orders 
FOR SELECT 
USING (
  agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() 
      AND status = 'approved'::agent_status
  )
);

-- Add policy to prevent agents from viewing other agents' wholesale prices
CREATE POLICY "Agents cannot view others wholesale prices" 
ON public.orders 
FOR SELECT 
USING (
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN true
    ELSE agent_id IN (
      SELECT id FROM agent_profiles 
      WHERE user_id = auth.uid() 
        AND status = 'approved'::agent_status
    )
  END
);

-- Create audit function for sensitive operations
CREATE OR REPLACE FUNCTION public.audit_sensitive_operation(
  _table_name text,
  _operation text,
  _record_id text,
  _details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    action,
    record_id,
    user_id,
    new_values,
    created_at
  ) VALUES (
    _table_name,
    _operation,
    _record_id,
    auth.uid(),
    _details,
    now()
  );
END;
$$;