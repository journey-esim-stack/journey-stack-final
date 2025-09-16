-- Create device brands table
CREATE TABLE public.device_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create device models table  
CREATE TABLE public.device_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.device_brands(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  is_esim_compatible BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(brand_id, model_name)
);

-- Add device compatibility fields to orders table
ALTER TABLE public.orders 
ADD COLUMN device_brand_id UUID REFERENCES public.device_brands(id),
ADD COLUMN device_model_id UUID REFERENCES public.device_models(id),
ADD COLUMN compatibility_checked BOOLEAN DEFAULT false,
ADD COLUMN compatibility_warning_shown BOOLEAN DEFAULT false;

-- Enable RLS on both tables
ALTER TABLE public.device_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_models ENABLE ROW LEVEL SECURITY;

-- Create policies for device brands
CREATE POLICY "Approved agents can view device brands" 
ON public.device_brands 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM agent_profiles 
  WHERE agent_profiles.user_id = auth.uid() 
  AND agent_profiles.status = 'approved'::agent_status
));

CREATE POLICY "Admins can manage device brands" 
ON public.device_brands 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for device models
CREATE POLICY "Approved agents can view device models" 
ON public.device_models 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM agent_profiles 
  WHERE agent_profiles.user_id = auth.uid() 
  AND agent_profiles.status = 'approved'::agent_status
));

CREATE POLICY "Admins can manage device models" 
ON public.device_models 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_device_models_brand_id ON public.device_models(brand_id);
CREATE INDEX idx_device_models_compatible ON public.device_models(is_esim_compatible);
CREATE INDEX idx_orders_device_brand ON public.orders(device_brand_id);
CREATE INDEX idx_orders_device_model ON public.orders(device_model_id);

-- Seed device brands and models based on compatibility data
INSERT INTO public.device_brands (brand_name) VALUES 
('Apple'), ('Samsung'), ('Google'), ('Motorola'), ('Nokia'), 
('OnePlus'), ('Oppo'), ('Honor'), ('Huawei'), ('Hammer');

-- Seed Apple devices
INSERT INTO public.device_models (brand_id, model_name, is_esim_compatible, notes)
SELECT b.id, model_name, true, notes
FROM public.device_brands b,
(VALUES
  ('iPhone 16', 'Latest iPhone model'),
  ('iPhone 16 Plus', 'Latest iPhone Plus model'), 
  ('iPhone 16 Pro', 'Latest iPhone Pro model'),
  ('iPhone 16 Pro Max', 'Latest iPhone Pro Max model'),
  ('iPhone 15', '2023 iPhone model'),
  ('iPhone 15 Plus', '2023 iPhone Plus model'),
  ('iPhone 15 Pro', '2023 iPhone Pro model'),
  ('iPhone 15 Pro Max', '2023 iPhone Pro Max model'),
  ('iPhone 14', '2022 iPhone model'),
  ('iPhone 14 Plus', '2022 iPhone Plus model'),
  ('iPhone 14 Pro', '2022 iPhone Pro model'),
  ('iPhone 14 Pro Max', '2022 iPhone Pro Max model'),
  ('iPhone 13', '2021 iPhone model'),
  ('iPhone 13 Mini', '2021 iPhone Mini model'),
  ('iPhone 13 Pro', '2021 iPhone Pro model'),
  ('iPhone 13 Pro Max', '2021 iPhone Pro Max model'),
  ('iPhone 12', '2020 iPhone model'),
  ('iPhone 12 Mini', '2020 iPhone Mini model'),
  ('iPhone 12 Pro', '2020 iPhone Pro model'),
  ('iPhone 12 Pro Max', '2020 iPhone Pro Max model'),
  ('iPhone 11', '2019 iPhone model'),
  ('iPhone 11 Pro', '2019 iPhone Pro model'),
  ('iPhone 11 Pro Max', '2019 iPhone Pro Max model'),
  ('iPhone XS', '2018 iPhone model'),
  ('iPhone XS Max', '2018 iPhone Max model'),
  ('iPhone XR', '2018 iPhone XR model'),
  ('iPhone SE (2020)', '2020 iPhone SE model'),
  ('iPhone SE (2022)', '2022 iPhone SE model'),
  ('iPad (7th generation)', '2019 iPad model'),
  ('iPad (8th generation)', '2020 iPad model'),
  ('iPad (9th generation)', '2021 iPad model'),
  ('iPad (10th generation)', '2022 iPad model'),
  ('iPad Air (3rd generation)', '2019 iPad Air model'),
  ('iPad Air (4th generation)', '2020 iPad Air model'),
  ('iPad Air (5th generation)', '2022 iPad Air model'),
  ('iPad Pro 11-inch (1st generation)', '2018 iPad Pro 11-inch'),
  ('iPad Pro 11-inch (2nd generation)', '2020 iPad Pro 11-inch'),
  ('iPad Pro 11-inch (3rd generation)', '2021 iPad Pro 11-inch'),
  ('iPad Pro 11-inch (4th generation)', '2022 iPad Pro 11-inch'),
  ('iPad Pro 12.9-inch (3rd generation)', '2018 iPad Pro 12.9-inch'),
  ('iPad Pro 12.9-inch (4th generation)', '2020 iPad Pro 12.9-inch'),
  ('iPad Pro 12.9-inch (5th generation)', '2021 iPad Pro 12.9-inch'),
  ('iPad Pro 12.9-inch (6th generation)', '2022 iPad Pro 12.9-inch'),
  ('iPad Mini (5th generation)', '2019 iPad Mini'),
  ('iPad Mini (6th generation)', '2021 iPad Mini')
) AS models(model_name, notes)
WHERE b.brand_name = 'Apple';

