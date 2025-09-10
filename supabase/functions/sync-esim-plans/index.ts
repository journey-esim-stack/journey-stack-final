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

    console.log('AccessCode length:', accessCode.length);
    console.log('AccessCode first 8 chars:', accessCode.substring(0, 8));
    console.log('SecretKey configured:', !!secretKey);

    console.log('Fetching plans from eSIM Access API...');

    // Try the balance endpoint first to test authentication
    const balanceResponse = await fetch('https://api.esimaccess.com/api/v1/open/balance/query', {
      method: 'POST',
      headers: {
        'RT-AccessCode': accessCode,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    console.log('Balance check status:', balanceResponse.status);
    const balanceText = await balanceResponse.text();
    console.log('Balance response:', balanceText);

    if (!balanceResponse.ok) {
      throw new Error(`Balance check failed: ${balanceResponse.status} - ${balanceText}`);
    }

    // If balance check works, try the package list
    const response = await fetch('https://api.esimaccess.com/api/v1/open/package/list', {
      method: 'POST',
      headers: {
        'RT-AccessCode': accessCode,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('eSIM Access API error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const apiData = await response.json();
    console.log('Received data from eSIM Access:', apiData);

// Some endpoints return success as boolean or string "true"
    const successVal = apiData?.success;
    const isSuccess = successVal === true || String(successVal).toLowerCase() === 'true';
    if (!isSuccess) {
      const errCode = apiData?.errorCode ?? apiData?.code ?? 'unknown';
      const errMsg = apiData?.errorMessage ?? apiData?.errorMsg ?? 'Unknown error from provider';
      console.error('eSIM Access returned error:', { errCode, errMsg, apiData });
      throw new Error(`Provider error: ${errCode} - ${errMsg}`);
    }

    // Handle multiple possible response shapes (data vs obj, list wrappers, etc.)
let rawPlans: any = apiData.data ?? apiData.obj ?? [];
    if (!Array.isArray(rawPlans)) {
      rawPlans = rawPlans?.packageList ?? rawPlans?.list ?? rawPlans?.data ?? rawPlans?.packages ?? rawPlans?.results ?? [];
    }
    if (!Array.isArray(rawPlans)) {
      throw new Error('Invalid API response: no plans array found');
    }
    const plans = rawPlans;
    console.log(`Processing ${plans.length} plans...`);

    // Transform API data to match our esim_plans table structure
const transformedPlans = plans.map((plan: any) => {
      // eSIM Access fields: packageCode, slug, name, price (int, 10000 = $1), currencyCode,
      // volume (bytes), duration, durationUnit (DAY), location (comma-separated country codes)
      const toGB = (bytes: number) => bytes > 0 ? (bytes / (1024 * 1024 * 1024)) : 0;
      const dataStr = plan.volume ? `${Math.round(toGB(Number(plan.volume)) * 100) / 100}GB` : '';
      const durationUnit = plan.durationUnit || plan.validityUnit || 'DAY';
      const days = durationUnit === 'DAY' ? Number(plan.duration || 0) : Number(plan.unusedValidTime || plan.validityDays || 0);
      const priceVal = plan.price ? Number(plan.price) / 10000 : Number(plan.priceUsd ?? plan.wholesalePrice ?? 0);
      const currency = plan.currencyCode || plan.currency || 'USD';
      const locationStr = plan.location || '';
      const isMulti = typeof locationStr === 'string' && locationStr.includes(',');
      const country_code = isMulti ? 'RG' : (locationStr || plan.locationCode || 'GL');
      const country_name = isMulti ? 'Regional' : (plan.locationNetworkList?.[0]?.locationName || 'Unknown');

      return {
        supplier_plan_id: plan.packageCode || plan.slug || plan.code || `${country_code}-${dataStr}-${days}`.toLowerCase(),
        title: plan.name || plan.title || plan.packageName || `${dataStr} - ${country_name}`,
        country_name,
        country_code,
        data_amount: dataStr, // e.g., "1GB", "5GB"
        validity_days: days || 0,
        wholesale_price: priceVal,
        currency,
        description: plan.description || plan.name || `${dataStr} data plan for ${country_name}`,
        is_active: true
      };
    });

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
    if (activePlanIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from('esim_plans')
        .update({ is_active: false })
        .not('supplier_plan_id', 'in', `(${activePlanIds.map(id => `"${id}"`).join(',')})`);

      if (deactivateError) {
        console.error('Error deactivating old plans:', deactivateError);
      }
    } else {
      console.log('No active plans returned; skipping deactivation step.');
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