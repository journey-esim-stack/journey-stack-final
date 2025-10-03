-- Deduplicate existing agent_pricing rows by keeping the latest updated_at per (agent_id, plan_id)
DELETE FROM public.agent_pricing ap
USING public.agent_pricing ap2
WHERE ap.agent_id = ap2.agent_id
  AND ap.plan_id = ap2.plan_id
  AND ap.updated_at < ap2.updated_at;

-- Ensure updated_at auto-updates on change
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_pricing_updated_at'
  ) THEN
    CREATE TRIGGER update_agent_pricing_updated_at
    BEFORE UPDATE ON public.agent_pricing
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;