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
    console.log('=== Migrate eSIM QR Codes Function Started ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Query all orders with eSIM Access QR URLs (containing 'qrsim.net')
    const { data: orders, error: queryError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        esim_iccid,
        esim_qr_code,
        plan_id,
        esim_plans!inner(supplier_name)
      `)
      .eq('esim_plans.supplier_name', 'esim_access')
      .like('esim_qr_code', '%qrsim.net%')
      .not('esim_iccid', 'is', null);

    if (queryError) {
      console.error('Failed to query orders:', queryError);
      return new Response(JSON.stringify({ 
        error: 'Failed to query orders', 
        details: queryError 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${orders?.length || 0} orders with eSIM Access QR URLs to migrate`);

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No orders need migration',
        migrated: 0,
        failed: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let successCount = 0;
    let failCount = 0;
    const failedOrders: any[] = [];

    // Process each order
    for (const order of orders) {
      try {
        console.log(`Processing order ${order.id}, ICCID: ${order.esim_iccid}`);
        
        // Download QR image from original URL
        const qrResponse = await fetch(order.esim_qr_code);
        if (!qrResponse.ok) {
          console.error(`Failed to download QR for order ${order.id}: ${qrResponse.status}`);
          failCount++;
          failedOrders.push({
            order_id: order.id,
            iccid: order.esim_iccid,
            error: `Download failed: ${qrResponse.status}`,
          });
          continue;
        }

        const qrBlob = await qrResponse.blob();
        const qrPath = `esim-qr/${order.esim_iccid}.png`;
        
        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('qr-codes')
          .upload(qrPath, qrBlob, { 
            contentType: 'image/png', 
            upsert: true,
            cacheControl: '3600'
          });
        
        if (uploadError) {
          console.error(`Failed to upload QR for order ${order.id}:`, uploadError);
          failCount++;
          failedOrders.push({
            order_id: order.id,
            iccid: order.esim_iccid,
            error: `Upload failed: ${uploadError.message}`,
          });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabaseClient.storage
          .from('qr-codes')
          .getPublicUrl(qrPath);

        // Update order with new Supabase URL
        const { error: updateError } = await supabaseClient
          .from('orders')
          .update({
            esim_qr_code: urlData.publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Failed to update order ${order.id}:`, updateError);
          failCount++;
          failedOrders.push({
            order_id: order.id,
            iccid: order.esim_iccid,
            error: `Update failed: ${updateError.message}`,
          });
          continue;
        }

        console.log(`✓ Successfully migrated order ${order.id}`);
        successCount++;

      } catch (error) {
        console.error(`Unexpected error processing order ${order.id}:`, error);
        failCount++;
        failedOrders.push({
          order_id: order.id,
          iccid: order.esim_iccid,
          error: error.message || 'Unknown error',
        });
      }
    }

    console.log('=== Migration Complete ===');
    console.log(`Total: ${orders.length}, Success: ${successCount}, Failed: ${failCount}`);

    return new Response(JSON.stringify({
      success: true,
      total: orders.length,
      migrated: successCount,
      failed: failCount,
      failedOrders: failedOrders.length > 0 ? failedOrders : undefined,
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
