import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Trace helper to persist diagnostics even if logs UI is lagging
async function logTrace(supabase: any, action: string, details: any, userId?: string) {
  try {
    await supabase.from('audit_logs').insert({
      table_name: 'wallet_debit',
      action,
      user_id: userId || null,
      new_values: details,
    });
  } catch (e) {
    console.error('audit log insert failed', e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate correlation ID for tracing across functions
    const correlationId = crypto.randomUUID();
    
    const body = await req.json();
    const { amount, description, reference_id, cart_items, customer_info, device_info } = body;

    // Input validation
    if (typeof amount !== "number" || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting check - prevent excessive requests
    if (amount > 10000) {  // $10,000 limit per transaction
      return new Response(JSON.stringify({ error: "Amount exceeds maximum limit" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof amount !== "number" || amount <= 0) {
      throw new Error("amount must be a positive number");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      await logTrace(supabase, 'auth_failed', {
        error: userErr?.message || "Invalid token",
        ip: req.headers.get("x-forwarded-for") || "unknown",
        correlationId
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // Get agent profile
    const { data: profile, error: profileErr } = await supabase
      .from("agent_profiles")
      .select("id, wallet_balance")
      .eq("user_id", user.id)
      .single();
if (profileErr) throw profileErr;

    await logTrace(supabase, 'start', { correlationId, amount, reference_id, cart_items_count: cart_items?.length || 0 }, user.id);

    const currentBalance = Number(profile.wallet_balance);
    if (currentBalance < amount) {
      return new Response(JSON.stringify({ error: "INSUFFICIENT_FUNDS", balance: currentBalance }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 402,
      });
    }

    const newBalance = currentBalance - amount;

    // Update balance
    const { error: updateErr } = await supabase
      .from("agent_profiles")
      .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (updateErr) throw updateErr;

    // Create better description from cart items
    let transactionDescription = description ?? "Cart purchase";
    if (cart_items && Array.isArray(cart_items) && cart_items.length > 0) {
      const planNames = cart_items.map((item: any) => item.title).join(", ");
      transactionDescription = `eSIM purchase: ${planNames}`;
    }

    // Insert transaction
    const { error: insertErr } = await supabase.from("wallet_transactions").insert({
      agent_id: profile.id,
      transaction_type: "purchase", // Use correct enum value
      description: transactionDescription,
      reference_id: reference_id ?? `cart-${Date.now()}`,
      amount: -amount, // Negative for debit/purchase
      balance_after: newBalance,
    });
    if (insertErr) throw insertErr;

    // Create orders if cart_items provided
    let orderIds = [];
    if (cart_items && Array.isArray(cart_items) && cart_items.length > 0) {
      if (!customer_info?.name || !customer_info?.email) {
        throw new Error("customer_info with name and email required for cart checkout");
      }
      
      // Validate all cart items have valid agent prices (Layer 3: Backend Validation)
      for (const item of cart_items) {
        if (!item.agentPrice || item.agentPrice <= 0 || !Number.isFinite(item.agentPrice)) {
          await logTrace(supabase, 'invalid_price_rejected', { 
            item: item.planId, 
            price: item.agentPrice 
          }, user.id);
          
          return new Response(
            JSON.stringify({ 
              error: "Invalid pricing detected. Please refresh and try again.",
              details: "One or more items have invalid pricing."
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }
      }
      
      const orders = cart_items.map((item: any) => ({
        agent_id: profile.id,
        plan_id: item.planId,
        retail_price: item.agentPrice * item.quantity,
        wholesale_price: item.wholesalePrice || item.agentPrice * item.quantity, // Fallback to agentPrice if wholesalePrice missing
        customer_name: customer_info.name,
        customer_email: customer_info.email,
        customer_phone: customer_info.phone || null,
        device_brand_id: device_info?.brand_id || null,
        device_model_id: device_info?.model_id || null,
        compatibility_checked: device_info?.compatibility_checked || false,
        compatibility_warning_shown: device_info?.compatibility_warning_shown || false,
        status: "pending",
      }));

      const { data: orderData, error: orderErr } = await supabase
        .from("orders")
        .insert(orders)
        .select("id");
      if (orderErr) throw orderErr;
orderIds = orderData?.map(o => o.id) || [];

      await logTrace(supabase, 'orders_created', { order_ids: orderIds }, user.id);

      // Create eSIMs for each order
      for (let i = 0; i < orderData.length; i++) {
        const order = orderData[i];
        const item = cart_items[i];
        
        try {
          console.log(`Creating eSIM for order ${order.id} with plan ${item.planId}`);
          
          // Get plan details to determine supplier
          const { data: planData, error: planError } = await supabase
            .from("esim_plans")
            .select("supplier_name, is_active, title, validity_days, data_amount, country_code")
            .eq("id", item.planId)
            .single();
          
          if (planError) {
            console.error(`Failed to fetch plan for order ${order.id}:`, planError);
            await supabase
              .from("orders")
              .update({ status: "failed" })
              .eq("id", order.id);
            continue;
          }
          
          // Resolve to the latest active Maya plan matching key attributes (avoid stale test plan IDs)
          let planIdToUse = item.planId;
          const supplierName = planData.supplier_name;
          if (supplierName === 'maya') {
            console.log(`Ensuring latest active Maya plan for order ${order.id}`);
            const { data: replacementList, error: replErr } = await supabase
              .from("esim_plans")
              .select("id, updated_at")
              .eq("supplier_name", "maya")
              .eq("title", planData.title)
              .eq("validity_days", planData.validity_days)
              .eq("country_code", planData.country_code)
              .eq("is_active", true)
              .order("updated_at", { ascending: false })
              .limit(1);
            if (replErr) {
              console.error('Error searching latest Maya plan:', replErr);
            }
            const latest = replacementList && replacementList.length > 0 ? replacementList[0] : null;
            if (latest?.id && latest.id !== item.planId) {
              planIdToUse = latest.id;
              console.log(`Switching to latest Maya plan ${planIdToUse} for order ${order.id}`);
              await supabase
                .from("orders")
                .update({ plan_id: planIdToUse })
                .eq("id", order.id);
            }
          }
          
          // Route to appropriate eSIM creation function based on supplier
          const functionName = supplierName === 'maya' ? 'create-maya-esim' : 'create-esim';
console.log(`Using function ${functionName} for supplier ${supplierName}`);

          await logTrace(supabase, 'invoke_create_esim', { correlationId, function: functionName, plan_id: planIdToUse, order_id: order.id }, user.id);
          
          const { data: esimData, error: esimError } = await supabase.functions.invoke(functionName, {
            body: {
              correlationId,
              plan_id: planIdToUse,
              order_id: order.id
            }
          });
          
if (esimError) {
            console.error(`Failed to create eSIM for order ${order.id}:`, esimError);
            await logTrace(supabase, 'invoke_failed', { order_id: order.id, error: esimError }, user.id);
            // Update order status to failed
            await supabase
              .from("orders")
              .update({ status: "failed" })
              .eq("id", order.id);
          } else {
            console.log(`Successfully created eSIM for order ${order.id}:`, esimData);
            await logTrace(supabase, 'invoke_success', { order_id: order.id, response: esimData }, user.id);
          }
        } catch (esimCreateError) {
          console.error(`Error creating eSIM for order ${order.id}:`, esimCreateError);
          // Update order status to failed
          await supabase
            .from("orders")
            .update({ status: "failed" })
            .eq("id", order.id);
        }
      }
    }

    return new Response(JSON.stringify({ balance: newBalance, order_ids: orderIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
