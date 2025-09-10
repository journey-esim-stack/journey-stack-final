import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { plan_id, order_id } = await req.json();
    console.log('Request payload:', { plan_id, order_id });
    
    if (!plan_id || !order_id) {
      console.error('Missing required fields:', { plan_id, order_id });
      return new Response(JSON.stringify({ error: 'plan_id and order_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('esim_plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'Plan not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessCode = Deno.env.get('ESIMACCESS_ACCESS_CODE');
    const secretKey = Deno.env.get('ESIMACCESS_SECRET_KEY');

    if (!accessCode || !secretKey) {
      return new Response(JSON.stringify({ error: 'eSIM Access credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create eSIM via eSIM Access API
    const response = await fetch('https://api.esimaccess.com/api/v1/esim/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_code: accessCode,
        secret_key: secretKey,
        plan_id: plan.supplier_plan_id,
        quantity: 1
      }),
    });

    const esimData = await response.json();
    
    if (!response.ok) {
      console.error('eSIM Access API error:', esimData);
      return new Response(JSON.stringify({ error: 'Failed to create eSIM', details: esimData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update the order with eSIM details
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'completed',
        esim_iccid: esimData.iccid,
        esim_qr_code: esimData.qr_code,
        activation_code: esimData.activation_code,
        supplier_order_id: esimData.order_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Failed to update order:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update order' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      iccid: esimData.iccid,
      order_id: order_id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-esim function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});