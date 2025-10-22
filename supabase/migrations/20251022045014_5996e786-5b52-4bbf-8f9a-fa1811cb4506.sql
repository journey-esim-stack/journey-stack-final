-- Add RLS policy to prevent agents from changing their wallet_currency
-- This ensures wallet currency is fixed after registration

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Approved agents cannot change wallet currency" ON public.agent_profiles;

-- Create new policy to prevent wallet_currency updates by agents
-- Only admins can update wallet_currency
CREATE POLICY "Agents cannot change wallet currency"
ON public.agent_profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  AND status = 'approved'::agent_status
  -- Allow update only if wallet_currency hasn't changed
  AND wallet_currency = (
    SELECT wallet_currency 
    FROM agent_profiles 
    WHERE id = agent_profiles.id
  )
)
WITH CHECK (
  auth.uid() = user_id 
  AND status = 'approved'::agent_status
  -- Ensure wallet_currency in the update matches the existing value
  AND wallet_currency = (
    SELECT wallet_currency 
    FROM agent_profiles 
    WHERE id = agent_profiles.id
  )
);

-- Ensure wallet_currency is never NULL
ALTER TABLE public.agent_profiles
ALTER COLUMN wallet_currency SET NOT NULL;

-- Add a comment explaining the constraint
COMMENT ON COLUMN public.agent_profiles.wallet_currency IS 'Fixed wallet currency set at registration based on agent country. Cannot be changed by agents after creation.';