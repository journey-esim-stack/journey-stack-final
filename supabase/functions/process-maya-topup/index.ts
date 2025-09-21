import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const { iccid, package_code, agent_id, amount } = body;
    console.log(`Processing Maya topup: ICCID=${iccid}, package=${package_code}, amount=${amount}`);

    // Input validation
    if (!iccid || typeof iccid !== 'string' || iccid.length < 15 || iccid.length > 22) {
      return new Response(
        JSON.stringify({ error: 'Valid ICCID is required (15-22 digits)' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!package_code || typeof package_code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid package code is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!agent_id || typeof agent_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid agent ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (typeof amount !== 'number' || amount <= 0 || amount > 1000) {
      return new Response(
        JSON.stringify({ error: 'Amount must be between 0 and $1000' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify agent access
    const { data: agentCheck } = await supabaseClient
      .from('agent_profiles')
      .select('id, user_id, status')
      .eq('id', agent_id)
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .single();

    if (!agentCheck) {
      return new Response(
        JSON.stringify({ error: 'Access denied - agent verification failed' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Get agent profile
    const { data: agentProfile, error: agentError } = await supabaseClient
      .from('agent_profiles')
      .select('wallet_balance')
      .eq('id', agent_id)
      .single();

    if (agentError || !agentProfile) {
      return new Response(
        JSON.stringify({ error: 'Agent profile not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check wallet balance
    if (Number(agentProfile.wallet_balance) < Number(amount)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient wallet balance' }),
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

    // Extract Maya product ID from package_code (format: maya_{product_uid})
    const mayaProductId = package_code.replace('maya_', '');
    const auth = btoa(`${mayaApiKey}:${mayaApiSecret}`);

    // Perform topup via Maya API
    const topupResponse = await fetch(`${mayaApiUrl}/connectivity/v1/esim/${iccid}/plan/${mayaProductId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: ''
    });

    const topupResult = await topupResponse.json();
    console.log('Maya topup response:', topupResult);

    if (!topupResponse.ok || topupResult.result !== 1) {
      const errorMsg = topupResult.developer_message || topupResult.message || 'Maya topup failed';
      console.error('Maya topup failed:', errorMsg);
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: topupResponse.status, headers: corsHeaders }
      );
    }

    // Update wallet balance
    const newBalance = Number(agentProfile.wallet_balance) - Number(amount);
    
    const { error: balanceError } = await supabaseClient
      .from('agent_profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', agent_id);

    if (balanceError) {
      console.error('Failed to update wallet balance:', balanceError);
      return new Response(
        JSON.stringify({ error: 'Failed to update wallet balance' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Record wallet transaction
    const { error: transactionError } = await supabaseClient
      .from('wallet_transactions')
      .insert({
        agent_id: agent_id,
        amount: -Number(amount),
        transaction_type: 'debit',
        description: `Maya eSIM topup: ${iccid}`,
        reference_id: topupResult.request_id || `maya_topup_${Date.now()}`,
        balance_after: newBalance
      });

    if (transactionError) {
      console.error('Failed to record transaction:', transactionError);
    }

    // Record topup details
    const plan = topupResult.plan;
    const { error: topupError } = await supabaseClient
      .from('esim_topups')
      .insert({
        iccid: iccid,
        package_code: package_code,
        agent_id: agent_id,
        amount: amount,
        transaction_id: topupResult.request_id || `maya_${Date.now()}`,
        data_amount: plan?.data_quota_bytes ? `${Math.round(plan.data_quota_bytes / (1024 * 1024 * 1024))}GB` : null,
        validity_days: null, // Maya doesn't provide validity in topup response
        status: 'completed'
      });

    if (topupError) {
      console.error('Failed to record topup:', topupError);
    }

    console.log(`Maya topup completed successfully for ICCID: ${iccid}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        new_balance: newBalance,
        transaction_id: topupResult.request_id,
        plan_details: plan
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in process-maya-topup:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});