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

    const accessCode = Deno.env.get('ESIMACCESS_ACCESS_CODE');
    const secretKey = Deno.env.get('ESIMACCESS_SECRET_KEY');

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

    // Place order via eSIM Access API (v1 OPEN endpoint)
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

    const orderRes = await fetch('https://api.esimaccess.com/api/v1/open/esim/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'RT-AccessCode': accessCode,
      },
      body: JSON.stringify(orderPayload),
    });

    console.log('Order API Response status:', orderRes.status);
    console.log('Order API Response headers:', Object.fromEntries(orderRes.headers.entries()));

    const orderJson = await orderRes.json();
    console.log('Order API Response data:', orderJson);

    if (!orderRes.ok || !orderJson?.success) {
      console.error('Provider Order API error - Status:', orderRes.status);
      console.error('Provider Order API error');
      return new Response(JSON.stringify({
        error: 'Failed to place eSIM order',
        details: 'Service temporarily unavailable',
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
      const queryRes = await fetch('https://api.esimaccess.com/api/v1/open/esim/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'RT-AccessCode': accessCode,
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
      return new Response(JSON.stringify({
        error: 'Profiles not allocated yet. Please retry shortly.',
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

    // Update the order with eSIM details
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'completed',
        esim_iccid: esimProfile.iccid,
        esim_qr_code: esimProfile.qrCodeUrl,
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