import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { iccid } = await req.json();
    
    if (!iccid) {
      return new Response(
        JSON.stringify({ error: 'ICCID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Fetching Maya topup plans for ICCID:', iccid);

    // Get Maya API credentials
    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL');

    if (!mayaApiKey || !mayaApiSecret || !mayaApiUrl) {
      throw new Error('Maya API credentials not configured');
    }

    // Build Basic Auth header
    const basicAuth = 'Basic ' + btoa(`${mayaApiKey}:${mayaApiSecret}`);

    // Get topup plans for this ICCID from Maya API
    const topupRes = await fetch(`${mayaApiUrl}/connectivity/v1/sims/${iccid}/topups/available`, {
      method: 'GET',
      headers: {
        'Authorization': basicAuth,
        'Accept': 'application/json',
      },
    });

    if (!topupRes.ok) {
      const errorText = await topupRes.text().catch(() => '');
      console.error('Maya topup plans fetch failed:', topupRes.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Maya topup plans', details: errorText }),
        { 
          status: topupRes.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const topupData = await topupRes.json();
    console.log('Maya topup plans response:', topupData);

    if (!topupData?.success || !Array.isArray(topupData?.data)) {
      return new Response(
        JSON.stringify({ error: 'Invalid Maya topup plans response', details: topupData }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Transform Maya topup plans to our expected format
    const transformedPlans = topupData.data.map((plan: any) => ({
      package_code: plan.uid || plan.id,
      name: plan.name || `${plan.data_quota_mb ? `${plan.data_quota_mb}MB` : ''} - ${plan.validity_days || 0} days`,
      data_amount: plan.data_quota_mb ? `${plan.data_quota_mb}MB` : '',
      validity_days: plan.validity_days || 0,
      price: plan.wholesale_price_usd || plan.price || 0,
      currency: 'USD',
      description: plan.description || '',
    }));

    console.log(`Returning ${transformedPlans.length} Maya topup plans`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: transformedPlans 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Maya topup plans error:', error);
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