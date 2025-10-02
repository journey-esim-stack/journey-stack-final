-- Add missing agent_pricing entry for Balkans plan
INSERT INTO agent_pricing (agent_id, plan_id, retail_price)
VALUES (
  '2672d44b-aadc-4435-bb57-f3bf69bbcb26',
  '2faf31ac-5b56-4dc7-80c7-03cea5274e82',
  36.00
)
ON CONFLICT (agent_id, plan_id) DO UPDATE
SET retail_price = 36.00;