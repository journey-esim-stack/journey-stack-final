-- =====================================================
-- JourneyStack Staging Database Schema
-- Complete migration for staging environment setup
-- =====================================================

-- =====================================================
-- STEP 1: Create Enum Types
-- =====================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.agent_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.partner_type AS ENUM ('agent', 'api_partner');
CREATE TYPE public.order_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE public.transaction_type AS ENUM ('credit', 'debit');

-- =====================================================
-- STEP 2: Create Tables First (before functions that reference them)
-- =====================================================

-- Table: user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Table: agent_profiles
CREATE TABLE public.agent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_person text NOT NULL,
  phone text NOT NULL,
  country text NOT NULL,
  business_license text,
  status agent_status NOT NULL DEFAULT 'pending',
  partner_type partner_type NOT NULL DEFAULT 'agent',
  markup_type text NOT NULL DEFAULT 'percent',
  markup_value numeric NOT NULL DEFAULT 300,
  wallet_balance numeric NOT NULL DEFAULT 0.00,
  wallet_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Table: device_brands
CREATE TABLE public.device_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: device_models
CREATE TABLE public.device_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.device_brands(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  is_esim_compatible boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id, model_name)
);

-- Table: esim_plans
CREATE TABLE public.esim_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  country_name text NOT NULL,
  country_code text NOT NULL,
  data_amount text NOT NULL,
  validity_days integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  wholesale_price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  admin_only boolean NOT NULL DEFAULT false,
  supplier_plan_id text NOT NULL,
  supplier_name text NOT NULL DEFAULT 'esim_access',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.esim_plans(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  device_brand_id uuid REFERENCES public.device_brands(id) ON DELETE SET NULL,
  device_model_id uuid REFERENCES public.device_models(id) ON DELETE SET NULL,
  compatibility_checked boolean DEFAULT false,
  compatibility_warning_shown boolean DEFAULT false,
  retail_price numeric NOT NULL,
  wholesale_price numeric NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  real_status text,
  supplier_order_id text,
  esim_iccid text,
  esim_qr_code text,
  activation_code text,
  manual_code text,
  smdp_address text,
  esim_expiry_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: agent_pricing
CREATE TABLE public.agent_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.esim_plans(id) ON DELETE CASCADE,
  retail_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, plan_id)
);

-- Table: pricing_rules
CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL,
  target_id text,
  plan_id uuid REFERENCES public.esim_plans(id) ON DELETE CASCADE,
  agent_filter text,
  markup_type text NOT NULL DEFAULT 'percent',
  markup_value numeric NOT NULL DEFAULT 300,
  min_order_amount numeric DEFAULT 0,
  max_order_amount numeric,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: wallet_transactions
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: api_credentials
CREATE TABLE public.api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  api_key text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: api_usage_logs
CREATE TABLE public.api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.api_credentials(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  http_method text NOT NULL,
  status_code integer NOT NULL,
  response_time_ms integer,
  request_body jsonb,
  response_body jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: webhooks
CREATE TABLE public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: webhook_logs
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: esim_topups
CREATE TABLE public.esim_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  iccid text NOT NULL,
  package_code text NOT NULL,
  data_amount text,
  validity_days integer,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  transaction_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: esim_status_events
CREATE TABLE public.esim_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iccid text NOT NULL,
  eid text,
  event_type text NOT NULL,
  esim_status text,
  smdp_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: exchange_rates
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL DEFAULT 'USD',
  rates jsonb NOT NULL,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: system_settings
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: audit_logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  action text NOT NULL,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- STEP 3: Create Database Functions (after tables exist)
-- =====================================================

-- Function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to validate agent order access
CREATE OR REPLACE FUNCTION public.validate_agent_order_access(_agent_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    INNER JOIN public.agent_profiles ap ON o.agent_id = ap.id
    WHERE o.id = _order_id 
      AND ap.id = _agent_id
      AND ap.user_id = auth.uid()
      AND ap.status = 'approved'::agent_status
  );
$$;

-- Function to validate agent wallet access
CREATE OR REPLACE FUNCTION public.validate_agent_wallet_access(_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_profiles ap
    WHERE ap.id = _agent_id
      AND ap.user_id = auth.uid()
      AND ap.status = 'approved'::agent_status
  );
$$;

-- Function to audit sensitive operations
CREATE OR REPLACE FUNCTION public.audit_sensitive_operation(_table_name text, _operation text, _record_id text, _details jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    action,
    record_id,
    user_id,
    new_values,
    created_at
  ) VALUES (
    _table_name,
    _operation,
    _record_id,
    auth.uid(),
    _details,
    now()
  );
END;
$$;

-- Function to check profile markup equality
CREATE OR REPLACE FUNCTION public.profile_markups_equal(_id uuid, _markup_type text, _markup_value numeric)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_profiles p
    WHERE p.id = _id
      AND p.markup_type IS NOT DISTINCT FROM _markup_type
      AND p.markup_value IS NOT DISTINCT FROM _markup_value
  );
