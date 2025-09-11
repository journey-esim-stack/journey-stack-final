-- Update default markup value for new agent profiles to 300%
ALTER TABLE public.agent_profiles 
ALTER COLUMN markup_value SET DEFAULT 300;