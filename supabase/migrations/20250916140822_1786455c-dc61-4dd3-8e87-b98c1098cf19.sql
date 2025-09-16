-- Add missing device models for OnePlus
INSERT INTO public.device_models (brand_id, model_name, is_esim_compatible, notes)
SELECT b.id, model_name, is_esim_compatible, notes
FROM public.device_brands b,
(VALUES
  ('OnePlus 12', true, 'Latest OnePlus flagship'),
  ('OnePlus 12R', true, 'OnePlus 12R model'),
  ('OnePlus 11', true, 'OnePlus 11 flagship'),
  ('OnePlus 11R', true, 'OnePlus 11R model'),
  ('OnePlus 10 Pro', true, 'OnePlus 10 Pro flagship'),
  ('OnePlus 10T', true, 'OnePlus 10T model'),
  ('OnePlus 9', true, 'OnePlus 9 flagship'),
  ('OnePlus 9 Pro', true, 'OnePlus 9 Pro flagship'),
  ('OnePlus 9RT', true, 'OnePlus 9RT model'),
  ('OnePlus 8', true, 'OnePlus 8 model'),
  ('OnePlus 8 Pro', true, 'OnePlus 8 Pro model'),
  ('OnePlus 8T', true, 'OnePlus 8T model'),
  ('OnePlus Nord 3', true, 'OnePlus Nord 3 model'),
  ('OnePlus Nord 2T', true, 'OnePlus Nord 2T model'),
  ('OnePlus Nord CE 3', true, 'OnePlus Nord CE 3 model'),
  ('OnePlus Open', true, 'OnePlus foldable device')
) AS models(model_name, is_esim_compatible, notes)
WHERE b.brand_name = 'OnePlus';

-- Add missing device models for Oppo
INSERT INTO public.device_models (brand_id, model_name, is_esim_compatible, notes)
SELECT b.id, model_name, is_esim_compatible, notes
FROM public.device_brands b,
(VALUES
  ('Find X7', true, 'Oppo Find X7 flagship'),
  ('Find X7 Ultra', true, 'Oppo Find X7 Ultra flagship'),
  ('Find X6', true, 'Oppo Find X6 flagship'),
  ('Find X6 Pro', true, 'Oppo Find X6 Pro flagship'),
  ('Find X5', true, 'Oppo Find X5 flagship'),
  ('Find X5 Pro', true, 'Oppo Find X5 Pro flagship'),
  ('Find X5 Lite', true, 'Oppo Find X5 Lite model'),
  ('Find X3 Pro', true, 'Oppo Find X3 Pro flagship'),
  ('Find X3 Neo', true, 'Oppo Find X3 Neo model'),
  ('Find X3 Lite', true, 'Oppo Find X3 Lite model'),
  ('Reno 11', true, 'Oppo Reno 11 model'),
  ('Reno 11 Pro', true, 'Oppo Reno 11 Pro model'),
  ('Reno 10', true, 'Oppo Reno 10 model'),
  ('Reno 10 Pro', true, 'Oppo Reno 10 Pro model'),
  ('Reno 9', true, 'Oppo Reno 9 model'),
  ('Reno 8', true, 'Oppo Reno 8 model'),
  ('Reno 8 Pro', true, 'Oppo Reno 8 Pro model')
) AS models(model_name, is_esim_compatible, notes)
WHERE b.brand_name = 'Oppo';

-- Add missing device models for Nokia
INSERT INTO public.device_models (brand_id, model_name, is_esim_compatible, notes)
SELECT b.id, model_name, is_esim_compatible, notes
FROM public.device_brands b,
(VALUES
  ('Nokia XR21', true, 'Nokia XR21 rugged phone'),
  ('Nokia X30 5G', true, 'Nokia X30 5G model'),
  ('Nokia G60 5G', true, 'Nokia G60 5G model'),
  ('Nokia G50', false, 'Nokia G50 model'),
  ('Nokia X20', false, 'Nokia X20 model'),
  ('Nokia X10', false, 'Nokia X10 model'),
  ('Nokia 8.3 5G', false, 'Nokia 8.3 5G model'),
  ('Nokia 7.2', false, 'Nokia 7.2 model'),
  ('Nokia 6.2', false, 'Nokia 6.2 model'),
  ('Nokia 5.4', false, 'Nokia 5.4 model'),
  ('Nokia 3.4', false, 'Nokia 3.4 model'),
  ('Nokia 2.4', false, 'Nokia 2.4 model')
) AS models(model_name, is_esim_compatible, notes)
WHERE b.brand_name = 'Nokia';

