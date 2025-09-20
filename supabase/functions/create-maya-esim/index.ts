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

  for (const endpoint of authEndpoints) {
    try {
      console.log(`[${correlationId}] Attempting OAuth at: ${endpoint}`);
      
      const tokenResponse = await fetch(endpoint, {
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
        console.log(`[${correlationId}] OAuth success at: ${endpoint}`);
        return tokenData.access_token;
      }
    } catch (error) {
      console.log(`[${correlationId}] OAuth failed at ${endpoint}:`, error);
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

    // Ensure we use the latest active Maya plan (in case product UID rotated)
    let planToUse = plan;
    if (plan.supplier_name === 'maya') {
      try {
        const { data: latestList } = await supabaseClient
          .from('esim_plans')
          .select('*')
          .eq('supplier_name', 'maya')
          .eq('title', plan.title)
          .eq('validity_days', plan.validity_days)
          .eq('country_code', plan.country_code)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1);
        const latest = latestList && latestList.length > 0 ? latestList[0] : null;
        if (latest && latest.id !== plan.id) {
          planToUse = latest;
          console.log(`[${correlationId}] Switched to latest Maya plan id ${latest.id} (product ${latest.supplier_plan_id})`);
          // Update order to reference the latest plan id
          await supabaseClient.from('orders').update({ plan_id: latest.id }).eq('id', order_id);
        }
      } catch (e) {
        console.log(`[${correlationId}] Latest plan lookup skipped/failed:`, e);
      }
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
    
    // Resolve current Maya product UID from products API to avoid stale IDs
    const authHeader = accessToken
      ? `Bearer ${accessToken}`
      : `Basic ${btoa(`${mayaApiKey}:${mayaApiSecret}`)}`;

    let resolvedProductUid = planToUse.supplier_plan_id.replace('maya_', '');
    try {
      const regionSlug = (planToUse.country_name || '').toLowerCase().split(' ')[0]; // e.g., "caucasus", "europe"
      if (regionSlug) {
        const productsUrl = `${mayaApiUrl}/connectivity/v1/account/products?region=${regionSlug}`;
        console.log(`[${correlationId}] Fetching Maya products for region: ${regionSlug} -> ${productsUrl}`);
        const prodRes = await fetch(productsUrl, {
          method: 'GET',
          headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
        });
        const prodText = await prodRes.text();
        let prodJson: any = {};
        try { prodJson = JSON.parse(prodText); } catch { prodJson = { raw: prodText }; }
        const products = Array.isArray(prodJson?.products) ? prodJson.products : [];
        // Try exact name match first
        let match = products.find((p: any) => (p?.name || '').trim() === (planToUse.title || '').trim());
        // Fallback: match by validity and data quota
        if (!match) {
          const parseMb = (s: string) => {
            if (!s) return 0;
            const m = s.toLowerCase().trim();
            if (m.includes('gb')) return Math.round(parseFloat(m) * 1024);
            const n = parseInt(m);
            return isNaN(n) ? 0 : n;
          };
          const targetMb = parseMb(String(planToUse.data_amount));
          const targetValidity = Number(planToUse.validity_days) || 0;
          match = products.find((p: any) => {
            const mb = Number(p?.data_quota_mb) || 0;
            const vd = Number(p?.validity_days) || 0;
            return vd === targetValidity && (targetMb === 0 || Math.abs(mb - targetMb) <= 50);
          });
        }
        if (match?.uid) {
          resolvedProductUid = match.uid;
          console.log(`[${correlationId}] Resolved product UID: ${resolvedProductUid} for title ${planToUse.title}`);
        } else {
          console.log(`[${correlationId}] No matching product found, using plan UID ${resolvedProductUid}`);
        }
      }
    } catch (e) {
      console.log(`[${correlationId}] Product UID resolution failed, using plan UID ${resolvedProductUid}:`, e);
    }

    // Create the Maya API request with correct structure
    const mayaRequestPayload = {
      items: [
        {
          product_uid: resolvedProductUid,
          quantity: 1
        }
      ],
      external_reference: order_id,
      channel: 'api'
    };

    console.log(`[${correlationId}] Maya API Request payload:`, mayaRequestPayload);

    // Set up authentication headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader
    };

    if (accessToken) {
      console.log(`[${correlationId}] Using OAuth Bearer token`);
    } else {
      console.log(`[${correlationId}] Using Basic Auth fallback`);
    }

    // Try account-scoped endpoint first, then fallback
    const endpoints = [
      `${mayaApiUrl}/connectivity/v1/account/orders`,
      `${mayaApiUrl}/connectivity/v1/orders`
    ];

    let mayaResponse: Response | null = null;
    let mayaResponseData: any = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`[${correlationId}] Attempting request to: ${endpoint}`);
        
        mayaResponse = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(mayaRequestPayload)
        });

        console.log(`[${correlationId}] Response status: ${mayaResponse.status} from ${endpoint}`);
        console.log(`[${correlationId}] Response headers:`, Object.fromEntries(mayaResponse.headers.entries()));

        const responseText = await mayaResponse.text();
        console.log(`[${correlationId}] Raw response:`, responseText);

        try {
          mayaResponseData = JSON.parse(responseText);
          console.log(`[${correlationId}] Parsed response data:`, mayaResponseData);
        } catch (parseError) {
          console.error(`[${correlationId}] Failed to parse response as JSON:`, parseError);
          mayaResponseData = { error: 'Invalid JSON response', raw_response: responseText };
        }

        if (mayaResponse.ok) {
          console.log(`[${correlationId}] Success with endpoint: ${endpoint}`);
          break;
        } else if (mayaResponse.status === 404 && endpoint === endpoints[0]) {
          console.log(`[${correlationId}] 404 on account endpoint, trying direct endpoint`);
          continue;
        } else {
          console.error(`[${correlationId}] Error with endpoint ${endpoint}:`, mayaResponseData);
          break;
        }
      } catch (error) {
        console.error(`[${correlationId}] Request failed for ${endpoint}:`, error);
        if (endpoint === endpoints[endpoints.length - 1]) {
          throw error;
        }
      }
    }

    if (!mayaResponse || !mayaResponse.ok) {
      console.error(`[${correlationId}] Maya API error response:`, mayaResponseData);
      console.error(`[${correlationId}] Maya API error - Status:`, mayaResponse?.status);

      // If 404, try a one-time fallback to a close alternative active Maya plan (same region/data)
      let retried = false;
      if (mayaResponse?.status === 404) {
        try {
          const basePrefix = (planToUse.title || '').split('-')[0].trim(); // e.g., "Caucasus+ 1GB"
          const { data: candidates } = await supabaseClient
            .from('esim_plans')
            .select('*')
            .eq('supplier_name', 'maya')
            .eq('is_active', true)
            .eq('country_code', planToUse.country_code)
            .ilike('title', `${basePrefix}%`)
            .order('updated_at', { ascending: false })
            .limit(5);

          const alternative = (candidates || []).find(c => c.id !== planToUse.id);
          if (alternative) {
            console.log(`[${correlationId}] Retrying with alternative Maya plan ${alternative.id} (${alternative.supplier_plan_id})`);
            await supabaseClient.from('orders').update({ plan_id: alternative.id }).eq('id', order_id);
            planToUse = alternative;

            const retryPayload = {
              items: [{ product_uid: alternative.supplier_plan_id.replace('maya_', ''), quantity: 1 }],
              external_reference: order_id,
              channel: 'api'
            };

            for (const endpoint of endpoints) {
              try {
                console.log(`[${correlationId}] Retry request to: ${endpoint}`);
                const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(retryPayload) });
                const t = await r.text();
                try { mayaResponseData = JSON.parse(t); } catch (_) { mayaResponseData = { raw_response: t }; }
                if (r.ok) {
                  mayaResponse = r;
                  retried = true;
                  console.log(`[${correlationId}] Retry succeeded at: ${endpoint}`);
                  break;
                }
                if (r.status === 404 && endpoint === endpoints[0]) continue;
              } catch (e) {
                console.error(`[${correlationId}] Retry request failed:`, e);
              }
            }
          }
        } catch (fallbackErr) {
          console.log(`[${correlationId}] Fallback plan search failed:`, fallbackErr);
        }
      }

      if (!mayaResponse || !mayaResponse.ok) {
        const errorDetails = mayaResponseData?.developer_message || mayaResponseData?.message || mayaResponseData?.error || 'Unknown error';

        await logTrace(supabaseClient, 'maya_api_error', {
          status: mayaResponse?.status,
          response: mayaResponseData,
          order_id,
          error_details: errorDetails,
          retried
        }, correlationId);

        // Issue refund for failed order
        await issueRefund(supabaseClient, order_id, 'Service temporarily unavailable');

        return new Response(
          JSON.stringify({
            error: 'Failed to create eSIM',
            details: errorDetails,
            correlation_id: correlationId
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

    // Poll for eSIM allocation (30 attempts, 2 seconds each = 1 minute total)
    for (let attempt = 1; attempt <= 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
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