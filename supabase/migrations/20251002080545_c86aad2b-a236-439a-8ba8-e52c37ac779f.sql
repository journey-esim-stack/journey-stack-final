-- 1) Backfill pricing_rules.plan_id from target_id using esim_plans
UPDATE public.pricing_rules pr
SET plan_id = ep.id
FROM public.esim_plans ep
WHERE pr.plan_id IS NULL
  AND pr.target_id IS NOT NULL
  AND (ep.supplier_plan_id = pr.target_id OR ep.id::text = pr.target_id);

-- 2) Deduplicate active fixed_price rules per (agent_filter, plan_id), keep highest priority (lowest number) and latest updated
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY agent_filter, plan_id
           ORDER BY priority ASC, updated_at DESC, created_at DESC
         ) AS rn
  FROM public.pricing_rules
  WHERE is_active = true
    AND rule_type = 'fixed_price'
    AND plan_id IS NOT NULL
    AND agent_filter IS NOT NULL
)
UPDATE public.pricing_rules pr
SET is_active = false
FROM ranked r
WHERE pr.id = r.id
  AND r.rn > 1;

-- 3) Create unique index to prevent duplicates moving forward
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'uniq_active_fixed_price_agent_plan'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uniq_active_fixed_price_agent_plan ON public.pricing_rules (agent_filter, plan_id)
             WHERE is_active = true AND rule_type = ''fixed_price'' AND plan_id IS NOT NULL AND agent_filter IS NOT NULL';
  END IF;
END $$;

-- 4) Cleanup potential duplicates in agent_pricing, keeping most recent
WITH ranked_ap AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY agent_id, plan_id
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM public.agent_pricing
)
DELETE FROM public.agent_pricing ap
USING ranked_ap r
WHERE ap.id = r.id
  AND r.rn > 1;

-- 5) Enforce uniqueness on agent_pricing(agent_id, plan_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'agent_pricing' AND constraint_name = 'agent_pricing_agent_plan_unique'
  ) THEN
    ALTER TABLE public.agent_pricing
      ADD CONSTRAINT agent_pricing_agent_plan_unique UNIQUE (agent_id, plan_id);
  END IF;
END $$;

-- 6) Helpful indexes for lookups
CREATE INDEX IF NOT EXISTS idx_agent_pricing_agent_plan ON public.agent_pricing(agent_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_plan ON public.pricing_rules(plan_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_agent_filter ON public.pricing_rules(agent_filter);
