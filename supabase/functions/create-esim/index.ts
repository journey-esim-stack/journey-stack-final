import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Create eSIM Function Started ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request payload:', requestBody);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { plan_id, order_id } = requestBody;
    
    if (!plan_id || !order_id) {
      console.error('Missing required fields:', { plan_id, order_id });
      return new Response(JSON.stringify({ error: 'plan_id and order_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching plan details for plan_id:', plan_id);

    // Get the plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('esim_plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    console.log('Plan query result:', { plan, planError });

    if (planError || !plan) {
      console.error('Plan not found:', planError);
      return new Response(JSON.stringify({ error: 'Plan not found', details: planError }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessCode = Deno.env.get('ESIMACCESS_ACCESS_CODE');
    const secretKey = Deno.env.get('ESIMACCESS_SECRET_KEY');

    console.log('Environment variables check:', {
      hasAccessCode: !!accessCode,
      hasSecretKey: !!secretKey,
      accessCodeLength: accessCode?.length || 0,
      secretKeyLength: secretKey?.length || 0
    });

    if (!accessCode || !secretKey) {
      console.error('Missing eSIM Access credentials');
      return new Response(JSON.stringify({ error: 'eSIM Access credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Creating eSIM with eSIM Access API...');
    console.log('Plan supplier_plan_id:', plan.supplier_plan_id);

    // Create eSIM via eSIM Access API
    const apiPayload = {
      access_code: accessCode,
      secret_key: secretKey,
      plan_id: plan.supplier_plan_id,
      quantity: 1
    };
    console.log('API Request payload:', { ...apiPayload, secret_key: '[HIDDEN]' });

    const response = await fetch('https://api.esimaccess.com/api/v1/esim/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiPayload),
    });

    console.log('API Response status:', response.status);
    console.log('API Response headers:', Object.fromEntries(response.headers.entries()));

    const esimData = await response.json();
    console.log('API Response data:', esimData);
    
    if (!response.ok) {
      console.error('eSIM Access API error - Status:', response.status);
      console.error('eSIM Access API error - Data:', esimData);
      return new Response(JSON.stringify({ 
        error: 'Failed to create eSIM', 
        details: esimData,
        status: response.status,
        plan_id: plan.supplier_plan_id
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('eSIM creation successful, updating order...');
    console.log('eSIM Data received:', { 
      iccid: esimData.iccid, 
      hasQRCode: !!esimData.qr_code,
      hasActivationCode: !!esimData.activation_code,
      orderId: esimData.order_id
    });

    // Update the order with eSIM details
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'completed',
        esim_iccid: esimData.iccid,
        esim_qr_code: esimData.qr_code,
        activation_code: esimData.activation_code,
        supplier_order_id: esimData.order_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Failed to update order with eSIM details:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update order', details: updateError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Order updated successfully with eSIM details');
    return new Response(JSON.stringify({ 
      success: true, 
      iccid: esimData.iccid,
      order_id: order_id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});