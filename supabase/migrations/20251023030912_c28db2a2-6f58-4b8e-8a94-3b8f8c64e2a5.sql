-- Update handle_new_user function to set wallet_currency based on country
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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