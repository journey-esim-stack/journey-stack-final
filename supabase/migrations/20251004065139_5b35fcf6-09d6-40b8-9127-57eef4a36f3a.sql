-- Ensure views run with invoker's rights (respecting RLS)
ALTER VIEW agent_safe_orders SET (security_invoker = true);
ALTER VIEW agent_safe_plans SET (security_invoker = true);