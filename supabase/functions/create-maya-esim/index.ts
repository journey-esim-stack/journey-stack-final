import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Persist diagnostics even if functions logs UI lags - Updated 2025-09-20
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

// Get Maya OAuth access token with fallback to Basic Auth
async function getMayaAccessToken(apiKey: string, apiSecret: string, apiUrl: string, correlationId: string) {
  const oauthEndpoints = [
    `${apiUrl}/oauth/token`,
    `${apiUrl}/connectivity/v1/oauth/token`
  ];

  for (const endpoint of oauthEndpoints) {
    try {
      console.log(`[${correlationId}] Attempting OAuth at: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: apiKey,
          client_secret: apiSecret,
        }),
      });

      console.log(`[${correlationId}] OAuth response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          console.log(`[${correlationId}] OAuth successful, got access token`);
          return `Bearer ${data.access_token}`;
        }
      }
    } catch (error) {
      console.log(`[${correlationId}] OAuth attempt failed at ${endpoint}:`, error.message);
    }
  }

  console.log(`[${correlationId}] All OAuth attempts failed, falling back to Basic Auth`);
  return `Basic ${btoa(`${apiKey}:${apiSecret}`)}`;
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

    const { plan_id, order_id, correlationId, product_uid } = requestBody;
    
    await logTrace(supabaseClient, 'start', { plan_id, product_uid, order_id }, correlationId);
    
    if (!order_id || (!plan_id && !product_uid)) {
      console.error('Missing required fields:', { plan_id, product_uid, order_id });
      return new Response(JSON.stringify({ error: 'order_id and either plan_id or product_uid are required' }), {
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

    console.log(`[${correlationId}] Creating eSIM with Maya API...`);

    // Get authentication header (OAuth with Basic Auth fallback)
    const authHeader = await getMayaAccessToken(mayaApiKey, mayaApiSecret, mayaApiUrl, correlationId);

    console.log(`[${correlationId}] Maya product UID: ${mayaProductUid}`);

    // Create order payload with correct structure
    const orderPayload = {
      items: [
        {
          product_uid: mayaProductUid,
          quantity: 1
        }
      ],
      external_reference: order_id,
      channel: "api"
    };

    console.log(`[${correlationId}] Payload:`, JSON.stringify(orderPayload, null, 2));

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader,
    };

    console.log(`[${correlationId}] Headers:`, JSON.stringify(headers, null, 2));

    // Try account-scoped endpoint first
    let orderRes;
    let orderEndpoint = `${mayaApiUrl}/connectivity/v1/account/orders`;
    
    console.log(`[${correlationId}] Creating order at: ${orderEndpoint}`);
    
    orderRes = await fetch(orderEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(orderPayload),
    });

    console.log(`[${correlationId}] Order response status ${orderRes.status} from ${orderEndpoint}`);
    console.log(`[${correlationId}] Response headers:`, JSON.stringify(Object.fromEntries(orderRes.headers.entries()), null, 2));

    // Get raw response for debugging
    const rawResponse = await orderRes.text();
    console.log(`[${correlationId}] Raw response:`, rawResponse);

    // If account endpoint returns 404, try direct orders endpoint
    if (orderRes.status === 404) {
      console.log(`[${correlationId}] Account endpoint returned 404, falling back to direct orders endpoint.`);
      orderEndpoint = `${mayaApiUrl}/connectivity/v1/orders`;
      
      console.log(`[${correlationId}] Creating order at: ${orderEndpoint}`);
      console.log(`[${correlationId}] Payload:`, JSON.stringify(orderPayload, null, 2));
      console.log(`[${correlationId}] Headers:`, JSON.stringify(headers, null, 2));
      
      orderRes = await fetch(orderEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderPayload),
      });

      console.log(`[${correlationId}] Order response status ${orderRes.status} from ${orderEndpoint}`);
      console.log(`[${correlationId}] Response headers:`, JSON.stringify(Object.fromEntries(orderRes.headers.entries()), null, 2));
      
      const fallbackRawResponse = await orderRes.text();
      console.log(`[${correlationId}] Raw response:`, fallbackRawResponse);
      
      // Parse the response again
      try {
        var orderJson = JSON.parse(fallbackRawResponse);
      } catch (parseError) {
        console.error(`[${correlationId}] Failed to parse fallback response:`, parseError.message);
        
        // Update order status to failed and issue refund
        await supabaseClient
          .from('orders')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString() 
          })
          .eq('id', order_id);

        await issueRefund(supabaseClient, order_id, 'Maya API returned invalid response');

        return new Response(JSON.stringify({
          error: 'Maya API returned invalid response',
          details: 'Unable to parse Maya response. Your payment has been refunded.',
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Parse the initial response
      try {
        var orderJson = JSON.parse(rawResponse);
      } catch (parseError) {
        console.error(`[${correlationId}] Failed to parse initial response:`, parseError.message);
        
        // Update order status to failed and issue refund
        await supabaseClient
          .from('orders')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString() 
          })
          .eq('id', order_id);

        await issueRefund(supabaseClient, order_id, 'Maya API returned invalid response');

        return new Response(JSON.stringify({
          error: 'Maya API returned invalid response',
          details: 'Unable to parse Maya response. Your payment has been refunded.',
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`[${correlationId}] Processing order response...`);

    // Check for API errors in the response
    if (!orderRes.ok) {
      const errorMessage = orderJson?.message || orderJson?.developer_message || orderJson?.error || 'Maya service error';
      console.error(`[${correlationId}] Provider error at ${orderEndpoint}:`, JSON.stringify(orderJson, null, 2));
      
      // Update order status to failed and issue refund
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', order_id);

      await issueRefund(supabaseClient, order_id, errorMessage);

      return new Response(JSON.stringify({
        error: 'Failed to place Maya eSIM order',
        details: `${errorMessage}. Your payment has been refunded.`,
        status: orderRes.status,
        supplier_plan_id: plan.supplier_plan_id,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${correlationId}] Order created successfully:`, JSON.stringify(orderJson, null, 2));

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

    // Extract order ID from response 
    const locationHeader = orderRes.headers.get('location') || orderRes.headers.get('Location');
    const orderIdFromHeader = locationHeader ? locationHeader.split('/').pop() : undefined;
    const orderId = orderJson?.data?.order_id || orderJson?.order_id || orderJson?.data?.id || orderJson?.data?.order_uid || orderJson?.uid || orderJson?.data?.order?.id || orderJson?.order?.uid || orderIdFromHeader;

    if (!orderId) {
      console.error(`[${correlationId}] No order ID found in response`);
      
      // Update order status to failed and issue refund
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', order_id);

      await issueRefund(supabaseClient, order_id, 'No order ID returned from Maya');

      return new Response(JSON.stringify({
        error: 'Failed to get order ID from Maya',
        details: 'Maya did not return an order ID. Your payment has been refunded.',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${correlationId}] Maya order placed successfully. order_id: ${orderId}, Now polling for eSIM details...`);

    // Poll the Maya order status until eSIM is ready (up to ~60s)
    const maxAttempts = 30; // 30 * 2s = 60s
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    let esimData: any | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[${correlationId}] Status check attempt ${attempt}/${maxAttempts} for Maya order: ${orderId}`);
      
      // Use account-scoped status endpoint
      const statusEndpoint = `${mayaApiUrl}/connectivity/v1/account/orders/${orderId}`;
      const statusRes = await fetch(statusEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
      });

      console.log(`[${correlationId}] Status API Response status: ${statusRes.status}`);
      
      let statusJson;
      try {
        statusJson = await statusRes.json();
        console.log(`[${correlationId}] Status API Response data:`, JSON.stringify(statusJson, null, 2));
      } catch (parseError) {
        console.error(`[${correlationId}] Failed to parse status response:`, parseError.message);
        await delay(2000);
        continue;
      }

      // Check if order is completed and has eSIM data
      const sims = statusJson?.data?.sims || statusJson?.data?.sim_list || statusJson?.sims || statusJson?.data?.esim || statusJson?.esim;
      if (Array.isArray(sims) && sims.length > 0 && sims[0]?.iccid) {
        esimData = sims[0];
        console.log(`[${correlationId}] eSIM found in sims array:`, esimData.iccid);
        break;
      } else if (sims && sims.iccid) {
        esimData = sims;
        console.log(`[${correlationId}] eSIM found as single object:`, esimData.iccid);
        break;
      }
      
      const statusVal = statusJson?.data?.status || statusJson?.data?.order_status || statusJson?.status;
      console.log(`[${correlationId}] Order status: ${statusVal}`);
      
      if (statusRes.ok && (statusVal === 'completed' || statusVal === 'fulfilled' || statusVal === 'success')) {
        if (Array.isArray(sims) && sims.length > 0) {
          esimData = sims[0];
          break;
        } else if (sims && sims.iccid) {
          esimData = sims;
          break;
        }
      }

      // If still processing, wait and retry
      if (statusVal === 'processing' || statusVal === 'pending' || statusVal === 'in_progress') {
        console.log(`[${correlationId}] Order still ${statusVal}, waiting...`);
        await delay(2000);
        continue;
      }

      // If failed, stop trying
      if (statusVal === 'failed' || statusVal === 'error') {
        console.error(`[${correlationId}] Maya order failed with status: ${statusVal}`, statusJson);
        break;
      }

      // For other statuses, continue polling
      await delay(2000);
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