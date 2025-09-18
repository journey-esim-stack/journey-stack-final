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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const webhook = await req.json();
    console.log('Received webhook:', JSON.stringify(webhook, null, 2));

    const { notifyType, content } = webhook;

    // Handle different webhook types
    switch (notifyType) {
      case 'ORDER_STATUS':
        await handleOrderStatus(supabaseClient, content);
        break;
      
      case 'SMDP_EVENT':
        await handleSmdpEvent(supabaseClient, content);
        break;
      
      case 'ESIM_STATUS':
        await handleEsimStatus(supabaseClient, content);
        break;
      
      default:
        console.log(`Unknown webhook type: ${notifyType}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleOrderStatus(supabaseClient: any, content: any) {
  console.log('Handling ORDER_STATUS:', content);
  
  const { orderStatus, iccid } = content;
  
  if (orderStatus === 'GOT_RESOURCE' && iccid) {
    // Update order status when eSIM is ready
    const { error } = await supabaseClient
      .from('orders')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('esim_iccid', iccid);

    if (error) {
      console.error('Error updating order status:', error);
    } else {
      console.log(`Order status updated for ICCID: ${iccid}`);
    }
  }
}

async function handleSmdpEvent(supabaseClient: any, content: any) {
  console.log('Handling SMDP_EVENT:', content);
  
  const { eid, iccid, esimStatus, smdpStatus } = content;
  
  // Create or update eSIM status record
  const statusData = {
    iccid,
    eid,
    esim_status: esimStatus,
    smdp_status: smdpStatus,
    updated_at: new Date().toISOString(),
    event_type: 'SMDP_EVENT'
  };

  const { error } = await supabaseClient
    .from('esim_status_events')
    .upsert(statusData, { onConflict: 'iccid' });

  if (error) {
    console.error('Error updating SMDP event:', error);
  } else {
    console.log(`SMDP event updated for ICCID: ${iccid}, Status: ${esimStatus}, SMDP: ${smdpStatus}`);
  }

  // Update order real_status if order exists
  if (iccid) {
    const { error: orderError } = await supabaseClient
      .from('orders')
      .update({ 
        real_status: esimStatus,
        updated_at: new Date().toISOString()
      })
      .eq('esim_iccid', iccid);

    if (orderError) {
      console.error('Error updating order real_status:', orderError);
    }
  }
}

async function handleEsimStatus(supabaseClient: any, content: any) {
  console.log('Handling ESIM_STATUS:', content);
  
  const { esimStatus, iccid } = content;
  
  // Create or update eSIM status record
  const statusData = {
    iccid,
    esim_status: esimStatus,
    updated_at: new Date().toISOString(),
    event_type: 'ESIM_STATUS'
  };

  const { error } = await supabaseClient
    .from('esim_status_events')
    .upsert(statusData, { onConflict: 'iccid' });

  if (error) {
    console.error('Error updating eSIM status:', error);
  } else {
    console.log(`eSIM status updated for ICCID: ${iccid}, Status: ${esimStatus}`);
  }

  // Update order real_status
  if (iccid) {
    const updateData: any = { 
      real_status: esimStatus,
      updated_at: new Date().toISOString()
    };

    // Set expiry date when eSIM becomes active
    if (esimStatus === 'IN_USE') {
      // Fetch plan validity days
      const { data: orderData } = await supabaseClient
        .from('orders')
        .select('esim_plans(validity_days)')
        .eq('esim_iccid', iccid)
        .single();

      if (orderData?.esim_plans?.validity_days) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + orderData.esim_plans.validity_days);
        updateData.esim_expiry_date = expiryDate.toISOString();
      }
    }

    const { error: orderError } = await supabaseClient
      .from('orders')
      .update(updateData)
      .eq('esim_iccid', iccid);

    if (orderError) {
      console.error('Error updating order status:', orderError);
    }
  }
}