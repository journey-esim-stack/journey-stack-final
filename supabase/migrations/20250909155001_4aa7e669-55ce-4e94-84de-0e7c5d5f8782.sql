-- Add yourself as admin (replace YOUR_USER_ID with your actual user ID from auth.users)
-- You can find your user ID in Supabase dashboard under Authentication > Users
INSERT INTO public.user_roles (user_id, role) 
VALUES (
  (SELECT id FROM auth.users WHERE email = 'your-email@example.com'),
  'admin'::app_role
) ON CONFLICT (user_id, role) DO NOTHING;