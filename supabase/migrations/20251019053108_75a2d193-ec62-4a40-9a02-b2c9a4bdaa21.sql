-- Create partner_type enum
CREATE TYPE public.partner_type AS ENUM ('agent', 'api_partner');

-- Add partner_type column to agent_profiles with default value
ALTER TABLE public.agent_profiles 
ADD COLUMN partner_type public.partner_type NOT NULL DEFAULT 'agent';

-- Add index for filtering by partner type
CREATE INDEX idx_agent_profiles_partner_type ON public.agent_profiles(partner_type);

-- Update handle_new_user trigger function to support partner_type and set appropriate markup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  company_name_val TEXT;
  contact_person_val TEXT;
  phone_val TEXT;
  country_val TEXT;
  partner_type_val TEXT;
BEGIN
  -- Extract data from user metadata
  company_name_val := NEW.raw_user_meta_data ->> 'company_name';
  contact_person_val := NEW.raw_user_meta_data ->> 'contact_person';
  phone_val := NEW.raw_user_meta_data ->> 'phone';
  country_val := NEW.raw_user_meta_data ->> 'country';
  partner_type_val := COALESCE(NEW.raw_user_meta_data ->> 'partner_type', 'agent');
  
  -- Only create profile if we have the required data
  IF company_name_val IS NOT NULL AND contact_person_val IS NOT NULL THEN
    INSERT INTO public.agent_profiles (
      user_id, 
      company_name, 
      contact_person, 
      phone, 
      country,
      partner_type,
      markup_value
    )
    VALUES (
      NEW.id, 
      company_name_val, 
      contact_person_val, 
      COALESCE(phone_val, ''), 
      COALESCE(country_val, ''),
      partner_type_val::partner_type,
      CASE WHEN partner_type_val = 'api_partner' THEN 30 ELSE 300 END
    );
  END IF;
  
  RETURN NEW;
END;
$$;