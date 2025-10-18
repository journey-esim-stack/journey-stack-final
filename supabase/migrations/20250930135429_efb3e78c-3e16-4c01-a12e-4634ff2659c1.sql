-- Add agent_filter column to pricing_rules table for agent-specific pricing
ALTER TABLE pricing_rules 
ADD COLUMN agent_filter text;

-- Add index for better query performance on agent_filter
CREATE INDEX idx_pricing_rules_agent_filter ON pricing_rules(agent_filter) WHERE agent_filter IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN pricing_rules.agent_filter IS 'Agent ID filter for agent-specific pricing rules. When set, this rule only applies to the specified agent.';