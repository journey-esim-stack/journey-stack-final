import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, description, reference_id, cart_items, customer_info } = await req.json();
    if (typeof amount !== "number" || amount <= 0) {
      throw new Error("amount must be a positive number");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw new Error(`Auth failed: ${userErr.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Get agent profile
    const { data: profile, error: profileErr } = await supabase
      .from("agent_profiles")
      .select("id, wallet_balance")
      .eq("user_id", user.id)
      .single();
    if (profileErr) throw profileErr;

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
      
      const orders = cart_items.map((item: any) => ({
        agent_id: profile.id,
        plan_id: item.planId,
        retail_price: item.agentPrice * item.quantity,
        wholesale_price: item.wholesalePrice || item.agentPrice * item.quantity, // Fallback to agentPrice if wholesalePrice missing
        customer_name: customer_info.name,
        customer_email: customer_info.email,
        customer_phone: customer_info.phone || null,
        status: "pending",
      }));

      const { data: orderData, error: orderErr } = await supabase
        .from("orders")
        .insert(orders)
        .select("id");
      if (orderErr) throw orderErr;
      orderIds = orderData?.map(o => o.id) || [];

      // Create eSIMs for each order
      for (let i = 0; i < orderData.length; i++) {
        const order = orderData[i];
        const item = cart_items[i];
        
        try {
          console.log(`Creating eSIM for order ${order.id} with plan ${item.planId}`);
          
          const { data: esimData, error: esimError } = await supabase.functions.invoke('create-esim', {
            body: {
              plan_id: item.planId,
              order_id: order.id
            }
          });
          
          if (esimError) {
            console.error(`Failed to create eSIM for order ${order.id}:`, esimError);
            // Update order status to failed
            await supabase
              .from("orders")
              .update({ status: "failed" })
              .eq("id", order.id);
          } else {
            console.log(`Successfully created eSIM for order ${order.id}:`, esimData);
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
