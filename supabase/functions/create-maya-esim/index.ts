import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function issueRefund(supabaseClient: any, orderId: string, reason: string) {
  console.log(`Starting refund process for order ${orderId}. Reason: ${reason}`);
  
  try {
    // Check if refund already exists
    const { data: existingRefund } = await supabaseClient
      .from('wallet_transactions')
      .select('id')
      .eq('reference_id', orderId)
      .eq('transaction_type', 'refund')
      .single();

    if (existingRefund) {
      console.log(`Refund already exists for order ${orderId}`);
      return;
    }

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('agent_id, retail_price')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Failed to fetch order for refund:', orderError);
      return;
    }

    // Get agent profile
    const { data: agentProfile, error: agentError } = await supabaseClient
      .from('agent_profiles')
      .select('wallet_balance')
      .eq('id', order.agent_id)
      .single();

    if (agentError || !agentProfile) {
      console.error('Failed to fetch agent profile for refund:', agentError);
      return;
    }

    const newBalance = Number(agentProfile.wallet_balance) + Number(order.retail_price);

    // Update agent balance
    const { error: updateError } = await supabaseClient
      .from('agent_profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', order.agent_id);

    if (updateError) {
      console.error('Failed to update agent balance for refund:', updateError);
      return;
    }

    // Record refund transaction
    const { error: transactionError } = await supabaseClient
      .from('wallet_transactions')
      .insert({
        agent_id: order.agent_id,
        amount: order.retail_price,
        transaction_type: 'refund',
        description: `Refund for failed eSIM creation: ${reason}`,
        reference_id: orderId,
        balance_after: newBalance
      });

    if (transactionError) {
      console.error('Failed to record refund transaction:', transactionError);
    } else {
      console.log(`Refund of ${order.retail_price} completed for order ${orderId}`);
    }
  } catch (error) {
    console.error('Error in refund process:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { plan_id, order_id, correlationId } = body;
    console.log(`Creating Maya eSIM for plan_id: ${plan_id}, order_id: ${order_id}, correlation: ${correlationId}`);

    // Input validation
    if (!plan_id || typeof plan_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid plan_id is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!order_id || typeof order_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid order_id is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify order exists and is valid
    const { data: orderCheck, error: orderCheckError } = await supabaseClient
      .from('orders')
      .select('id, status, agent_id')
      .eq('id', order_id)
      .single();

    if (orderCheckError || !orderCheck) {
      console.error('Order verification failed:', orderCheckError);
      return new Response(
        JSON.stringify({ error: 'Order not found or invalid' }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (orderCheck.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Order is not in pending status' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('esim_plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      console.error('Plan not found:', planError);
      await issueRefund(supabaseClient, order_id, 'Plan not found');
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Extract Maya product ID from supplier_plan_id (format: maya_{product_uid})
    const mayaProductId = plan.supplier_plan_id.replace('maya_', '');
    console.log(`Using Maya product ID: ${mayaProductId}`);

    // Prepare Maya API request
    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL') || 'https://api.maya.net';

    if (!mayaApiKey || !mayaApiSecret) {
      console.error('Maya API credentials not found');
      await issueRefund(supabaseClient, order_id, 'Maya API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Maya API credentials not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const auth = btoa(`${mayaApiKey}:${mayaApiSecret}`);
    
    // Create eSIM with plan
    const createResponse = await fetch(`${mayaApiUrl}/connectivity/v1/esim`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        plan_type_id: mayaProductId,
        tag: order_id
      })
    });

    const createResult = await createResponse.json();
    console.log('Maya create response:', createResult);

    if (!createResponse.ok || createResult.result !== 1) {
      const errorMsg = createResult.developer_message || createResult.message || 'Maya eSIM creation failed';
      const errorCode = createResult.errorCode || createResult.error_code;
      console.error('Maya eSIM creation failed:', { errorMsg, errorCode, response: createResult });
      
      // Handle specific Maya API errors with user-friendly messages
      let userFriendlyError = errorMsg;
      let statusCode = 500;
      
      if (errorCode === '101013' || errorMsg.includes('system is busy')) {
        userFriendlyError = 'eSIM provider is temporarily busy. Please try again in a few minutes.';
        statusCode = 503; // Service Unavailable
      } else if (errorCode === '101001' || errorMsg.includes('authentication')) {
        userFriendlyError = 'eSIM service authentication error. Please contact support.';
        statusCode = 502; // Bad Gateway
      } else if (errorCode === '101002' || errorMsg.includes('insufficient')) {
        userFriendlyError = 'eSIM service temporarily out of stock. Please try again later.';
        statusCode = 503; // Service Unavailable
      } else if (createResponse.status >= 500) {
        userFriendlyError = 'eSIM provider service error. Please try again in a few minutes.';
        statusCode = 503; // Service Unavailable
      } else if (createResponse.status === 404) {
        userFriendlyError = 'eSIM plan not available. Please select a different plan.';
        statusCode = 404;
      }
      
      // Update order status to failed with detailed error info
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'failed', 
          real_status: `Maya Error ${errorCode}: ${errorMsg}`,
          failure_reason: userFriendlyError
        })
        .eq('id', order_id);

      await issueRefund(supabaseClient, order_id, userFriendlyError);
      
      return new Response(
        JSON.stringify({ error: userFriendlyError, provider_error: errorMsg }),
        { status: statusCode, headers: corsHeaders }
      );
    }

    const esim = createResult.esim;
    if (!esim) {
      console.error('No eSIM data in Maya response');
      await issueRefund(supabaseClient, order_id, 'No eSIM data in response');
      return new Response(
        JSON.stringify({ error: 'No eSIM data in response' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Update order with eSIM details using standardized JSON format
    const updateData: any = {
      status: 'completed',
      esim_iccid: esim.iccid,
      esim_qr_code: esim.activation_code,
      activation_code: esim.activation_code,
      manual_code: esim.manual_code,
      smdp_address: esim.smdp_address,
      supplier_order_id: esim.uid,
      real_status: JSON.stringify({
        state: esim.state || 'UNKNOWN',
        service_status: esim.service_status || 'UNKNOWN',
        network_status: esim.network_status || 'UNKNOWN'
      })
    };

    // Set expiry date if plan is included
    if (esim.plan && esim.plan.end_time && esim.plan.end_time !== '0000-00-00 00:00:00') {
      updateData.esim_expiry_date = esim.plan.end_time;
    }

    const { error: updateError } = await supabaseClient
      .from('orders')
      .update(updateData)
      .eq('id', order_id);

    if (updateError) {
      console.error('Failed to update order:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update order' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`Maya eSIM created successfully: ${esim.iccid}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        iccid: esim.iccid,
        activation_code: esim.activation_code,
        manual_code: esim.manual_code,
        smdp_address: esim.smdp_address
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in create-maya-esim:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});