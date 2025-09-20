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
    console.log('=== Create Maya eSIM Function Started ===');
    
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

    // Normalize base URL and define endpoints (try account first, then legacy)
    const baseUrl = (mayaApiUrl || 'https://api.maya.net').replace(/\/+$/,'');
    const endpoints = [
      `${baseUrl}/connectivity/v1/account/orders`,
      `${baseUrl}/connectivity/v1/orders`,
    ];

    // Create eSIM order via Maya API
    const orderPayload = {
      product_uid: mayaProductUid,
      product_id: mayaProductUid,
      uid: mayaProductUid,
      quantity: 1,
      external_reference: order_id, // use our DB order id as reference
    };
    console.log('Maya Order Request payload:', orderPayload);
    await logTrace(supabaseClient, 'order_request', { primary_url: endpoints[0], fallback_url: endpoints[1], payload: orderPayload }, correlationId);

    // Try endpoints with graceful fallback
    let orderRes: Response | null = null;
    let usedEndpoint = '';
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': basicAuth,
          },
          body: JSON.stringify(orderPayload),
        });
        const ct = res.headers.get('content-type') || '';
        const htmlLike = ct.includes('text/html');
        if ((res.status === 404 || htmlLike) && ep !== endpoints[endpoints.length - 1]) {
          await logTrace(supabaseClient, 'order_endpoint_fallback', { from: ep, status: res.status, contentType: ct }, correlationId);
          continue; // try next endpoint
        }
        orderRes = res;
        usedEndpoint = ep;
        break;
      } catch (e) {
        await logTrace(supabaseClient, 'order_endpoint_error', { endpoint: ep, error: e.message }, correlationId);
        continue;
      }
    }

    if (!orderRes) {
      console.error('All Maya order endpoints failed');
      await supabaseClient
        .from('orders')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', order_id);
      await issueRefund(supabaseClient, order_id, 'Maya order endpoints unreachable');
      return new Response(JSON.stringify({ error: 'Maya API unreachable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Maya Order API Response status:', orderRes.status);
    console.log('Maya Order API Response headers:', Object.fromEntries(orderRes.headers.entries()));
    await logTrace(supabaseClient, 'order_response_headers', { usedEndpoint, status: orderRes.status, headers: Object.fromEntries(orderRes.headers.entries()) }, correlationId);

    // Check if response is HTML (404 error page) instead of JSON
    const contentType = orderRes.headers.get('content-type');
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
        status: orderRes.status,
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let orderJson;
    try {
      orderJson = await orderRes.json();
      await logTrace(supabaseClient, 'order_response_body', { ok: orderRes.ok, keys: Object.keys(orderJson || {}), data_keys: Object.keys(orderJson?.data || {}) }, correlationId);
    } catch (parseError) {
      console.error('Failed to parse Maya API response as JSON:', parseError);
      
      // Capture raw response text for debugging
      try {
        const rawText = await orderRes.text();
        await logTrace(supabaseClient, 'order_response_parse_error', { 
          parseError: parseError.message, 
          rawTextSnippet: rawText.substring(0, 500),
          contentType 
        }, correlationId);
      } catch (textError) {
        await logTrace(supabaseClient, 'order_response_parse_error', { 
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
    console.log('Maya Order API Response data:', orderJson);

    // If provider returned eSIM immediately in the create response, finish here
    const simsFromCreate = orderJson?.data?.sims || orderJson?.sims || orderJson?.data?.sim_list;
    if (Array.isArray(simsFromCreate) && simsFromCreate.length > 0 && simsFromCreate[0]?.iccid) {
      const esim = simsFromCreate[0];
      console.log('Maya eSIM returned on create:', { iccid: esim.iccid, hasActivationCode: !!esim.activation_code });

      const { error: updateOnCreateErr } = await supabaseClient
        .from('orders')
        .update({
          status: 'completed',
          esim_iccid: esim.iccid,
          esim_qr_code: esim.qr_code || null,
          activation_code: esim.activation_code || null,
          supplier_order_id: orderJson?.data?.order_id || orderJson?.order_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id);

      if (updateOnCreateErr) {
        console.error('Failed to update order from create response:', updateOnCreateErr);
        return new Response(JSON.stringify({ error: 'Failed to update order', details: updateOnCreateErr }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        iccid: esim.iccid,
        order_id: order_id,
        supplier_order_id: orderJson?.data?.order_id || orderJson?.order_id || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Consider response successful if we have an order id in any known place or headers
    const locationHeader = orderRes.headers.get('location') || orderRes.headers.get('Location');
    const orderIdFromHeader = locationHeader ? locationHeader.split('/').pop() : undefined;
    const orderId = orderJson?.data?.order_id || orderJson?.order_id || orderJson?.data?.id || orderJson?.data?.order_uid || orderJson?.uid || orderJson?.data?.order?.id || orderJson?.order?.uid || orderIdFromHeader;

    if (!orderRes.ok || !orderId) {
      const errMsg = orderJson?.message || orderJson?.developer_message || orderJson?.error || 'Maya service temporarily unavailable';
      console.error('Maya Order API error - Status:', orderRes.status);
      console.error('Maya Order API error response:', orderJson);
      
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
        error: 'Failed to place Maya eSIM order',
        details: `${errMsg}. Your payment has been refunded.`,
        status: orderRes.status,
        supplier_plan_id: plan.supplier_plan_id,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Maya order placed successfully. order_id:', orderId, 'Now polling for eSIM details...');

    // Poll the Maya order status until eSIM is ready (up to ~30s)
    const maxAttempts = 10; // 10 * 3s = 30s
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    let esimData: any | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Status check attempt ${attempt}/${maxAttempts} for Maya order:`, orderId);
      
      const baseUrl = (mayaApiUrl || 'https://api.maya.net').replace(/\/+$/,'');
      const statusEndpoints = [
        `${baseUrl}/connectivity/v1/account/orders/${orderId}`,
        `${baseUrl}/connectivity/v1/orders/${orderId}`,
      ];
      let statusRes: Response | null = null;
      let statusJson: any = null;
      for (const ep of statusEndpoints) {
        try {
          const res = await fetch(ep, {
            method: 'GET',
            headers: {
              'Authorization': basicAuth,
              'Accept': 'application/json',
            },
          });
          const ct = res.headers.get('content-type') || '';
          const htmlLike = ct.includes('text/html');
          if ((res.status === 404 || htmlLike) && ep !== statusEndpoints[statusEndpoints.length - 1]) {
            await logTrace(supabaseClient, 'status_endpoint_fallback', { from: ep, status: res.status, contentType: ct }, correlationId);
            continue;
          }
          statusRes = res;
          try { statusJson = await res.json(); } catch { statusJson = {}; }
          break;
        } catch (e) {
          await logTrace(supabaseClient, 'status_endpoint_error', { endpoint: ep, error: e.message }, correlationId);
          continue;
        }
      }

      if (!statusRes) {
        await delay(3000);
        continue;
      }

      console.log('Maya Status API Response status:', statusRes.status);
      console.log('Maya Status API Response data:', statusJson);

      // Check if order is completed and has eSIM data
      const sims = statusJson?.data?.sims || statusJson?.data?.sim_list || statusJson?.sims;
      if (Array.isArray(sims) && sims.length > 0 && sims[0]?.iccid) {
        esimData = sims[0];
        break;
      }
      const statusVal = statusJson?.data?.status || statusJson?.data?.order_status || statusJson?.status;
      if (statusRes.ok && (statusVal === 'completed' || statusVal === 'fulfilled' || statusVal === 'success')) {
        if (Array.isArray(sims) && sims.length > 0) {
          esimData = sims[0];
          break;
        }
      }

      // If still processing, wait and retry
      if (statusJson?.data?.status === 'processing' || statusJson?.data?.status === 'pending') {
        await delay(3000);
        continue;
      }

      // If failed, stop trying
      if (statusJson?.data?.status === 'failed') {
        console.error('Maya order failed:', statusJson);
        break;
      }

      // For other statuses, continue polling
      await delay(3000);
    }

    if (!esimData) {
      console.error('Maya eSIM not ready in time for order:', orderId);
      
      // Update order status to failed due to timeout
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', order_id);

      // Issue automatic refund to agent's wallet
      await issueRefund(supabaseClient, order_id, 'Maya eSIM allocation timeout');

      return new Response(JSON.stringify({
        error: 'Maya eSIM allocation timeout',
        details: 'eSIM not ready in time. Your payment has been refunded.',
        orderId,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Maya eSIM allocated:', {
      iccid: esimData.iccid,
      hasActivationCode: !!esimData.activation_code,
      orderId,
    });

    // Update the order with eSIM details
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'completed',
        esim_iccid: esimData.iccid,
        esim_qr_code: esimData.qr_code || null,
        activation_code: esimData.activation_code,
        supplier_order_id: orderId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Failed to update order with Maya eSIM details:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update order', details: updateError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Order updated successfully with Maya eSIM details');
    return new Response(JSON.stringify({
      success: true,
      iccid: esimData.iccid,
      order_id: order_id,
      supplier_order_id: orderId,
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