-- Seed Samsung devices
INSERT INTO public.device_models (brand_id, model_name, is_esim_compatible, notes)
SELECT b.id, model_name, true, notes
FROM public.device_brands b,
(VALUES
  ('Galaxy S25', 'Latest Galaxy S model'),
  ('Galaxy S25+', 'Latest Galaxy S Plus model'),
  ('Galaxy S25 Ultra', 'Latest Galaxy S Ultra model'),
  ('Galaxy S24', '2024 Galaxy S model'),
  ('Galaxy S24+', '2024 Galaxy S Plus model'),
  ('Galaxy S24 Ultra', '2024 Galaxy S Ultra model'),
  ('Galaxy S24 FE', '2024 Galaxy S FE model'),
  ('Galaxy S23', '2023 Galaxy S model'),
  ('Galaxy S23+', '2023 Galaxy S Plus model'),
  ('Galaxy S23 Ultra', '2023 Galaxy S Ultra model'),
  ('Galaxy S23 FE', '2023 Galaxy S FE model'),
  ('Galaxy S22 5G', '2022 Galaxy S model'),
  ('Galaxy S22+ 5G', '2022 Galaxy S Plus model'),
  ('Galaxy S22 Ultra 5G', '2022 Galaxy S Ultra model'),
  ('Galaxy S21 5G', '2021 Galaxy S model'),
  ('Galaxy S21+ 5G', '2021 Galaxy S Plus model'),
  ('Galaxy S21 Ultra 5G', '2021 Galaxy S Ultra model'),
  ('Galaxy S20', '2020 Galaxy S model'),
  ('Galaxy S20 5G', '2020 Galaxy S 5G model'),
  ('Galaxy S20+', '2020 Galaxy S Plus model'),
  ('Galaxy S20+ 5G', '2020 Galaxy S Plus 5G model'),
  ('Galaxy S20 Ultra', '2020 Galaxy S Ultra model'),
  ('Galaxy S20 Ultra 5G', '2020 Galaxy S Ultra 5G model'),
  ('Galaxy Note 20', '2020 Galaxy Note model'),
  ('Galaxy Note 20 5G', '2020 Galaxy Note 5G model'),
  ('Galaxy Note 20 Ultra', '2020 Galaxy Note Ultra model'),
  ('Galaxy Note 20 Ultra 5G', '2020 Galaxy Note Ultra 5G model'),
  ('Galaxy Z Flip', 'Galaxy Z Flip foldable'),
  ('Galaxy Z Flip 5G', 'Galaxy Z Flip 5G foldable'),
  ('Galaxy Z Flip 3 5G', 'Galaxy Z Flip 3 5G foldable'),
  ('Galaxy Z Flip 4', 'Galaxy Z Flip 4 foldable'),
  ('Galaxy Z Flip 5', 'Galaxy Z Flip 5 foldable'),
  ('Galaxy Z Flip6', 'Galaxy Z Flip 6 foldable'),
  ('Galaxy Z Fold', 'Galaxy Z Fold foldable'),
  ('Galaxy Z Fold 2 5G', 'Galaxy Z Fold 2 5G foldable'),
  ('Galaxy Z Fold 3', 'Galaxy Z Fold 3 foldable'),
  ('Galaxy Z Fold 4', 'Galaxy Z Fold 4 foldable'),
  ('Galaxy Z Fold 5', 'Galaxy Z Fold 5 foldable'),
  ('Galaxy Z Fold 6', 'Galaxy Z Fold 6 foldable'),
  ('Galaxy A55 5G', 'Galaxy A55 5G model'),
  ('Galaxy A54 5G', 'Galaxy A54 5G model'),
  ('Galaxy A35 5G', 'Galaxy A35 5G model')
) AS models(model_name, notes)
WHERE b.brand_name = 'Samsung';

