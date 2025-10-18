import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    )

    console.log("Fetching admin inventory data...")

    // Fetch orders with explicit joins
    const { data: orders, error: ordersError } = await supabaseClient
      .from("orders")
      .select(`
        *,
        agent_profiles!orders_agent_id_fkey(id, company_name, contact_person),
        esim_plans!orders_plan_id_fkey(title, country_name, data_amount, supplier_name)
      `)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Orders error:", ordersError);
      throw ordersError;
    }

    console.log("Orders fetched:", orders?.length || 0);

    // Transform the data
    const inventoryData = (orders || []).map((order: any) => ({
      id: order.id,
      agent_id: order.agent_id,
      agent_name: order.agent_profiles?.contact_person || 'Unknown',
      company_name: order.agent_profiles?.company_name || 'Unknown Company',
      esim_iccid: order.esim_iccid || 'Pending',
      plan_id: order.plan_id,
      plan_title: order.esim_plans?.title || 'Unknown Plan',
      country_name: order.esim_plans?.country_name || 'Unknown',
      data_amount: order.esim_plans?.data_amount || 'Unknown',
      retail_price: order.retail_price,
      wholesale_price: order.wholesale_price,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      activation_code: order.activation_code,
      supplier_order_id: order.supplier_order_id,
      supplier_name: order.esim_plans?.supplier_name || 'esim_access'
    }));

    console.log("Inventory data transformed:", inventoryData.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: inventoryData,
        count: inventoryData.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})