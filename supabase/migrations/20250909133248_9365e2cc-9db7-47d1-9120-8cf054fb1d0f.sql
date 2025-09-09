-- Create enum types
CREATE TYPE public.agent_status AS ENUM ('pending', 'approved', 'suspended');
CREATE TYPE public.order_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE public.transaction_type AS ENUM ('deposit', 'purchase', 'refund');

-- Create agent profiles table
CREATE TABLE public.agent_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL,
  business_license TEXT,
  status agent_status NOT NULL DEFAULT 'pending',
  wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create eSIM plans table (cached from supplier API)
CREATE TABLE public.esim_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_plan_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  data_amount TEXT NOT NULL,
  validity_days INTEGER NOT NULL,
  wholesale_price DECIMAL(8,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agent pricing table (custom retail prices per agent)
CREATE TABLE public.agent_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.esim_plans(id) ON DELETE CASCADE,
  retail_price DECIMAL(8,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id, plan_id)
);

-- Create wallet transactions table
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.esim_plans(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  retail_price DECIMAL(8,2) NOT NULL,
  wholesale_price DECIMAL(8,2) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  esim_iccid TEXT,
  esim_qr_code TEXT,
  activation_code TEXT,
  supplier_order_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agent_profiles
CREATE POLICY "Agents can view their own profile" 
ON public.agent_profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Agents can update their own profile" 
ON public.agent_profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can create agent profile" 
ON public.agent_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for eSIM plans (read-only for agents)
CREATE POLICY "Approved agents can view eSIM plans" 
ON public.esim_plans 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.agent_profiles 
    WHERE user_id = auth.uid() AND status = 'approved'
  )
);

-- Create RLS policies for agent pricing
CREATE POLICY "Agents can manage their own pricing" 
ON public.agent_pricing 
FOR ALL 
USING (
  agent_id IN (
    SELECT id FROM public.agent_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Create RLS policies for wallet transactions
CREATE POLICY "Agents can view their own transactions" 
ON public.wallet_transactions 
FOR SELECT 
USING (
  agent_id IN (
    SELECT id FROM public.agent_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Create RLS policies for orders
CREATE POLICY "Agents can manage their own orders" 
ON public.orders 
FOR ALL 
USING (
  agent_id IN (
    SELECT id FROM public.agent_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_agent_profiles_updated_at
  BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_esim_plans_updated_at
  BEFORE UPDATE ON public.esim_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_pricing_updated_at
  BEFORE UPDATE ON public.agent_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  company_name_val TEXT;
  contact_person_val TEXT;
  phone_val TEXT;
  country_val TEXT;
BEGIN
  -- Extract data from user metadata
  company_name_val := NEW.raw_user_meta_data ->> 'company_name';
  contact_person_val := NEW.raw_user_meta_data ->> 'contact_person';
  phone_val := NEW.raw_user_meta_data ->> 'phone';
  country_val := NEW.raw_user_meta_data ->> 'country';
  
  -- Only create profile if we have the required data
  IF company_name_val IS NOT NULL AND contact_person_val IS NOT NULL THEN
    INSERT INTO public.agent_profiles (
      user_id, 
      company_name, 
      contact_person, 
      phone, 
      country
    )
    VALUES (
      NEW.id, 
      company_name_val, 
      contact_person_val, 
      COALESCE(phone_val, ''), 
      COALESCE(country_val, '')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();