-- Critical Security Fixes for Production (Fixed)

-- 1. Fix Orders table RLS - prevent access to other agents' customer data
DROP POLICY IF EXISTS "Approved agents can manage their own orders" ON public.orders;

-- Create separate policies for better security control
CREATE POLICY "Approved agents can view their own orders" 
ON public.orders 
FOR SELECT 
USING (agent_id IN (
  SELECT id FROM agent_profiles 
  WHERE user_id = auth.uid() AND status = 'approved'::agent_status
));

CREATE POLICY "Approved agents can create their own orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (agent_id IN (
  SELECT id FROM agent_profiles 
  WHERE user_id = auth.uid() AND status = 'approved'::agent_status
));

CREATE POLICY "Approved agents can update their own orders" 
ON public.orders 
FOR UPDATE 
USING (agent_id IN (
  SELECT id FROM agent_profiles 
  WHERE user_id = auth.uid() AND status = 'approved'::agent_status
))
WITH CHECK (agent_id IN (
  SELECT id FROM agent_profiles 
  WHERE user_id = auth.uid() AND status = 'approved'::agent_status
));

-- Service role can manage all orders for system operations
CREATE POLICY "Service role can manage all orders" 
ON public.orders 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- 2. Restrict eSIM plans access - only show to approved agents
DROP POLICY IF EXISTS "Allow authenticated users to view eSIM plans" ON public.esim_plans;

CREATE POLICY "Approved agents can view eSIM plans" 
ON public.esim_plans 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM agent_profiles 
  WHERE user_id = auth.uid() AND status = 'approved'::agent_status
));

-- Admins can manage eSIM plans
CREATE POLICY "Admins can manage eSIM plans" 
ON public.esim_plans 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage eSIM plans for sync operations
CREATE POLICY "Service role can manage eSIM plans" 
ON public.esim_plans 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Enhance eSIM topups security
DROP POLICY IF EXISTS "Service role can insert topups" ON public.esim_topups;

CREATE POLICY "Service role can manage topups" 
ON public.esim_topups 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- 4. Add audit logging table for security monitoring
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');