import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers for web requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to log actions with details to audit_logs
async function logTrace(supabaseClient: any, action: string, details: any, correlationId?: string) {
  try {
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'maya_api',
        action: action,
        new_values: { ...details, correlation_id: correlationId },
        user_id: null,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log trace:', error);
  }
}

// Function to get Maya OAuth 2.0 access token
async function getMayaAccessToken(apiKey: string, apiSecret: string, apiUrl: string, correlationId: string): Promise<string | null> {
  const authEndpoints = [
    `${apiUrl}/oauth/token`,
    `${apiUrl}/connectivity/v1/oauth/token`
  ];

  // Try multiple auth strategies for maximum compatibility
  for (const endpoint of authEndpoints) {
    try {
      console.log(`[${correlationId}] Attempting OAuth (form-encoded, body creds) at: ${endpoint}`);
      let tokenResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: apiKey,
          client_secret: apiSecret,
        }).toString(),
      });

      console.log(`[${correlationId}] OAuth response status: ${tokenResponse.status}`);
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        console.log(`[${correlationId}] OAuth success (form-encoded body creds) at: ${endpoint}`);
        return tokenData.access_token;
      }

      console.log(`[${correlationId}] Attempting OAuth (form-encoded + Basic header) at: ${endpoint}`);
      const basicAuth = `Basic ${btoa(`${apiKey}:${apiSecret}`)}`;
      tokenResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': basicAuth,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      });

      console.log(`[${correlationId}] OAuth response status: ${tokenResponse.status}`);
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        console.log(`[${correlationId}] OAuth success (form-encoded + Basic) at: ${endpoint}`);
        return tokenData.access_token;
      }

      console.log(`[${correlationId}] Attempting OAuth (JSON body creds) at: ${endpoint}`);
      tokenResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: apiKey,
          client_secret: apiSecret
        })
      });

      console.log(`[${correlationId}] OAuth response status: ${tokenResponse.status}`);
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        console.log(`[${correlationId}] OAuth success (JSON body) at: ${endpoint}`);
        return tokenData.access_token;
      }

      const errText = await tokenResponse.text();
      console.log(`[${correlationId}] OAuth failed at ${endpoint}: ${errText}`);
    } catch (error) {
      console.log(`[${correlationId}] OAuth error at ${endpoint}:`, error);
    }
  }

  console.log(`[${correlationId}] All OAuth attempts failed, falling back to Basic Auth`);
  return null;
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
    const correlationId = crypto.randomUUID();
    console.log(`[${correlationId}] === Create Maya eSIM Function Started (v3 - OAuth + account endpoints) ===`);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { plan_id, order_id } = await req.json();
    console.log(`[${correlationId}] Request payload:`, { plan_id, order_id });

    // Fetch plan details
    console.log(`[${correlationId}] Fetching plan details for plan_id: ${plan_id}`);
    const { data: plan, error: planError } = await supabaseClient
      .from('esim_plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    console.log(`[${correlationId}] Plan query result:`, { plan, planError });

    if (planError || !plan) {
      console.error(`[${correlationId}] Plan not found:`, planError);
      await logTrace(supabaseClient, 'plan_fetch_error', { plan_id, error: planError }, correlationId);
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Maya API credentials
    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL');

    if (!mayaApiKey || !mayaApiSecret || !mayaApiUrl) {
      console.error(`[${correlationId}] Missing Maya API credentials`);
      await logTrace(supabaseClient, 'credentials_missing', { 
        hasKey: !!mayaApiKey, 
        hasSecret: !!mayaApiSecret, 
        hasUrl: !!mayaApiUrl 
      }, correlationId);
      return new Response(
        JSON.stringify({ error: 'Maya API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${correlationId}] Creating eSIM with Maya API...`);
    console.log(`[${correlationId}] Plan supplier_plan_id:`, plan.supplier_plan_id);

    // Try OAuth 2.0 authentication first
    const accessToken = await getMayaAccessToken(mayaApiKey, mayaApiSecret, mayaApiUrl, correlationId);
    
    // Restore simple, working Maya order creation flow: single endpoint + single payload
    const productUid = plan.supplier_plan_id.replace('maya_', '');

    console.log(`[${correlationId}] Maya product UID:`, productUid);

    // Set up authentication headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      console.log(`[${correlationId}] Using OAuth Bearer token`);
    } else {
      const authString = btoa(`${mayaApiKey}:${mayaApiSecret}`);
      headers['Authorization'] = `Basic ${authString}`;
      console.log(`[${correlationId}] Using Basic Auth fallback`);
    }

    // Working payload format exactly as it was before
    const payload = {
      items: [
        { product_uid: productUid, quantity: 1 }
      ],
      external_reference: order_id,
      channel: 'api'
    };

    let mayaResponse: Response | null = null;
    let mayaResponseData: any = null;

    // Try account-scoped endpoint first, then fallback to direct endpoint on 404
    const orderEndpoints = [
      `${mayaApiUrl}/connectivity/v1/account/orders`,
      `${mayaApiUrl}/connectivity/v1/orders`
    ];

    try {
      for (const orderEndpoint of orderEndpoints) {
        console.log(`[${correlationId}] Creating order at: ${orderEndpoint}`);
        console.log(`[${correlationId}] Payload:`, JSON.stringify(payload, null, 2));
        console.log(`[${correlationId}] Headers:`, JSON.stringify(headers, null, 2));

        const resp = await fetch(orderEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        const status = resp.status;
        console.log(`[${correlationId}] Order response status ${status} from ${orderEndpoint}`);
        console.log(`[${correlationId}] Response headers:`, Object.fromEntries(resp.headers.entries()));

        const responseText = await resp.text();
        console.log(`[${correlationId}] Raw response:`, responseText);

        let parsed: any = {};
        try {
          parsed = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          console.error(`[${correlationId}] Failed to parse response as JSON:`, parseError);
          parsed = { error: 'Invalid JSON response', raw_response: responseText };
        }

        // If OK, set and break
        if (resp.ok) {
          mayaResponse = resp;
          mayaResponseData = parsed;
          console.log(`[${correlationId}] Order created successfully at: ${orderEndpoint}`);
          break;
        }

        // If first (account) endpoint fails with 404/401/403, try the direct endpoint next
        if (orderEndpoint.includes('/account/') && (status === 404 || status === 401 || status === 403)) {
          console.log(`[${correlationId}] Account endpoint returned ${status}, falling back to direct orders endpoint.`);
          continue;
        }

        // Otherwise, keep the latest response data and break
        mayaResponse = resp;
        mayaResponseData = parsed;
        console.error(`[${correlationId}] Provider error at ${orderEndpoint}:`, parsed);
        break;
      }
    } catch (err) {
      console.error(`[${correlationId}] Request error during order creation:`, err);
      mayaResponseData = { error: 'Network request failed', details: String(err) };
    }

    if (!mayaResponse || !mayaResponse.ok) {
      const status = mayaResponse?.status ?? 0;
      const errorDetails = mayaResponseData?.developer_message || mayaResponseData?.message || mayaResponseData?.error || 'Unknown error';

      await logTrace(supabaseClient, 'maya_api_error', {
        status,
        response: mayaResponseData,
        order_id,
        error_details: errorDetails
      }, correlationId);

    // Enhanced refund logic based on error codes
    if (status >= 500) {
      await issueRefund(supabaseClient, order_id, 'Provider server error while creating order');
    } else if (mayaResponseData?.errorCode === '310241') {
      // Specific Maya error: plan doesn't exist
      await issueRefund(supabaseClient, order_id, 'Service temporarily unavailable');
      
      // Log for plan validation
      await logTrace(supabaseClient, 'invalid_plan_detected', {
        plan_id,
        supplier_plan_id: plan.supplier_plan_id,
        order_id,
        maya_error: mayaResponseData
      }, correlationId);
    } else if (status === 401 || status === 403) {
      // Authentication/authorization issues - don't refund, log for investigation
      await logTrace(supabaseClient, 'auth_error', {
        status,
        response: mayaResponseData,
        order_id
      }, correlationId);
    }

      return new Response(
        JSON.stringify({
          error: 'Failed to create eSIM',
          details: errorDetails,
          status,
          correlation_id: correlationId
        }),
        { status: status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Log successful order creation
    await logTrace(supabaseClient, 'maya_order_created', {
      order_id,
      maya_order_id: mayaResponseData.id || mayaResponseData.order_id,
      status: 'created',
      full_response: mayaResponseData
    }, correlationId);

    // If the eSIM is immediately available, update the order
    if (mayaResponseData.esim || mayaResponseData.sims) {
      const esimData = mayaResponseData.esim || mayaResponseData.sims?.[0];
      if (esimData && esimData.iccid) {
        console.log(`[${correlationId}] eSIM immediately available:`, esimData);
        
        // Update order with eSIM details
        const { error: updateError } = await supabaseClient
          .from('orders')
          .update({
            status: 'completed',
            esim_iccid: esimData.iccid,
            esim_qr_code: esimData.qr_code || esimData.qrcode,
            activation_code: esimData.activation_code || esimData.activationCode,
            supplier_order_id: mayaResponseData.id || mayaResponseData.order_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', order_id);

        if (updateError) {
          console.error(`[${correlationId}] Error updating order:`, updateError);
          await logTrace(supabaseClient, 'order_update_error', { order_id, error: updateError }, correlationId);
        } else {
          console.log(`[${correlationId}] Order updated successfully with eSIM details`);
          await logTrace(supabaseClient, 'order_completed', { order_id, iccid: esimData.iccid }, correlationId);
        }

        return new Response(
          JSON.stringify({
            success: true,
            order_id,
            correlation_id: correlationId,
            esim: {
              iccid: esimData.iccid,
              qr_code: esimData.qr_code || esimData.qrcode,
              activation_code: esimData.activation_code || esimData.activationCode
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If eSIM not immediately available, poll for status
    const orderId = mayaResponseData.id || mayaResponseData.order_id;
    if (!orderId) {
      console.error(`[${correlationId}] No order ID returned from Maya API`);
      await issueRefund(supabaseClient, order_id, 'No order ID returned');
      return new Response(
        JSON.stringify({ error: 'Invalid response from Maya API', correlation_id: correlationId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${correlationId}] Polling for eSIM allocation, order ID:`, orderId);

    // Try account-scoped status endpoint first
    const statusEndpoints = [
      `${mayaApiUrl}/connectivity/v1/account/orders/${orderId}`,
      `${mayaApiUrl}/connectivity/v1/orders/${orderId}`
    ];

    // Poll for eSIM allocation (enhanced with exponential backoff)
    const maxAttempts = 30;
    const baseDelay = 2000; // 2 seconds
    let consecutiveFailures = 0;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Exponential backoff: 2s, 2s, 4s, 4s, 8s, 8s...
      const delay = Math.min(baseDelay * Math.pow(2, Math.floor(consecutiveFailures / 2)), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      for (const statusEndpoint of statusEndpoints) {
        try {
          console.log(`[${correlationId}] Polling attempt ${attempt}/30 for order ${orderId} at ${statusEndpoint}`);
          
          const statusResponse = await fetch(statusEndpoint, {
            method: 'GET',
            headers: {
              'Authorization': headers['Authorization'],
              'Accept': 'application/json'
            }
          });

          if (statusResponse.ok) {
            consecutiveFailures = 0; // Reset on success
            const statusData = await statusResponse.json();
            console.log(`[${correlationId}] Polling response ${attempt}:`, statusData);

            // Check if eSIM is allocated
            const esimData = statusData.esim || statusData.sims?.[0];
            if (esimData && esimData.iccid) {
              console.log(`[${correlationId}] eSIM allocated:`, esimData);
              
              // Update order with eSIM details
              const { error: updateError } = await supabaseClient
                .from('orders')
                .update({
                  status: 'completed',
                  esim_iccid: esimData.iccid,
                  esim_qr_code: esimData.qr_code || esimData.qrcode,
                  activation_code: esimData.activation_code || esimData.activationCode,
                  supplier_order_id: orderId,
                  updated_at: new Date().toISOString()
                })
                .eq('id', order_id);

              if (updateError) {
                console.error(`[${correlationId}] Error updating order:`, updateError);
                await logTrace(supabaseClient, 'order_update_error', { order_id, error: updateError }, correlationId);
              } else {
                console.log(`[${correlationId}] Order updated successfully with eSIM details`);
                await logTrace(supabaseClient, 'order_completed', { order_id, iccid: esimData.iccid }, correlationId);
              }

              return new Response(
                JSON.stringify({
                  success: true,
                  order_id,
                  correlation_id: correlationId,
                  esim: {
                    iccid: esimData.iccid,
                    qr_code: esimData.qr_code || esimData.qrcode,
                    activation_code: esimData.activation_code || esimData.activationCode
                  }
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            break; // Success with this endpoint, don't try the other one
          } else if (statusResponse.status === 404 && statusEndpoint === statusEndpoints[0]) {
            console.log(`[${correlationId}] 404 on account status endpoint, trying direct endpoint`);
            continue;
          } else {
            console.log(`[${correlationId}] Polling attempt ${attempt} failed with status: ${statusResponse.status} at ${statusEndpoint}`);
            break;
          }
        } catch (pollError) {
          console.error(`[${correlationId}] Polling attempt ${attempt} error at ${statusEndpoint}:`, pollError);
        }
      }
    }

    // Timeout - eSIM not allocated within 1 minute
    console.error(`[${correlationId}] Timeout: eSIM not allocated within 1 minute`);
    await logTrace(supabaseClient, 'esim_allocation_timeout', { order_id, maya_order_id: orderId }, correlationId);
    await issueRefund(supabaseClient, order_id, 'eSIM allocation timeout');

    return new Response(
      JSON.stringify({ error: 'eSIM allocation timeout', order_id, correlation_id: correlationId }),
      { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const correlationId = crypto.randomUUID();
    console.error(`[${correlationId}] Unexpected error in create-maya-esim:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        correlation_id: correlationId
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});