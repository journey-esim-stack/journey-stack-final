-- Add explicit security policy to deny unauthorized access to wallet transactions
-- This ensures that only authenticated users with approved agent status can access their own transactions

-- First, let's add a restrictive policy that explicitly denies access to unauthorized users
CREATE POLICY "Deny unauthorized access to wallet transactions" 
ON public.wallet_transactions 
FOR ALL 
TO public
USING (
  -- Only allow access if user is authenticated AND has an approved agent profile
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 
    FROM public.agent_profiles 
    WHERE user_id = auth.uid() 
    AND status = 'approved'::agent_status
  )
  -- AND the transaction belongs to this agent
  AND agent_id IN (
    SELECT id 
    FROM public.agent_profiles 
    WHERE user_id = auth.uid() 
    AND status = 'approved'::agent_status
  )
)
WITH CHECK (
  -- Same check for INSERT operations (though this is primarily handled by service role)
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 
    FROM public.agent_profiles 
    WHERE user_id = auth.uid() 
    AND status = 'approved'::agent_status
  )
);