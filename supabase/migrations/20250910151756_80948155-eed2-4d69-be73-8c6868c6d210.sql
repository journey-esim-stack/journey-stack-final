-- Allow edge functions (service role) to insert wallet transactions
-- This is needed for the confirm-topup function to work properly

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Service role can insert wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Service role can manage wallet transactions" ON public.wallet_transactions;

-- Create policy to allow service role (edge functions) to insert transactions
CREATE POLICY "Service role can insert wallet transactions" 
ON public.wallet_transactions 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Also allow service role to select (for idempotency checks)
CREATE POLICY "Service role can select wallet transactions" 
ON public.wallet_transactions 
FOR SELECT 
TO service_role
USING (true);