-- Seed Google Pixel devices
INSERT INTO public.device_models (brand_id, model_name, is_esim_compatible, notes)
SELECT b.id, model_name, true, notes
FROM public.device_brands b,
(VALUES
  ('Pixel 9', 'Latest Pixel model'),
  ('Pixel 9 Pro', 'Latest Pixel Pro model'),
  ('Pixel 9 Pro XL', 'Latest Pixel Pro XL model'),
  ('Pixel 9 Pro Fold', 'Latest Pixel foldable'),
  ('Pixel 8', '2023 Pixel model'),
  ('Pixel 8a', '2023 Pixel a model'),
  ('Pixel 8 Pro', '2023 Pixel Pro model'),
  ('Pixel 7', '2022 Pixel model'),
  ('Pixel 7a', '2022 Pixel a model'),
  ('Pixel 7 Pro', '2022 Pixel Pro model'),
  ('Pixel 6', '2021 Pixel model'),
  ('Pixel 6a', '2021 Pixel a model'),
  ('Pixel 6 Pro', '2021 Pixel Pro model'),
  ('Pixel 5', '2020 Pixel model'),
  ('Pixel 5a', '2020 Pixel a model'),
  ('Pixel 5a 5G', '2020 Pixel a 5G model'),
  ('Pixel 4', '2019 Pixel model'),
  ('Pixel 4a', '2019 Pixel a model'),
  ('Pixel 4a 5G', '2019 Pixel a 5G model'),
  ('Pixel 4 XL', '2019 Pixel XL model'),
  ('Pixel 3', '2018 Pixel model'),
  ('Pixel 3a', '2018 Pixel a model'),
  ('Pixel 3 XL', '2018 Pixel XL model'),
  ('Pixel 3a XL', '2018 Pixel a XL model'),
  ('Pixel Fold', 'Pixel foldable device')
) AS models(model_name, notes)
WHERE b.brand_name = 'Google';

-- Create system setting for compatibility checking
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on system settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for system settings
CREATE POLICY "Admins can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved agents can view system settings" 
ON public.system_settings 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM agent_profiles 
  WHERE agent_profiles.user_id = auth.uid() 
  AND agent_profiles.status = 'approved'::agent_status
));

-- Insert default setting for device compatibility checking
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
('device_compatibility_mode', 'warn', 'Controls device compatibility checking: warn, block, or disabled');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_device_brands_updated_at
BEFORE UPDATE ON public.device_brands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_device_models_updated_at  
BEFORE UPDATE ON public.device_models
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();