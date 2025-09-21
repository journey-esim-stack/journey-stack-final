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

    const { iccid, packageCode } = await req.json();
    console.log(`Getting Maya topup plans for ICCID: ${iccid}`);

    if (!iccid) {
      return new Response(
        JSON.stringify({ error: 'Missing ICCID' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get the order to find the country/region
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('plan_id, esim_plans(country_code, country_name)')
      .eq('esim_iccid', iccid)
      .single();

    if (orderError || !order) {
      console.error('Order not found for ICCID:', iccid);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get Maya plans for the same country/region
    let query = supabaseClient
      .from('esim_plans')
      .select('*')
      .eq('supplier_name', 'maya')
      .eq('is_active', true);

    if (order.esim_plans?.country_code) {
      query = query.eq('country_code', order.esim_plans.country_code);
    }

    // If packageCode is provided, filter by it
    if (packageCode) {
      query = query.eq('supplier_plan_id', packageCode);
    }

    const { data: plans, error: plansError } = await query;

    if (plansError) {
      console.error('Error fetching Maya plans:', plansError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch plans' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Get agent profile for markup calculation
    const { data: agentProfile, error: agentError } = await supabaseClient
      .from('agent_profiles')
      .select('markup_type, markup_value, wallet_balance')
      .eq('user_id', user.id)
      .single();

    if (agentError || !agentProfile) {
      return new Response(
        JSON.stringify({ error: 'Agent profile not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Transform plans to topup format with markup
    const topupPlans = plans?.map((plan: any) => {
      let retailPrice = Number(plan.wholesale_price);
      
      if (agentProfile.markup_type === 'percent') {
        retailPrice = retailPrice * (1 + Number(agentProfile.markup_value) / 100);
      } else {
        retailPrice = retailPrice + Number(agentProfile.markup_value);
      }

      return {
        packageCode: plan.supplier_plan_id,
        title: plan.title,
        data_amount: plan.data_amount,
        validity_days: plan.validity_days,
        wholesale_price: plan.wholesale_price,
        retail_price: Number(retailPrice.toFixed(2)),
        currency: plan.currency,
        country_name: plan.country_name,
        country_code: plan.country_code,
        description: plan.description,
      };
    }) || [];

    console.log(`Found ${topupPlans.length} Maya topup plans for ICCID: ${iccid}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        plans: topupPlans,
        wallet_balance: agentProfile.wallet_balance
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in get-maya-topup-plans:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});