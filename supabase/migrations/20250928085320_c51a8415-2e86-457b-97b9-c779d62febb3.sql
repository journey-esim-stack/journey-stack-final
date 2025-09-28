-- Create pricing rules table for Airtable integration
CREATE TABLE public.pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  airtable_record_id TEXT UNIQUE NOT NULL,
  rule_type TEXT NOT NULL, -- 'agent', 'country', 'plan', 'default'
  target_id TEXT, -- agent_id, country_code, plan_id, or null for default
  markup_type TEXT NOT NULL DEFAULT 'percent', -- 'percent' or 'fixed'
  markup_value NUMERIC NOT NULL DEFAULT 300,
  min_order_amount NUMERIC DEFAULT 0,
  max_order_amount NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100, -- Lower number = higher priority
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- Create policies for pricing rules
CREATE POLICY "Service role can manage pricing rules" 
ON public.pricing_rules 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Approved agents can view pricing rules" 
ON public.pricing_rules 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM agent_profiles 
  WHERE agent_profiles.user_id = auth.uid() 
  AND agent_profiles.status = 'approved'::agent_status
));

-- Create indexes for better performance
CREATE INDEX idx_pricing_rules_rule_type ON public.pricing_rules(rule_type);
CREATE INDEX idx_pricing_rules_target_id ON public.pricing_rules(target_id);
CREATE INDEX idx_pricing_rules_priority ON public.pricing_rules(priority);
CREATE INDEX idx_pricing_rules_is_active ON public.pricing_rules(is_active);

-- Create trigger for updated_at
CREATE TRIGGER update_pricing_rules_updated_at
BEFORE UPDATE ON public.pricing_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for pricing rules
ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_rules;