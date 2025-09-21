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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { plan_id, order_id } = await req.json();
    console.log(`Creating Maya eSIM for plan_id: ${plan_id}, order_id: ${order_id}`);

    if (!plan_id || !order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing plan_id or order_id' }),
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
      console.error('Maya eSIM creation failed:', errorMsg);
      
      // Update order status to failed
      await supabaseClient
        .from('orders')
        .update({ status: 'failed', real_status: errorMsg })
        .eq('id', order_id);

      await issueRefund(supabaseClient, order_id, errorMsg);
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: createResponse.status, headers: corsHeaders }
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

    // Update order with eSIM details
    const updateData: any = {
      status: 'completed',
      esim_iccid: esim.iccid,
      esim_qr_code: esim.activation_code,
      activation_code: esim.activation_code,
      manual_code: esim.manual_code,
      smdp_address: esim.smdp_address,
      supplier_order_id: esim.uid,
      real_status: `state: ${esim.state}, service: ${esim.service_status}, network: ${esim.network_status}`
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