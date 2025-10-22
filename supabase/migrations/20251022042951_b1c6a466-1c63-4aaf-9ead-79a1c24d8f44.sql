-- Add wallet_currency column to agent_profiles
ALTER TABLE agent_profiles 
ADD COLUMN wallet_currency text DEFAULT 'USD' CHECK (wallet_currency IN ('USD', 'INR', 'AUD', 'EUR'));

-- Migrate existing agents: Set INR for Indian agents, USD for others
UPDATE agent_profiles 
SET wallet_currency = CASE 
  WHEN country = 'India' THEN 'INR'
  ELSE 'USD'
END;