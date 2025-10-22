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
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr) throw new Error(`Auth failed: ${userErr.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const { amount_inr } = await req.json();
    if (typeof amount_inr !== "number" || amount_inr < 1) {
      throw new Error("amount_inr must be a positive number");
    }

    console.log(`Creating Razorpay order for user ${user.id}, amount: ₹${amount_inr}`);

    // Verify agent has INR wallet
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("agent_profiles")
      .select("wallet_currency")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile) {
      throw new Error("Agent profile not found");
    }

    if (profile.wallet_currency !== "INR") {
      throw new Error("Razorpay is only available for INR wallet agents");
    }

    // Create Razorpay order
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error("Razorpay credentials not configured");
    }

    const amountInPaise = Math.round(amount_inr * 100); // Convert to paise

    // Generate a short receipt ID (max 40 chars for Razorpay)
    // Use first 8 chars of user ID + timestamp (last 8 digits)
    const shortUserId = user.id.substring(0, 8);
    const shortTimestamp = String(Date.now()).slice(-8);
    const receiptId = `wt_${shortUserId}_${shortTimestamp}`;

    const orderPayload = {
      amount: amountInPaise,
      currency: "INR",
      receipt: receiptId,
      notes: {
        user_id: user.id,
        purpose: "wallet_topup"
      }
    };

    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderPayload)
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error("Razorpay API error:", errorText);
      throw new Error(`Razorpay API failed: ${razorpayResponse.status}`);
    }

    const razorpayOrder = await razorpayResponse.json();
    console.log("Razorpay order created:", razorpayOrder.id);

    return new Response(
      JSON.stringify({
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key_id: razorpayKeyId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error creating Razorpay order:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