$$;

-- =====================================================
-- STEP 4: Create Views
-- =====================================================

-- View: agent_safe_plans (excludes wholesale_price and supplier info)
CREATE OR REPLACE FUNCTION public.get_agent_safe_plans()
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  country_name text,
  country_code text,
  data_amount text,
  validity_days integer,
  currency text,
  is_active boolean,
  admin_only boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    title,
    description,
    country_name,
    country_code,
    data_amount,
    validity_days,
    currency,
    is_active,
    admin_only,
    created_at,
    updated_at
  FROM public.esim_plans
  WHERE is_active = true 
    AND admin_only = false
    AND (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.agent_profiles ap
        WHERE ap.user_id = auth.uid()
          AND ap.status = 'approved'::agent_status
      )
    );
$$;

-- View function with wholesale price (for admins)
CREATE OR REPLACE FUNCTION public.get_agent_visible_plans()
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  country_name text,
  country_code text,
  data_amount text,
  validity_days integer,
  currency text,
  is_active boolean,
  admin_only boolean,
  wholesale_price numeric,
  supplier_plan_id text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    title,
    description,
    country_name,
    country_code,
    data_amount,
    validity_days,
    currency,
    is_active,
    admin_only,
    wholesale_price,
    supplier_plan_id,
    created_at,
    updated_at
  FROM public.esim_plans
  WHERE is_active = true 
    AND admin_only = false
    AND (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.agent_profiles ap
        WHERE ap.user_id = auth.uid()
          AND ap.status = 'approved'::agent_status
      )
    );
$$;

-- Create materialized views for agent_safe_plans and agent_safe_orders
CREATE VIEW public.agent_safe_plans AS
SELECT 
  id,
  title,
  description,
  country_name,
  country_code,
  data_amount,
  validity_days,
  currency,
  is_active,
  admin_only,
  created_at,
  updated_at
FROM public.esim_plans;

CREATE VIEW public.agent_safe_orders AS
SELECT 
  o.id,
  o.agent_id,
  o.plan_id,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  o.device_brand_id,
  o.device_model_id,
  o.compatibility_checked,
  o.compatibility_warning_shown,
  o.retail_price,
  o.status,
  o.real_status,
  o.esim_iccid,
  o.esim_qr_code,
  o.activation_code,
  o.manual_code,
  o.smdp_address,
  o.esim_expiry_date,
  o.created_at,
  o.updated_at
FROM public.orders o;

-- =====================================================
-- STEP 5: Create Triggers
-- =====================================================

-- Trigger: Auto-create agent profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_name_val TEXT;
  contact_person_val TEXT;
  phone_val TEXT;
  country_val TEXT;
  partner_type_val TEXT;
  wallet_currency_val TEXT;
