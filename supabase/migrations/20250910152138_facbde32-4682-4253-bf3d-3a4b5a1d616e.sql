-- Create a test transaction with correct enum value
INSERT INTO public.wallet_transactions (
  agent_id,
  transaction_type,
  description,
  reference_id,
  amount,
  balance_after
) VALUES (
  '4b6259a8-4dff-4a4d-91a9-fc32bdfb9e20',  -- The agent ID from earlier query
  'deposit'::transaction_type,
  'Test Top-Up Transaction',
  'test-' || extract(epoch from now())::text,
  10.00,
  10.00
);

-- Also update the agent's wallet balance to match
UPDATE public.agent_profiles 
SET wallet_balance = 10.00, updated_at = now()
WHERE id = '4b6259a8-4dff-4a4d-91a9-fc32bdfb9e20';