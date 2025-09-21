import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log('Starting real-time Maya sync...');

    // Get all Maya eSIMs that need status updates
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        esim_iccid,
        status,
        real_status,
        esim_plans!inner(supplier_name)
      `)
      .eq('esim_plans.supplier_name', 'maya')
      .not('esim_iccid', 'is', null);

    if (ordersError) {
      console.error('Error fetching Maya orders:', ordersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Maya orders' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`Found ${orders?.length || 0} Maya eSIMs to sync`);

    const auth = btoa(`${mayaApiKey}:${mayaApiSecret}`);
    const updates = [];

    // Fetch status for each Maya eSIM
    for (const order of orders || []) {
      try {
        console.log(`Fetching status for ICCID: ${order.esim_iccid}`);
        
        const statusResponse = await fetch(`${mayaApiUrl}/connectivity/v1/esim/${order.esim_iccid}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        });

        if (!statusResponse.ok) {
          console.error(`Failed to fetch status for ${order.esim_iccid}: ${statusResponse.status}`);
          continue;
        }

        const statusResult = await statusResponse.json();
        
        if (statusResult.result === 1 && statusResult.esim) {
          const esim = statusResult.esim;
          
          // Map Maya status to our display format
          let displayStatus = 'Unknown';
          if (esim.service_status === 'inactive' || esim.network_status === 'DISABLED') {
            displayStatus = 'Expired / Suspended';
          } else if (esim.state === 'RELEASED' && esim.service_status === 'active' && esim.network_status === 'ENABLED') {
            displayStatus = 'Activated / Active';
          } else if (esim.state === 'RELEASED' && esim.service_status === 'active' && esim.network_status === 'NOT_ACTIVE') {
            displayStatus = 'Awaiting Activation';
          } else if (esim.state === 'REVOKED' || esim.state === 'DELETED') {
            displayStatus = 'Revoked / Deleted';
          }

          // Update order with latest status
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              real_status: JSON.stringify({
                state: esim.state,
                service_status: esim.service_status,
                network_status: esim.network_status,
                display_status: displayStatus,
                last_updated: new Date().toISOString()
              }),
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);

          if (updateError) {
            console.error(`Error updating order ${order.id}:`, updateError);
          } else {
            updates.push({
              order_id: order.id,
              iccid: order.esim_iccid,
              status: displayStatus,
              maya_data: esim
            });
            console.log(`Updated order ${order.id} with status: ${displayStatus}`);
          }

          // Also update esim_status_events for real-time tracking
          await supabase
            .from('esim_status_events')
            .insert({
              iccid: order.esim_iccid,
              event_type: 'status_sync',
              esim_status: displayStatus,
              smdp_status: esim.network_status,
              created_at: new Date().toISOString()
            });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error);
      }
    }

    console.log(`Successfully synced ${updates.length} Maya eSIMs`);

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: updates.length,
        updates: updates
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in realtime-maya-sync:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});