BEGIN
  -- Extract data from user metadata
  company_name_val := NEW.raw_user_meta_data ->> 'company_name';
  contact_person_val := NEW.raw_user_meta_data ->> 'contact_person';
  phone_val := NEW.raw_user_meta_data ->> 'phone';
  country_val := NEW.raw_user_meta_data ->> 'country';
  partner_type_val := COALESCE(NEW.raw_user_meta_data ->> 'partner_type', 'agent');
  
  -- Set wallet_currency based on country
  wallet_currency_val := CASE 
    WHEN country_val = 'India' THEN 'INR'
    ELSE 'USD'
  END;
  
  -- Only create profile if we have the required data
  IF company_name_val IS NOT NULL AND contact_person_val IS NOT NULL THEN
    INSERT INTO public.agent_profiles (
      user_id, 
      company_name, 
      contact_person, 
      phone, 
      country,
      partner_type,
      markup_value,
      wallet_currency
    )
    VALUES (
      NEW.id, 
      company_name_val, 
      contact_person_val, 
      COALESCE(phone_val, ''), 
      COALESCE(country_val, ''),
      partner_type_val::partner_type,
      CASE WHEN partner_type_val = 'api_partner' THEN 30 ELSE 300 END,
      wallet_currency_val
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Update updated_at on agent_profiles
CREATE TRIGGER update_agent_profiles_updated_at
  BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Update updated_at on device_brands
CREATE TRIGGER update_device_brands_updated_at
  BEFORE UPDATE ON public.device_brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Update updated_at on device_models
CREATE TRIGGER update_device_models_updated_at
  BEFORE UPDATE ON public.device_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Update updated_at on esim_plans
CREATE TRIGGER update_esim_plans_updated_at
  BEFORE UPDATE ON public.esim_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Update updated_at on orders
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Update updated_at on agent_pricing
CREATE TRIGGER update_agent_pricing_updated_at
  BEFORE UPDATE ON public.agent_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Update updated_at on pricing_rules
CREATE TRIGGER update_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Update updated_at on api_credentials
CREATE TRIGGER update_api_credentials_updated_at
  BEFORE UPDATE ON public.api_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Update updated_at on webhooks
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Update updated_at on system_settings
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 6: Enable Row Level Security (RLS)
-- =====================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: Create RLS Policies
-- =====================================================

-- Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Policies for agent_profiles
CREATE POLICY "Anyone can create agent profile" ON public.agent_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Approved agents can view their own profile" ON public.agent_profiles
  FOR SELECT USING (auth.uid() = user_id AND status = 'approved');

CREATE POLICY "Admins can view all agent profiles" ON public.agent_profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved agents can update their own non-markup fields" ON public.agent_profiles
  FOR UPDATE USING (
    auth.uid() = user_id AND 
    status = 'approved' AND 
    profile_markups_equal(id, markup_type, markup_value)
  ) WITH CHECK (
    auth.uid() = user_id AND 
    status = 'approved' AND 
    profile_markups_equal(id, markup_type, markup_value)
  );

CREATE POLICY "Agents cannot change wallet currency" ON public.agent_profiles
  FOR UPDATE USING (
    auth.uid() = user_id AND 
    status = 'approved' AND 
    wallet_currency = (SELECT wallet_currency FROM agent_profiles WHERE id = agent_profiles.id)
  ) WITH CHECK (
    auth.uid() = user_id AND 
    status = 'approved' AND 
    wallet_currency = (SELECT wallet_currency FROM agent_profiles WHERE id = agent_profiles.id)
  );

CREATE POLICY "Admins can update any agent profile" ON public.agent_profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Policies for device_brands
CREATE POLICY "Approved agents can view device brands" ON public.device_brands
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Admins can manage device brands" ON public.device_brands
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Policies for device_models
CREATE POLICY "Approved agents can view device models" ON public.device_models
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Admins can manage device models" ON public.device_models
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Policies for esim_plans
CREATE POLICY "Approved agents can view esim_plans" ON public.esim_plans
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Admins can view all esim_plans" ON public.esim_plans
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage eSIM plans" ON public.esim_plans
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage eSIM plans" ON public.esim_plans
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Policies for orders
CREATE POLICY "Approved agents can view their orders" ON public.orders
  FOR SELECT USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Approved agents can create their own orders" ON public.orders
  FOR INSERT WITH CHECK (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Approved agents can update their own orders" ON public.orders
  FOR UPDATE USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  )) WITH CHECK (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Service role can manage all orders" ON public.orders
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Policies for agent_pricing
CREATE POLICY "Approved agents can view their own pricing" ON public.agent_pricing
  FOR SELECT USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Admins can view all agent pricing" ON public.agent_pricing
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved agents can insert their own pricing" ON public.agent_pricing
  FOR INSERT WITH CHECK (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Approved agents can update their own pricing" ON public.agent_pricing
  FOR UPDATE USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  )) WITH CHECK (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Approved agents can delete their own pricing" ON public.agent_pricing
  FOR DELETE USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Admins can insert agent pricing" ON public.agent_pricing
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update agent pricing" ON public.agent_pricing
  FOR UPDATE USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete agent pricing" ON public.agent_pricing
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Policies for pricing_rules
CREATE POLICY "Admins or approved agents can view pricing rules" ON public.pricing_rules
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') OR 
    EXISTS (SELECT 1 FROM agent_profiles WHERE user_id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Service role can manage pricing rules" ON public.pricing_rules
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Policies for wallet_transactions
CREATE POLICY "Approved agents can view their own transactions" ON public.wallet_transactions
  FOR SELECT USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Service role can insert wallet transactions" ON public.wallet_transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can select wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (true);

CREATE POLICY "Deny unauthorized access to wallet transactions" ON public.wallet_transactions
  FOR ALL USING (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM agent_profiles WHERE user_id = auth.uid() AND status = 'approved') AND
    agent_id IN (SELECT id FROM agent_profiles WHERE user_id = auth.uid() AND status = 'approved')
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM agent_profiles WHERE user_id = auth.uid() AND status = 'approved')
  );

