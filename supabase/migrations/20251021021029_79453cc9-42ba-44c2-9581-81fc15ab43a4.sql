-- Create exchange_rates table for caching live rates
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  rates JSONB NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read exchange rates (public data)
CREATE POLICY "Anyone can view exchange rates"
  ON public.exchange_rates
  FOR SELECT
  USING (true);

-- Only service role can insert/update exchange rates
CREATE POLICY "Service role can manage exchange rates"
  ON public.exchange_rates
  FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create index for faster lookups
CREATE INDEX idx_exchange_rates_updated ON public.exchange_rates(last_updated DESC);