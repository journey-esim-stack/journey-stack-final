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

    const { iccid } = await req.json();
    
    if (!iccid) {
      return new Response(JSON.stringify({ error: 'ICCID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-esim-status] Syncing status for ICCID: ${iccid}`);

    // Get order to determine supplier
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        esim_iccid,
        plan_id,
        esim_plans (
          supplier_name
        )
      `)
      .eq('esim_iccid', iccid)
      .single();

    if (orderError || !order) {
      console.error('[sync-esim-status] Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supplierName = String(order.esim_plans?.supplier_name || '').toLowerCase();
    const isMaya = supplierName === 'maya';
    
    console.log(`[sync-esim-status] Supplier: ${supplierName}, isMaya: ${isMaya}`);

    let statusData;
    let updatePayload: any = {};

    if (isMaya) {
      // Call Maya API
      const { data, error } = await supabaseClient.functions.invoke('get-maya-esim-status', {
        body: { iccid }
      });

      if (error || !data?.success) {
        console.error('[sync-esim-status] Maya API error:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch Maya status',
          details: error 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      statusData = data.status;
      
      // Store Maya status as JSON
      updatePayload.real_status = JSON.stringify({
        state: statusData.state,
        service_status: statusData.service_status,
        network_status: statusData.network_status
      });

      // Only set expiry if network is ENABLED and state is not RELEASED
      if (statusData.network_status === 'ENABLED' && statusData.state !== 'RELEASED') {
        if (statusData.plan?.end_time) {
          updatePayload.esim_expiry_date = statusData.plan.end_time;
        }
      }
    } else {
      // Call eSIM Access API
      const { data, error } = await supabaseClient.functions.invoke('get-esim-details', {
        body: { iccid }
      });

      if (error || !data?.success) {
        console.error('[sync-esim-status] eSIM Access API error:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch eSIM Access status',
          details: error 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      statusData = data.obj;
      
      if (statusData) {
        // Store eSIM Access status
        updatePayload.real_status = statusData.status;

        // Set expiry if active
        if (statusData.status === 'IN_USE' && statusData.plan?.expiresAt) {
          updatePayload.esim_expiry_date = statusData.plan.expiresAt;
        }
      }
    }

    // Update order with latest status
    const { data: updatedOrder, error: updateError } = await supabaseClient
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) {
      console.error('[sync-esim-status] Update error:', updateError);
      return new Response(JSON.stringify({ 
        error: 'Failed to update order status',
        details: updateError 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-esim-status] Successfully synced status for ICCID: ${iccid}`);

    return new Response(JSON.stringify({
      success: true,
      order: updatedOrder,
      statusData: statusData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-esim-status] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
