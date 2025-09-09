-- Seed sample eSIM plans only if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.esim_plans) THEN
    INSERT INTO public.esim_plans 
      (title, description, country_name, country_code, data_amount, validity_days, wholesale_price, currency, supplier_plan_id, is_active)
    VALUES
      ('Singapore 5GB / 7 Days', 'High-speed eSIM for travel in Singapore', 'Singapore', 'SG', '5 GB', 7, 4.50, 'USD', 'SG-5GB-7D', true),
      ('Singapore 10GB / 15 Days', 'Extended data pack for Singapore', 'Singapore', 'SG', '10 GB', 15, 7.90, 'USD', 'SG-10GB-15D', true),
      ('Malaysia 5GB / 7 Days', 'Coverage across Malaysia', 'Malaysia', 'MY', '5 GB', 7, 4.00, 'USD', 'MY-5GB-7D', true),
      ('Thailand 10GB / 15 Days', 'Perfect for extended trips in Thailand', 'Thailand', 'TH', '10 GB', 15, 7.50, 'USD', 'TH-10GB-15D', true),
      ('Indonesia 3GB / 7 Days', 'Affordable option for Indonesia', 'Indonesia', 'ID', '3 GB', 7, 3.20, 'USD', 'ID-3GB-7D', true);
  END IF;
END $$;