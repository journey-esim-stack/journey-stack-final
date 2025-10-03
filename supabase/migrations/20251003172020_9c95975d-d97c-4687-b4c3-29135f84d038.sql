-- Fix security definer warnings by enabling security_invoker mode on views
-- This ensures views respect RLS policies of the querying user, not the view creator

ALTER VIEW public.agent_safe_plans SET (security_invoker = on);
ALTER VIEW public.agent_safe_orders SET (security_invoker = on);