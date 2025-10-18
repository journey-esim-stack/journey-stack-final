-- Add plan_id column to pricing_rules
ALTER TABLE pricing_rules 
ADD COLUMN plan_id UUID;

-- Add foreign key constraint
ALTER TABLE pricing_rules
ADD CONSTRAINT fk_pricing_rules_plan_id 
FOREIGN KEY (plan_id) 
REFERENCES esim_plans(id) 
ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_pricing_rules_plan_id ON pricing_rules(plan_id);

-- Migrate existing plan rules from target_id to plan_id
UPDATE pricing_rules pr
SET plan_id = ep.id
FROM esim_plans ep
WHERE pr.rule_type = 'plan'
  AND pr.target_id = ep.supplier_plan_id;

-- Add comment for documentation
COMMENT ON COLUMN pricing_rules.plan_id IS 'UUID reference to esim_plans.id - universal identifier for plan-based pricing rules';