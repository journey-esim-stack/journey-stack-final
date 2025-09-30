-- Insert default 300% markup pricing rule
-- This will be the fallback for all agents who don't have custom pricing
INSERT INTO public.pricing_rules (
  rule_type,
  target_id,
  markup_type,
  markup_value,
  priority,
  is_active,
  airtable_record_id
)
VALUES (
  'default',
  NULL,
  'percent',
  300,
  999,
  true,
  'default-rule'
)
ON CONFLICT (airtable_record_id) DO UPDATE SET
  rule_type = EXCLUDED.rule_type,
  markup_type = EXCLUDED.markup_type,
  markup_value = EXCLUDED.markup_value,
  priority = EXCLUDED.priority,
  is_active = EXCLUDED.is_active;