import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { iccid } = await req.json();
    console.log(`Getting Maya eSIM status for ICCID: ${iccid}`);

    if (!iccid) {
      return new Response(
        JSON.stringify({ error: 'Missing ICCID' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get Maya API credentials
    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL') || 'https://api.maya.net';

    if (!mayaApiKey || !mayaApiSecret) {
      return new Response(
        JSON.stringify({ error: 'Maya API credentials not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const auth = btoa(`${mayaApiKey}:${mayaApiSecret}`);

    // Get eSIM status from Maya API
    const statusResponse = await fetch(`${mayaApiUrl}/connectivity/v1/esim/${iccid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    const rawText = await statusResponse.text();
    console.log('[get-maya-esim-status] Raw response:', rawText);
    
    let statusResult;
    try {
      statusResult = JSON.parse(rawText);
      console.log('[get-maya-esim-status] Parsed response:', statusResult);
    } catch (parseError) {
      console.error('[get-maya-esim-status] JSON parse error:', parseError, 'Raw text:', rawText);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON response from Maya API',
          success: false
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!statusResponse.ok || statusResult.result !== 1) {
      const errorMsg = statusResult.developer_message || statusResult.message || 'Failed to get eSIM status';
      console.error('Maya status check failed:', errorMsg);
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: statusResponse.status, headers: corsHeaders }
      );
    }

    const esim = statusResult.esim;
    if (!esim) {
      return new Response(
        JSON.stringify({ error: 'No eSIM data in response' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Transform Maya status to our format
    const status = {
      iccid: esim.iccid,
      state: esim.state,
      service_status: esim.service_status,
      network_status: esim.network_status,
      activation_code: esim.activation_code,
      manual_code: esim.manual_code,
      smdp_address: esim.smdp_address,
      apn: esim.apn,
      auto_apn: esim.auto_apn,
      plan: esim.plan || null
    };

    console.log(`Maya eSIM status retrieved successfully for ICCID: ${iccid}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        status: status
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in get-maya-esim-status:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});