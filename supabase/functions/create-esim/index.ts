import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const accessCode = Deno.env.get('PROVIDER_ACCESS_CODE');
    const secretKey = Deno.env.get('PROVIDER_SECRET_KEY');

    console.log('Environment variables check:', {
      hasAccessCode: !!accessCode,
      hasSecretKey: !!secretKey,
      accessCodeLength: accessCode?.length || 0,
      secretKeyLength: secretKey?.length || 0
    });

    if (!accessCode || !secretKey) {
      console.error('Missing service credentials');
      return new Response(JSON.stringify({ error: 'Service credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Creating eSIM with provider API...');
    console.log('Plan supplier_plan_id:', plan.supplier_plan_id);

    // Place order via provider API (v1 OPEN endpoint)
    const orderPayload = {
      transactionId: order_id, // use our DB order id as the unique transaction id
      packageInfoList: [
        {
          packageCode: plan.supplier_plan_id,
          count: 1,
        }
      ]
    };
    console.log('Order Request payload:', { ...orderPayload });

    const providerApiUrl = Deno.env.get('PROVIDER_API_URL');
    const orderRes = await fetch(`${providerApiUrl}/api/v1/open/esim/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'RT-AccessCode': accessCode,
        'RT-SecretKey': secretKey,
      },
      body: JSON.stringify(orderPayload),
    });

    console.log('Order API Response status:', orderRes.status);
    console.log('Order API Response headers:', Object.fromEntries(orderRes.headers.entries()));

    // Check if response is HTML (404 error page) instead of JSON
    const contentType = orderRes.headers.get('content-type');
    if (contentType?.includes('text/html')) {
      console.error('Provider API returned HTML instead of JSON - likely 404 or service down');
      
      // Update order status to failed
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', order_id);

      // Issue automatic refund to agent's wallet
      await issueRefund(supabaseClient, order_id, 'eSIM provider service unavailable');

      return new Response(JSON.stringify({
        error: 'Provider API service is currently unavailable',
        details: 'The eSIM provider service is down. Your payment has been refunded.',
        status: orderRes.status,
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let orderJson;
    try {
      orderJson = await orderRes.json();
    } catch (parseError) {
      console.error('Failed to parse provider API response as JSON:', parseError);
      
      // Update order status to failed
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', order_id);

      // Issue automatic refund to agent's wallet  
      await issueRefund(supabaseClient, order_id, 'Failed to parse provider response');

      return new Response(JSON.stringify({
        error: 'Provider API returned invalid response',
        details: 'Unable to parse provider response. Your payment has been refunded.',
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Order API Response data:', orderJson);

    if (!orderRes.ok || !orderJson?.success) {
      console.error('Provider Order API error - Status:', orderRes.status);
      console.error('Provider Order API error response:', orderJson);
      
      // Update order status to failed
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', order_id);

      // Issue automatic refund to agent's wallet
      await issueRefund(supabaseClient, order_id, orderJson?.message || 'Service temporarily unavailable');

      return new Response(JSON.stringify({
        error: 'Failed to place eSIM order',
        details: `${orderJson?.message || 'Service temporarily unavailable'}. Your payment has been refunded.`,
        status: orderRes.status,
        supplier_plan_id: plan.supplier_plan_id,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderNo: string | undefined = orderJson?.obj?.orderNo;
    if (!orderNo) {
      console.error('Order API did not return orderNo');
      return new Response(JSON.stringify({
        error: 'No orderNo returned from supplier',
        details: orderJson,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Order placed successfully. orderNo:', orderNo, 'Now polling for allocated profiles...');

    // Poll the Query endpoint until profiles are allocated (up to ~30s)
    const maxAttempts = 10; // 10 * 3s = 30s
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    let esimProfile: any | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const queryPayload = {
        orderNo,
        pager: { pageNum: 1, pageSize: 50 },
      };

      console.log(`Query attempt ${attempt}/${maxAttempts} for orderNo:`, orderNo);
      const queryRes = await fetch(`${providerApiUrl}/api/v1/open/esim/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'RT-AccessCode': accessCode,
          'RT-SecretKey': secretKey,
        },
        body: JSON.stringify(queryPayload),
      });

      const queryJson = await queryRes.json();
      console.log('Query API Response status:', queryRes.status);
      console.log('Query API Response data:', queryJson);

      // success && has esimList
      const list = queryJson?.obj?.esimList;
      if (queryRes.ok && queryJson?.success && Array.isArray(list) && list.length > 0) {
        esimProfile = list[0];
        break;
      }

      // If still allocating (common error 200010) or empty list – wait and retry
      await delay(3000);
    }

    if (!esimProfile) {
      console.error('Profiles not allocated in time for orderNo:', orderNo);
      
      // Update order status to failed due to timeout
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', order_id);

      // Issue automatic refund to agent's wallet
      await issueRefund(supabaseClient, order_id, 'eSIM allocation timeout');

      return new Response(JSON.stringify({
        error: 'eSIM allocation timeout',
        details: 'Profiles not allocated in time. Your payment has been refunded.',
        orderNo,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('eSIM profile allocated:', {
      iccid: esimProfile.iccid,
      hasQRCodeUrl: !!esimProfile.qrCodeUrl,
      hasActivationCode: !!esimProfile.ac,
      orderNo,
    });

    // Download and re-host QR code to Supabase to hide supplier identity
    let finalQrCodeUrl = esimProfile.qrCodeUrl;
    if (esimProfile.qrCodeUrl) {
      try {
        console.log('Re-hosting QR code from provider to Supabase storage...');
        
        // Download QR image from provider
        const qrResponse = await fetch(esimProfile.qrCodeUrl);
        if (qrResponse.ok) {
          const qrBlob = await qrResponse.blob();
          const qrPath = `esim-qr/${esimProfile.iccid}.png`;
          
          // Upload to Supabase storage
          const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('qr-codes')
            .upload(qrPath, qrBlob, { 
              contentType: 'image/png', 
              upsert: true,
              cacheControl: '3600'
            });
          
          if (!uploadError && uploadData) {
            const { data: urlData } = supabaseClient.storage
              .from('qr-codes')
              .getPublicUrl(qrPath);
            finalQrCodeUrl = urlData.publicUrl;
            console.log(`QR code re-hosted successfully for ICCID ${esimProfile.iccid}`);
          } else {
            console.error('QR upload error:', uploadError);
          }
        } else {
          console.error('Failed to download QR from provider:', qrResponse.status);
        }
      } catch (error) {
        console.error('QR re-hosting failed, using original URL:', error);
        // Fallback to original URL if re-hosting fails
      }
    }

    // Update the order with eSIM details
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'completed',
        esim_iccid: esimProfile.iccid,
        esim_qr_code: finalQrCodeUrl,
        activation_code: esimProfile.ac,
        supplier_order_id: orderNo,
        updated_at: new Date().toISOString(),
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
      iccid: esimProfile.iccid,
      order_id: order_id,
      supplier_order_no: orderNo,
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