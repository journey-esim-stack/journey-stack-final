import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting comprehensive eSIM plans sync...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      esim_access: { synced: 0, error: null },
      maya: { synced: 0, error: null }
    };

    // Sync eSIM Access plans
    try {
      console.log('Syncing eSIM Access plans...');
      const esimResponse = await supabase.functions.invoke('sync-esim-plans');
      
      if (esimResponse.error) {
        throw new Error(esimResponse.error.message);
      }
      
      results.esim_access.synced = esimResponse.data?.synced_count || 0;
      console.log(`eSIM Access sync completed: ${results.esim_access.synced} plans`);
    } catch (error) {
      console.error('eSIM Access sync failed:', error);
      results.esim_access.error = error.message;
    }

    // Sync Maya plans
    try {
      console.log('Syncing Maya plans...');
      const mayaResponse = await supabase.functions.invoke('sync-maya-plans');
      
      if (mayaResponse.error) {
        throw new Error(mayaResponse.error.message);
      }
      
      results.maya.synced = mayaResponse.data?.synced_count || 0;
      console.log(`Maya sync completed: ${results.maya.synced} plans`);
    } catch (error) {
      console.error('Maya sync failed:', error);
      results.maya.error = error.message;
    }

    // Get final count
    const { data: finalCount } = await supabase
      .from('esim_plans')
      .select('supplier_name', { count: 'exact' })
      .eq('is_active', true);

    const totalSynced = results.esim_access.synced + results.maya.synced;
    const hasErrors = results.esim_access.error || results.maya.error;

    return new Response(
      JSON.stringify({
        success: !hasErrors,
        message: hasErrors 
          ? 'Sync completed with some errors' 
          : `Successfully synced all plans: ${totalSynced} total`,
        results,
        total_active_plans: finalCount?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: hasErrors ? 207 : 200
      }
    );

  } catch (error) {
    console.error('Overall sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});