-- Add missing device models for Motorola
INSERT INTO public.device_models (brand_id, model_name, is_esim_compatible, notes)
SELECT b.id, model_name, is_esim_compatible, notes
FROM public.device_brands b,
(VALUES
  ('Razr 50', true, 'Motorola Razr 50 foldable'),
  ('Razr 50 Ultra', true, 'Motorola Razr 50 Ultra foldable'),
  ('Razr 40', true, 'Motorola Razr 40 foldable'),
  ('Razr 40 Ultra', true, 'Motorola Razr 40 Ultra foldable'),
  ('Edge 50 Pro', true, 'Motorola Edge 50 Pro'),
  ('Edge 50 Fusion', true, 'Motorola Edge 50 Fusion'),
  ('Edge 50 Ultra', true, 'Motorola Edge 50 Ultra'),
  ('Edge 40', true, 'Motorola Edge 40'),
  ('Edge 40 Pro', true, 'Motorola Edge 40 Pro'),
  ('Edge 40 Neo', true, 'Motorola Edge 40 Neo'),
  ('Edge 30', true, 'Motorola Edge 30'),
  ('Edge 30 Pro', true, 'Motorola Edge 30 Pro'),
  ('Edge 30 Ultra', true, 'Motorola Edge 30 Ultra'),
  ('Edge 20', true, 'Motorola Edge 20'),
  ('Edge 20 Pro', true, 'Motorola Edge 20 Pro'),
  ('Razr (2022)', true, 'Motorola Razr 2022 foldable'),
  ('Razr (2023)', true, 'Motorola Razr 2023 foldable')
) AS models(model_name, is_esim_compatible, notes)
WHERE b.brand_name = 'Motorola';

-- Add missing device models for Honor
INSERT INTO public.device_models (brand_id, model_name, is_esim_compatible, notes)
SELECT b.id, model_name, is_esim_compatible, notes
FROM public.device_brands b,
(VALUES
  ('Magic6 Pro', true, 'Honor Magic6 Pro flagship'),
  ('Magic6', true, 'Honor Magic6 flagship'),
  ('Magic5 Pro', true, 'Honor Magic5 Pro flagship'),
  ('Magic5', true, 'Honor Magic5 flagship'),
  ('Magic4 Pro', true, 'Honor Magic4 Pro flagship'),
  ('Magic4', true, 'Honor Magic4 flagship'),
  ('Magic V2', true, 'Honor Magic V2 foldable'),
  ('Magic Vs', true, 'Honor Magic Vs foldable'),
  ('90 Pro', true, 'Honor 90 Pro model'),
  ('90', true, 'Honor 90 model'),
  ('80 Pro', true, 'Honor 80 Pro model'),
  ('80', true, 'Honor 80 model'),
  ('70 Pro', true, 'Honor 70 Pro model'),
  ('70', true, 'Honor 70 model'),
  ('50 Pro', true, 'Honor 50 Pro model'),
  ('50', true, 'Honor 50 model')
) AS models(model_name, is_esim_compatible, notes)
WHERE b.brand_name = 'Honor';

-- Add missing device models for Huawei
INSERT INTO public.device_models (brand_id, model_name, is_esim_compatible, notes)
SELECT b.id, model_name, is_esim_compatible, notes
FROM public.device_brands b,
(VALUES
  ('Pura 70 Ultra', true, 'Huawei Pura 70 Ultra flagship'),
  ('Pura 70 Pro', true, 'Huawei Pura 70 Pro flagship'),
  ('Pura 70', true, 'Huawei Pura 70 flagship'),
  ('P60 Pro', true, 'Huawei P60 Pro flagship'),
  ('P60', true, 'Huawei P60 flagship'),
  ('P50 Pro', true, 'Huawei P50 Pro flagship'),
  ('P50', true, 'Huawei P50 flagship'),
  ('P40 Pro', true, 'Huawei P40 Pro flagship'),
  ('P40', true, 'Huawei P40 flagship'),
  ('Mate 60 Pro', true, 'Huawei Mate 60 Pro flagship'),
  ('Mate 60', true, 'Huawei Mate 60 flagship'),
  ('Mate 50 Pro', true, 'Huawei Mate 50 Pro flagship'),
  ('Mate 50', true, 'Huawei Mate 50 flagship'),
  ('Mate 40 Pro', true, 'Huawei Mate 40 Pro flagship'),
  ('Mate 40', true, 'Huawei Mate 40 flagship'),
  ('Mate X5', true, 'Huawei Mate X5 foldable'),
  ('Mate X3', true, 'Huawei Mate X3 foldable'),
  ('Nova 12', true, 'Huawei Nova 12 model'),
  ('Nova 11', true, 'Huawei Nova 11 model'),
  ('Nova 10', true, 'Huawei Nova 10 model')
) AS models(model_name, is_esim_compatible, notes)
WHERE b.brand_name = 'Huawei';

-- Add missing device models for Hammer (rugged phones)
INSERT INTO public.device_models (brand_id, model_name, is_esim_compatible, notes)
SELECT b.id, model_name, is_esim_compatible, notes
FROM public.device_brands b,
(VALUES
  ('Hammer Blade 5G', true, 'Hammer Blade 5G rugged phone'),
  ('Hammer Energy 18x9', false, 'Hammer Energy 18x9 rugged phone'),
  ('Hammer Explorer Pro', false, 'Hammer Explorer Pro rugged phone'),
  ('Hammer Iron 5', false, 'Hammer Iron 5 rugged phone'),
  ('Hammer Blade 3', false, 'Hammer Blade 3 rugged phone'),
  ('Hammer Energy 2', false, 'Hammer Energy 2 rugged phone'),
  ('Hammer Explorer', false, 'Hammer Explorer rugged phone')
) AS models(model_name, is_esim_compatible, notes)
WHERE b.brand_name = 'Hammer';