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
    console.log('Starting eSIM plans sync...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get eSIM Access API credentials
    const accessCode = Deno.env.get('ESIMACCESS_ACCESS_CODE');
    const secretKey = Deno.env.get('ESIMACCESS_SECRET_KEY');

    if (!accessCode || !secretKey) {
      throw new Error('eSIM Access credentials not configured');
    }

    console.log('Fetching plans from eSIM Access API...');

    // Fetch data packages from eSIM Access API
    // Based on docs, this endpoint should list all available data packages
    const response = await fetch('https://api.esimaccess.com/api/v1/packages', {
      method: 'POST',
      headers: {
        'RT-AccessCode': accessCode,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Include any required parameters based on API docs
        // May need to filter by country or other criteria
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('eSIM Access API error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const apiData = await response.json();
    console.log('Received data from eSIM Access:', apiData);

    if (!apiData.success || !apiData.data) {
      throw new Error('Invalid API response format');
    }

    const plans = apiData.data;
    console.log(`Processing ${plans.length} plans...`);

    // Transform API data to match our esim_plans table structure
    const transformedPlans = plans.map((plan: any) => ({
      supplier_plan_id: plan.packageCode || plan.slug,
      title: plan.title || plan.packageName,
      country_name: plan.countryName,
      country_code: plan.countryCode,
      data_amount: plan.data, // e.g., "1GB", "5GB"
      validity_days: plan.days || plan.validityDays,
      wholesale_price: parseFloat(plan.price),
      currency: plan.currency || 'USD',
      description: plan.description || `${plan.data} data plan for ${plan.countryName}`,
      is_active: true
    }));

    console.log('Transformed plans:', transformedPlans.length);

    // Upsert plans to database
    const { data: upsertedPlans, error: upsertError } = await supabase
      .from('esim_plans')
      .upsert(transformedPlans, { 
        onConflict: 'supplier_plan_id',
        ignoreDuplicates: false 
      })
      .select();

    if (upsertError) {
      console.error('Database upsert error:', upsertError);
      throw upsertError;
    }

    console.log(`Successfully synced ${upsertedPlans?.length || 0} plans`);

    // Deactivate plans that are no longer available
    const activePlanIds = transformedPlans.map(p => p.supplier_plan_id);
    const { error: deactivateError } = await supabase
      .from('esim_plans')
      .update({ is_active: false })
      .not('supplier_plan_id', 'in', `(${activePlanIds.map(id => `"${id}"`).join(',')})`);

    if (deactivateError) {
      console.error('Error deactivating old plans:', deactivateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${upsertedPlans?.length || 0} eSIM plans`,
        synced_count: upsertedPlans?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Sync error:', error);
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