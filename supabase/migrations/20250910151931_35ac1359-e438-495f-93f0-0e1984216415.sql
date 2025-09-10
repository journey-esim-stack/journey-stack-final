-- Just add the INSERT policy, SELECT policy already exists
CREATE POLICY "Service role can insert wallet transactions" 
ON public.wallet_transactions 
FOR INSERT 
TO service_role
WITH CHECK (true);