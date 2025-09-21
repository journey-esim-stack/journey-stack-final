-- Create storage bucket for QR codes
INSERT INTO storage.buckets (id, name, public) VALUES ('qr-codes', 'qr-codes', true);

-- Create RLS policies for QR codes bucket
CREATE POLICY "QR codes are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'qr-codes');

CREATE POLICY "Authenticated users can upload QR codes" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'qr-codes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own QR codes" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'qr-codes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own QR codes" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'qr-codes' AND auth.uid() IS NOT NULL);