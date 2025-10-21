-- Optimize agent_pricing lookups with composite indexes
CREATE INDEX IF NOT EXISTS idx_agent_pricing_agent_plan 
ON agent_pricing(agent_id, plan_id);

-- Index for batch queries on agent_id only
CREATE INDEX IF NOT EXISTS idx_agent_pricing_agent 
ON agent_pricing(agent_id);

-- Index for updated_at ordering (used in Edge Function)
CREATE INDEX IF NOT EXISTS idx_agent_pricing_updated_at 
ON agent_pricing(agent_id, updated_at DESC);