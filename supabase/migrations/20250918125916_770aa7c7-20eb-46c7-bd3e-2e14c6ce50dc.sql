-- Create table to store eSIM status events from webhooks
CREATE TABLE public.esim_status_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iccid TEXT NOT NULL,
  eid TEXT,
  esim_status TEXT,
  smdp_status TEXT,
  event_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on iccid for upsert operations
CREATE UNIQUE INDEX idx_esim_status_events_iccid ON public.esim_status_events(iccid);

-- Add real_status and esim_expiry_date columns to orders table
ALTER TABLE public.orders 
ADD COLUMN real_status TEXT,
ADD COLUMN esim_expiry_date TIMESTAMP WITH TIME ZONE;

-- Enable RLS on esim_status_events
ALTER TABLE public.esim_status_events ENABLE ROW LEVEL SECURITY;

-- Create policies for esim_status_events
CREATE POLICY "Approved agents can view their own eSIM status events" 
ON public.esim_status_events 
FOR SELECT 
USING (
  iccid IN (
    SELECT o.esim_iccid 
    FROM orders o
    JOIN agent_profiles ap ON o.agent_id = ap.id
    WHERE ap.user_id = auth.uid() AND ap.status = 'approved'::agent_status
  )
);

CREATE POLICY "Service role can manage eSIM status events" 
ON public.esim_status_events 
FOR ALL 
USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- Enable realtime for orders table
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Enable realtime for esim_status_events table
ALTER TABLE public.esim_status_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.esim_status_events;

-- Create trigger for esim_status_events updated_at
CREATE TRIGGER update_esim_status_events_updated_at
BEFORE UPDATE ON public.esim_status_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();