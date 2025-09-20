import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Provider Retry Service Started ===');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all orders that need retry due to provider being busy
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .eq('real_status', 'provider_busy_retry_scheduled')
      .order('created_at', { ascending: true })
      .limit(10); // Process max 10 at a time

    if (ordersError) {
      console.error('Error fetching pending orders:', ordersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch orders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      console.log('No orders need retry');
      return new Response(
        JSON.stringify({ message: 'No orders to retry', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingOrders.length} orders to retry`);
    const results = [];

    for (const order of pendingOrders) {
      try {
        console.log(`Retrying order ${order.id}...`);
        
        // Clear the retry flag
        await supabase
          .from('orders')
          .update({ 
            real_status: null,
            updated_at: new Date().toISOString() 
          })
          .eq('id', order.id);

        // Retry the eSIM creation
        const { data: retryResult, error: retryError } = await supabase.functions.invoke('create-esim', {
          body: { 
            plan_id: order.plan_id, 
            order_id: order.id 
          }
        });

        if (retryError) {
          console.error(`Retry failed for order ${order.id}:`, retryError);
          results.push({ order_id: order.id, status: 'retry_failed', error: retryError.message });
        } else {
          console.log(`Retry successful for order ${order.id}`);
          results.push({ order_id: order.id, status: 'retry_successful' });
        }

        // Add delay between retries to avoid overwhelming the provider
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error processing retry for order ${order.id}:`, error);
        results.push({ order_id: order.id, status: 'retry_error', error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} retry attempts`,
        processed: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Provider retry service error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});