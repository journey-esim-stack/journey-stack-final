-- Phase 1: Add supplier tracking and admin control fields to esim_plans
ALTER TABLE public.esim_plans 
ADD COLUMN supplier_name TEXT NOT NULL DEFAULT 'esim_access',
ADD COLUMN admin_only BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient supplier-based queries
CREATE INDEX idx_esim_plans_supplier_name ON public.esim_plans(supplier_name);
CREATE INDEX idx_esim_plans_admin_only ON public.esim_plans(admin_only);

-- Phase 2: Add supplier routing configuration to system_settings
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES 
('supplier_routing', '{"US": "esim_access", "GB": "esim_access", "DE": "esim_access", "FR": "esim_access", "Asia": "esim_access", "default": "esim_access"}', 'JSON configuration for routing countries/regions to specific suppliers')
ON CONFLICT (setting_key) DO UPDATE SET 
setting_value = EXCLUDED.setting_value,
description = EXCLUDED.description;

INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES 
('supplier_configs', '{"esim_access": {"enabled": true, "priority": 1}, "maya": {"enabled": false, "priority": 2}}', 'JSON configuration for supplier settings and priorities')
ON CONFLICT (setting_key) DO UPDATE SET 
setting_value = EXCLUDED.setting_value,
description = EXCLUDED.description;