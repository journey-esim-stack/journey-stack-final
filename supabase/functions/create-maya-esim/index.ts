import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Persist diagnostics even if functions logs UI lags
async function logTrace(supabaseClient: any, action: string, details: any, correlationId?: string) {
  try {
    await supabaseClient.from('audit_logs').insert({
      table_name: 'create_maya_esim',
      action,
      new_values: { ...details, correlationId },
    });
  } catch (e) {
    console.error('audit log insert failed', e);
  }
}

// Function to issue automatic refunds when eSIM creation fails
async function issueRefund(supabaseClient: any, orderId: string, reason: string) {
  try {
    console.log('Processing refund for order:', orderId, 'Reason:', reason);
    
    // Check if refund already exists for this order
    const { data: existingRefund } = await supabaseClient
      .from('wallet_transactions')
      .select('id')
      .eq('reference_id', `refund-${orderId}`)
      .eq('transaction_type', 'refund')
      .single();
    
    if (existingRefund) {
      console.log('Refund already processed for order:', orderId);
      return;
    }
    
    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('agent_id, retail_price, status')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      console.error('Failed to fetch order for refund:', orderError);
      return;
    }
    
    // Don't refund if order is already completed
    if (order.status === 'completed') {
      console.log('Order already completed, skipping refund for order:', orderId);
      return;
    }
    
    // Get current agent balance
    const { data: profile, error: profileError } = await supabaseClient
      .from('agent_profiles')
      .select('wallet_balance')
      .eq('id', order.agent_id)
      .single();
    
    if (profileError || !profile) {
      console.error('Failed to fetch agent profile for refund:', profileError);
      return;
    }
    
    const newBalance = Number(profile.wallet_balance) + Number(order.retail_price);
    
    // Update agent balance
    const { error: updateError } = await supabaseClient
      .from('agent_profiles')
      .update({ 
        wallet_balance: newBalance,
        updated_at: new Date().toISOString() 
      })
      .eq('id', order.agent_id);
    
    if (updateError) {
      console.error('Failed to update agent balance for refund:', updateError);
      return;
    }
    
    // Insert refund transaction
    const { error: transactionError } = await supabaseClient
      .from('wallet_transactions')
      .insert({
        agent_id: order.agent_id,
        transaction_type: 'refund',
        amount: Number(order.retail_price),
        balance_after: newBalance,
        description: `Automatic refund: ${reason}`,
        reference_id: `refund-${orderId}`,
      });
    
    if (transactionError) {
      console.error('Failed to insert refund transaction:', transactionError);
      return;
    }
    
    console.log('Refund processed successfully for order:', orderId, 'Amount:', order.retail_price);
  } catch (error) {
    console.error('Error processing refund:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Create Maya eSIM Function Started (v2 - using /esim endpoint) ===');
    
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

    const { plan_id, order_id, correlationId } = requestBody;
    
    await logTrace(supabaseClient, 'start', { plan_id, order_id }, correlationId);
    
    if (!plan_id || !order_id) {
      console.error('Missing required fields:', { plan_id, order_id });
      return new Response(JSON.stringify({ error: 'plan_id and order_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching Maya plan details for plan_id:', plan_id);

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

    // Extract Maya product UID from supplier_plan_id (format: maya_XXXXX)
    const mayaProductUid = plan.supplier_plan_id.replace('maya_', '');
    console.log('Maya product mapping:', { 
      original: plan.supplier_plan_id, 
      stripped: mayaProductUid,
      plan_title: plan.title 
    });
    
    await logTrace(supabaseClient, 'product_id_mapping', { 
      original: plan.supplier_plan_id, 
      stripped: mayaProductUid,
      plan_title: plan.title 
    }, correlationId);

    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL');

    console.log('Environment variables check:', {
      hasMayaApiKey: !!mayaApiKey,
      hasMayaApiSecret: !!mayaApiSecret,
      hasMayaApiUrl: !!mayaApiUrl,
    });
    await logTrace(supabaseClient, 'env_check', { hasMayaApiKey: !!mayaApiKey, hasMayaApiSecret: !!mayaApiSecret, hasMayaApiUrl: !!mayaApiUrl }, correlationId);

    if (!mayaApiKey || !mayaApiSecret || !mayaApiUrl) {
      console.error('Missing Maya service credentials');
      return new Response(JSON.stringify({ error: 'Maya service credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Creating eSIM with Maya API...');

    // Build Basic Auth header
    const basicAuth = 'Basic ' + btoa(`${mayaApiKey}:${mayaApiSecret}`);

    // Use the correct Maya eSIM creation endpoint
    const baseUrl = (mayaApiUrl || 'https://api.maya.net').replace(/\/+$/,'');
    const esimEndpoint = `${baseUrl}/connectivity/v1/esim`;

    // Create eSIM with plan_type_id (Maya's recommended approach)
    const esimPayload = {
      plan_type_id: mayaProductUid,
      tag: order_id, // use our DB order id for tracking
    };
    console.log('Maya eSIM Request payload:', esimPayload);
    await logTrace(supabaseClient, 'esim_request', { endpoint: esimEndpoint, payload: esimPayload }, correlationId);

    // Call Maya eSIM creation endpoint
    let esimRes: Response | null = null;
    try {
      esimRes = await fetch(esimEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': basicAuth,
        },
        body: JSON.stringify(esimPayload),
      });
    } catch (e) {
      await logTrace(supabaseClient, 'esim_endpoint_error', { endpoint: esimEndpoint, error: e.message }, correlationId);
    }

    if (!esimRes) {
      console.error('Maya eSIM endpoint failed');
      await supabaseClient
        .from('orders')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', order_id);
      await issueRefund(supabaseClient, order_id, 'Maya eSIM endpoint unreachable');
      return new Response(JSON.stringify({ error: 'Maya API unreachable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Maya eSIM API Response status:', esimRes.status);
    console.log('Maya eSIM API Response headers:', Object.fromEntries(esimRes.headers.entries()));
    await logTrace(supabaseClient, 'esim_response_headers', { endpoint: esimEndpoint, status: esimRes.status, headers: Object.fromEntries(esimRes.headers.entries()) }, correlationId);

    // Check if response is HTML (404 error page) instead of JSON
    const contentType = esimRes.headers.get('content-type');
    if (contentType?.includes('text/html')) {
      console.error('Maya API returned HTML instead of JSON - likely 404 or service down');
      
      // Update order status to failed
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', order_id);

      // Issue automatic refund to agent's wallet
      await issueRefund(supabaseClient, order_id, 'Maya eSIM provider service unavailable');

      return new Response(JSON.stringify({
        error: 'Maya API service is currently unavailable',
        details: 'The Maya eSIM provider service is down. Your payment has been refunded.',
        status: esimRes.status,
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let esimJson;
    try {
      esimJson = await esimRes.json();
      await logTrace(supabaseClient, 'esim_response_body', { ok: esimRes.ok, keys: Object.keys(esimJson || {}), esim_keys: Object.keys(esimJson?.esim || {}) }, correlationId);
    } catch (parseError) {
      console.error('Failed to parse Maya API response as JSON:', parseError);
      
      // Capture raw response text for debugging
      try {
        const rawText = await esimRes.text();
        await logTrace(supabaseClient, 'esim_response_parse_error', { 
          parseError: parseError.message, 
          rawTextSnippet: rawText.substring(0, 500),
          contentType 
        }, correlationId);
      } catch (textError) {
        await logTrace(supabaseClient, 'esim_response_parse_error', { 
          parseError: parseError.message, 
          textError: textError.message,
          contentType 
        }, correlationId);
      }
      
      // Update order status to failed
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', order_id);

      // Issue automatic refund to agent's wallet  
      await issueRefund(supabaseClient, order_id, 'Failed to parse Maya response');

      return new Response(JSON.stringify({
        error: 'Maya API returned invalid response',
        details: 'Unable to parse Maya response. Your payment has been refunded.',
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Maya eSIM API Response data:', esimJson);

    // Check if Maya returned eSIM immediately (success case)
    if (esimRes.ok && esimJson?.esim?.iccid) {
      const esim = esimJson.esim;
      console.log('Maya eSIM created successfully:', { 
        iccid: esim.iccid, 
        hasActivationCode: !!esim.activation_code,
        uid: esim.uid 
      });

      const { error: updateErr } = await supabaseClient
        .from('orders')
        .update({
          status: 'completed',
          esim_iccid: esim.iccid,
          esim_qr_code: esim.activation_code || null, // Maya uses activation_code as QR
          activation_code: esim.activation_code || esim.manual_code || null,
          supplier_order_id: esim.uid || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id);

      if (updateErr) {
        console.error('Failed to update order with eSIM details:', updateErr);
        return new Response(JSON.stringify({ error: 'Failed to update order', details: updateErr }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await logTrace(supabaseClient, 'esim_success', { 
        iccid: esim.iccid, 
        uid: esim.uid,
        order_id 
      }, correlationId);

      return new Response(JSON.stringify({
        success: true,
        iccid: esim.iccid,
        order_id: order_id,
        supplier_order_id: esim.uid,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If we reach here, Maya API call failed
    const errMsg = esimJson?.message || esimJson?.developer_message || esimJson?.error || 'Maya eSIM creation failed';
    console.error('Maya eSIM API error - Status:', esimRes.status);
    console.error('Maya eSIM API error response:', esimJson);
    
    // Update order status to failed
    await supabaseClient
      .from('orders')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString() 
      })
      .eq('id', order_id);

    // Issue automatic refund to agent's wallet
    await issueRefund(supabaseClient, order_id, errMsg);

    return new Response(JSON.stringify({
      error: 'Failed to create Maya eSIM',
      details: `${errMsg}. Your payment has been refunded.`,
      status: esimRes.status,
      supplier_plan_id: plan.supplier_plan_id,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    // This code should not be reached since we handle success/failure above
    console.warn('Unexpected code path reached in Maya eSIM function');
    return new Response(JSON.stringify({
      error: 'Unexpected response from Maya API',
      details: 'Unable to process eSIM creation response',
    }), {
      status: 500,
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