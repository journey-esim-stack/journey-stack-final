-- Add fields for Maya-specific activation data
ALTER TABLE public.orders 
ADD COLUMN manual_code text,
ADD COLUMN smdp_address text;