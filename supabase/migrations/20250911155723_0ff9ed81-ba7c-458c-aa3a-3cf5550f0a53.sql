-- Update RLS policies to prevent pending agents from accessing the platform
DROP POLICY IF EXISTS "Agents can view their own profile" ON public.agent_profiles;
DROP POLICY IF EXISTS "Agents can update their own non-markup fields" ON public.agent_profiles;

-- Create new policy that only allows approved agents to view their profile
CREATE POLICY "Approved agents can view their own profile" 
ON public.agent_profiles 
FOR SELECT 
USING (auth.uid() = user_id AND status = 'approved');

-- Create new policy that only allows approved agents to update their non-markup fields
CREATE POLICY "Approved agents can update their own non-markup fields" 
ON public.agent_profiles 
FOR UPDATE 
USING (auth.uid() = user_id AND status = 'approved' AND profile_markups_equal(id, markup_type, markup_value))
WITH CHECK (auth.uid() = user_id AND status = 'approved' AND profile_markups_equal(id, markup_type, markup_value));

-- Update other tables to only allow approved agents
DROP POLICY IF EXISTS "Agents can view their own transactions" ON public.wallet_transactions;
CREATE POLICY "Approved agents can view their own transactions" 
ON public.wallet_transactions 
FOR SELECT 
USING (agent_id IN (
  SELECT agent_profiles.id
  FROM agent_profiles
  WHERE agent_profiles.user_id = auth.uid() AND agent_profiles.status = 'approved'
));

DROP POLICY IF EXISTS "Agents can manage their own orders" ON public.orders;
CREATE POLICY "Approved agents can manage their own orders" 
ON public.orders 
FOR ALL 
USING (agent_id IN (
  SELECT agent_profiles.id
  FROM agent_profiles
  WHERE agent_profiles.user_id = auth.uid() AND agent_profiles.status = 'approved'
));

DROP POLICY IF EXISTS "Agents can manage their own pricing" ON public.agent_pricing;
CREATE POLICY "Approved agents can manage their own pricing" 
ON public.agent_pricing 
FOR ALL 
USING (agent_id IN (
  SELECT agent_profiles.id
  FROM agent_profiles
  WHERE agent_profiles.user_id = auth.uid() AND agent_profiles.status = 'approved'
));

DROP POLICY IF EXISTS "Agents can view their own topups" ON public.esim_topups;
CREATE POLICY "Approved agents can view their own topups" 
ON public.esim_topups 
FOR SELECT 
USING (agent_id IN (
  SELECT agent_profiles.id
  FROM agent_profiles
  WHERE agent_profiles.user_id = auth.uid() AND agent_profiles.status = 'approved'
));