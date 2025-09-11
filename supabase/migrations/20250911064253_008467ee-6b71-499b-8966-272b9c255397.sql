-- Create table to track top-up history
CREATE TABLE public.esim_topups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  iccid TEXT NOT NULL,
  package_code TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  data_amount TEXT,
  validity_days INTEGER,
  transaction_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.esim_topups ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Agents can view their own topups" 
ON public.esim_topups 
FOR SELECT 
USING (agent_id IN (
  SELECT agent_profiles.id 
  FROM agent_profiles 
  WHERE agent_profiles.user_id = auth.uid()
));

CREATE POLICY "Service role can insert topups" 
ON public.esim_topups 
FOR INSERT 
WITH CHECK (true);

-- Add trigger for timestamps
CREATE TRIGGER update_esim_topups_updated_at
BEFORE UPDATE ON public.esim_topups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();