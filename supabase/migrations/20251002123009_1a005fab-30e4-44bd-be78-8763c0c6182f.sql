-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Approved agents can manage their own pricing" ON public.agent_pricing;

-- Create policy for agents to view their own pricing
CREATE POLICY "Approved agents can view their own pricing"
ON public.agent_pricing
FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT id FROM public.agent_profiles
    WHERE user_id = auth.uid() AND status = 'approved'::agent_status
  )
);

-- Create policy for admins to view all pricing
CREATE POLICY "Admins can view all agent pricing"
ON public.agent_pricing
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policy for agents to insert their own pricing
CREATE POLICY "Approved agents can insert their own pricing"
ON public.agent_pricing
FOR INSERT
TO authenticated
WITH CHECK (
  agent_id IN (
    SELECT id FROM public.agent_profiles
    WHERE user_id = auth.uid() AND status = 'approved'::agent_status
  )
);

-- Create policy for agents to update their own pricing
CREATE POLICY "Approved agents can update their own pricing"
ON public.agent_pricing
FOR UPDATE
TO authenticated
USING (
  agent_id IN (
    SELECT id FROM public.agent_profiles
    WHERE user_id = auth.uid() AND status = 'approved'::agent_status
  )
)
WITH CHECK (
  agent_id IN (
    SELECT id FROM public.agent_profiles
    WHERE user_id = auth.uid() AND status = 'approved'::agent_status
  )
);

-- Create policy for agents to delete their own pricing
CREATE POLICY "Approved agents can delete their own pricing"
ON public.agent_pricing
FOR DELETE
TO authenticated
USING (
  agent_id IN (
    SELECT id FROM public.agent_profiles
    WHERE user_id = auth.uid() AND status = 'approved'::agent_status
  )
);