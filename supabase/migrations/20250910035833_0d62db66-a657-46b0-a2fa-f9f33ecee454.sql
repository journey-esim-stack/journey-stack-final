-- Update RLS policy to allow everyone to view eSIM plans (for testing)
DROP POLICY IF EXISTS "Approved agents can view eSIM plans" ON public.esim_plans;
DROP POLICY IF EXISTS "Admins can view all eSIM plans" ON public.esim_plans;

-- Create a more permissive policy for now
CREATE POLICY "Allow authenticated users to view eSIM plans" 
ON public.esim_plans 
FOR SELECT 
USING (auth.uid() IS NOT NULL);