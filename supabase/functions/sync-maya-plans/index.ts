import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MayaPlan {
  product_id: string;
  title: string;
  description?: string;
  country_code: string;
  country_name: string;
  data_amount: string;
  validity_days: number;
  price: number;
  currency: string;
  active: boolean;
}

interface MayaResponse {
  success: boolean;
  data: MayaPlan[];
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Maya plans sync...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Maya API credentials
    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL');

    if (!mayaApiKey || !mayaApiSecret || !mayaApiUrl) {
      throw new Error('Maya API credentials not configured');
    }

    console.log('Maya credentials configured: true');
    console.log('Fetching data from Maya API...');

    // Fetch plans from Maya API - using API key and secret
    const response = await fetch(`${mayaApiUrl}/plans`, {
      method: 'GET',
      headers: {
        'X-API-Key': mayaApiKey,
        'X-API-Secret': mayaApiSecret,
        'Content-Type': 'application/json',
      },
    });

    console.log('Maya API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Maya API non-OK response:', response.status, response.statusText, 'Body:', errorText?.slice(0, 500));
      throw new Error(`Maya API error: ${response.status} ${response.statusText} - ${errorText?.slice(0, 200)}`);
    }

    let apiData: MayaResponse;
    try {
      apiData = await response.json();
    } catch (parseErr) {
      const rawText = await response.text().catch(() => '');
      console.error('Failed to parse Maya API JSON. Raw body:', rawText?.slice(0, 500));
      throw new Error('Invalid JSON returned by Maya API');
    }
    console.log('Received data from Maya:', apiData.success ? 'Success' : 'Failed');

    if (!apiData.success || !apiData.data) {
      throw new Error(`Maya API returned error: ${apiData.message || 'Unknown error'}`);
    }

    console.log(`Processing ${apiData.data.length} Maya plans...`);

    // Transform Maya plans to our database format
    const transformedPlans = apiData.data
      .filter(plan => plan.active)
      .map(plan => ({
        supplier_plan_id: `maya_${plan.product_id}`,
        supplier_name: 'maya',
        title: plan.title,
        description: plan.description || '',
        country_code: plan.country_code.toUpperCase(),
        country_name: plan.country_name,
        data_amount: plan.data_amount,
        validity_days: plan.validity_days,
        wholesale_price: plan.price,
        currency: plan.currency || 'USD',
        is_active: true,
        admin_only: false
      }));

    console.log('Transformed Maya plans:', transformedPlans.length);

    if (transformedPlans.length === 0) {
      console.log('No active plans found from Maya');
      return new Response(
        JSON.stringify({ success: true, message: 'No active Maya plans to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert plans to database
    const { error: upsertError } = await supabase
      .from('esim_plans')
      .upsert(transformedPlans, { 
        onConflict: 'supplier_plan_id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      throw new Error(`Database upsert error: ${upsertError.message}`);
    }

    console.log(`Successfully synced ${transformedPlans.length} Maya plans`);

    // Get all current Maya plan IDs from API
    const currentMayaPlanIds = transformedPlans.map(plan => plan.supplier_plan_id);

    // Deactivate plans that are no longer in the API response
    try {
      const { error: deactivateError } = await supabase
        .from('esim_plans')
        .update({ is_active: false })
        .eq('supplier_name', 'maya')
        .not('supplier_plan_id', 'in', `(${currentMayaPlanIds.map(id => `"${id}"`).join(',')})`);

      if (deactivateError) {
        console.error('Error deactivating old Maya plans:', deactivateError);
      } else {
        console.log('Successfully deactivated old Maya plans');
      }
    } catch (deactivateErr) {
      console.error('Error deactivating old Maya plans:', deactivateErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully synced ${transformedPlans.length} Maya plans`,
        synced_count: transformedPlans.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Maya sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});