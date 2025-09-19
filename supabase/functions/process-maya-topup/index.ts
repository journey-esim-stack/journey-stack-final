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
    const { iccid, package_code, agent_id } = await req.json();
    
    if (!iccid || !package_code || !agent_id) {
      return new Response(
        JSON.stringify({ error: 'ICCID, package_code, and agent_id are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Processing Maya topup:', { iccid, package_code, agent_id });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get Maya API credentials
    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL');

    if (!mayaApiKey || !mayaApiSecret || !mayaApiUrl) {
      throw new Error('Maya API credentials not configured');
    }

    // Build Basic Auth header
    const basicAuth = 'Basic ' + btoa(`${mayaApiKey}:${mayaApiSecret}`);

    // Create a unique transaction ID
    const transactionId = `maya_topup_${Date.now()}_${agent_id}`;

    // Execute Maya topup
    const topupPayload = {
      iccid: iccid,
      product_uid: package_code,
      external_reference: transactionId,
    };

    console.log('Maya topup request payload:', topupPayload);

    const topupRes = await fetch(`${mayaApiUrl}/connectivity/v1/sims/${iccid}/topups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuth,
      },
      body: JSON.stringify(topupPayload),
    });

    const topupData = await topupRes.json();
    console.log('Maya topup response:', topupRes.status, topupData);

    if (!topupRes.ok || !topupData?.success) {
      console.error('Maya topup failed:', topupData);
      return new Response(
        JSON.stringify({ 
          error: 'Maya topup failed', 
          details: topupData?.message || 'Unknown error' 
        }),
        { 
          status: topupRes.status || 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get topup details from response
    const topupId = topupData?.data?.topup_id || transactionId;
    const amount = topupData?.data?.amount || 0;

    // Save topup record to database
    const { error: insertError } = await supabase
      .from('esim_topups')
      .insert({
        agent_id: agent_id,
        iccid: iccid,
        package_code: package_code,
        transaction_id: topupId,
        amount: amount,
        data_amount: topupData?.data?.data_amount || '',
        validity_days: topupData?.data?.validity_days || null,
        status: 'completed',
      });

    if (insertError) {
      console.error('Failed to save Maya topup record:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save topup record', 
          details: insertError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Maya topup completed successfully:', topupId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction_id: topupId,
        amount: amount,
        message: 'Maya topup completed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Maya topup error:', error);
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