-- Policies for api_credentials
CREATE POLICY "Approved agents can view their own API credentials" ON public.api_credentials
  FOR SELECT USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Approved agents can insert their own API credentials" ON public.api_credentials
  FOR INSERT WITH CHECK (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Approved agents can update their own API credentials" ON public.api_credentials
  FOR UPDATE USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Approved agents can delete their own API credentials" ON public.api_credentials
  FOR DELETE USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Service role can manage API credentials" ON public.api_credentials
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Policies for api_usage_logs
CREATE POLICY "Approved agents can view their own API logs" ON public.api_usage_logs
  FOR SELECT USING (credential_id IN (
    SELECT c.id FROM api_credentials c
    JOIN agent_profiles p ON c.agent_id = p.id
    WHERE p.user_id = auth.uid() AND p.status = 'approved'
  ));

CREATE POLICY "Service role can insert API usage logs" ON public.api_usage_logs
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Service role can manage API usage logs" ON public.api_usage_logs
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Policies for webhooks
CREATE POLICY "Approved agents can view their own webhooks" ON public.webhooks
  FOR SELECT USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Approved agents can create their own webhooks" ON public.webhooks
  FOR INSERT WITH CHECK (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Approved agents can update their own webhooks" ON public.webhooks
  FOR UPDATE USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  )) WITH CHECK (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Approved agents can delete their own webhooks" ON public.webhooks
  FOR DELETE USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Service role can manage webhooks" ON public.webhooks
  FOR ALL USING (true) WITH CHECK (true);

-- Policies for webhook_logs
CREATE POLICY "Approved agents can view their webhook logs" ON public.webhook_logs
  FOR SELECT USING (webhook_id IN (
    SELECT w.id FROM webhooks w
    JOIN agent_profiles ap ON w.agent_id = ap.id
    WHERE ap.user_id = auth.uid() AND ap.status = 'approved'
  ));

CREATE POLICY "Service role can insert webhook logs" ON public.webhook_logs
  FOR INSERT WITH CHECK (true);

-- Policies for esim_topups
CREATE POLICY "Approved agents can view their own topups" ON public.esim_topups
  FOR SELECT USING (agent_id IN (
    SELECT id FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Service role can insert topups" ON public.esim_topups
  FOR INSERT WITH CHECK (true);

-- Policies for esim_status_events
CREATE POLICY "Approved agents can view their own eSIM status events" ON public.esim_status_events
  FOR SELECT USING (iccid IN (
    SELECT o.esim_iccid FROM orders o
    JOIN agent_profiles ap ON o.agent_id = ap.id
    WHERE ap.user_id = auth.uid() AND ap.status = 'approved'
  ));

CREATE POLICY "Service role can manage eSIM status events" ON public.esim_status_events
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Policies for exchange_rates
CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage exchange rates" ON public.exchange_rates
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

-- Policies for system_settings
CREATE POLICY "Approved agents can view system settings" ON public.system_settings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  ));

CREATE POLICY "Admins can manage system settings" ON public.system_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Policies for audit_logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- =====================================================
-- STEP 8: Create Indexes for Performance
-- =====================================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_agent_profiles_user_id ON public.agent_profiles(user_id);
CREATE INDEX idx_agent_profiles_status ON public.agent_profiles(status);
CREATE INDEX idx_device_models_brand_id ON public.device_models(brand_id);
CREATE INDEX idx_esim_plans_country_code ON public.esim_plans(country_code);
CREATE INDEX idx_esim_plans_is_active ON public.esim_plans(is_active);
CREATE INDEX idx_orders_agent_id ON public.orders(agent_id);
CREATE INDEX idx_orders_plan_id ON public.orders(plan_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_esim_iccid ON public.orders(esim_iccid);
CREATE INDEX idx_agent_pricing_agent_id ON public.agent_pricing(agent_id);
CREATE INDEX idx_agent_pricing_plan_id ON public.agent_pricing(plan_id);
CREATE INDEX idx_wallet_transactions_agent_id ON public.wallet_transactions(agent_id);
CREATE INDEX idx_api_credentials_agent_id ON public.api_credentials(agent_id);
CREATE INDEX idx_api_usage_logs_credential_id ON public.api_usage_logs(credential_id);
CREATE INDEX idx_webhooks_agent_id ON public.webhooks(agent_id);
CREATE INDEX idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX idx_esim_topups_agent_id ON public.esim_topups(agent_id);
CREATE INDEX idx_esim_topups_iccid ON public.esim_topups(iccid);
CREATE INDEX idx_esim_status_events_iccid ON public.esim_status_events(iccid);

-- =====================================================
-- Migration Complete!
-- =====================================================
-- Next steps:
-- 1. Copy this entire SQL script
-- 2. Go to your staging Supabase project SQL Editor
-- 3. Paste and run the script
-- 4. Verify all tables are created in the Table Editor
-- 5. Run the seed-staging.sql script for test data
-- 6. Configure Edge Function secrets
-- 7. Deploy Edge Functions
-- =====================================================
