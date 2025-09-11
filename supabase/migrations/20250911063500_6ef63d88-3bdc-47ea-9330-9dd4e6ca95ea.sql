-- Enable realtime for agent_profiles table
ALTER TABLE public.agent_profiles REPLICA IDENTITY FULL;

-- Add the table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_profiles;