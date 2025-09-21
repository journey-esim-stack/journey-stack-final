-- Enable realtime for esim_status_events table to track status changes
ALTER TABLE public.esim_status_events REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.esim_status_events;