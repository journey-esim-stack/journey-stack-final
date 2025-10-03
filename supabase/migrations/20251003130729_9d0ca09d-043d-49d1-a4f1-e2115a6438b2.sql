-- Add unique constraint to support upsert and prevent duplicates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'agent_pricing_unique'
  ) THEN
    ALTER TABLE public.agent_pricing
    ADD CONSTRAINT agent_pricing_unique UNIQUE (agent_id, plan_id);
  END IF;
END $$;

-- Admin RLS policies to allow managing agent pricing
-- INSERT policy for admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'agent_pricing' 
      AND policyname = 'Admins can insert agent pricing'
  ) THEN
    CREATE POLICY "Admins can insert agent pricing"
    ON public.agent_pricing
    FOR INSERT
    TO authenticated
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- UPDATE policy for admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'agent_pricing' 
      AND policyname = 'Admins can update agent pricing'
  ) THEN
    CREATE POLICY "Admins can update agent pricing"
    ON public.agent_pricing
    FOR UPDATE
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- DELETE policy for admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'agent_pricing' 
      AND policyname = 'Admins can delete agent pricing'
  ) THEN
    CREATE POLICY "Admins can delete agent pricing"
    ON public.agent_pricing
    FOR DELETE
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;