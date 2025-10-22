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

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error("Missing required Razorpay payment parameters");
    }

    console.log(`Verifying Razorpay payment for user ${user.id}`);

    // Verify signature using Web Crypto API
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeySecret) {
      throw new Error("Razorpay secret not configured");
    }

    // Create HMAC signature using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(razorpayKeySecret);
    const messageData = encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const generatedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (generatedSignature !== razorpay_signature) {
      console.error("Signature verification failed");
      throw new Error("Invalid payment signature");
    }

    console.log("Signature verified successfully");

    // Fetch payment details from Razorpay
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: {
        "Authorization": `Basic ${basicAuth}`
      }
    });

    if (!paymentResponse.ok) {
      throw new Error("Failed to fetch payment details from Razorpay");
    }

    const payment = await paymentResponse.json();
    
    if (payment.status !== "captured" && payment.status !== "authorized") {
      throw new Error(`Payment not successful. Status: ${payment.status}`);
    }

    const amountInr = payment.amount / 100; // Convert from paise to rupees
    console.log(`Payment verified: ₹${amountInr}`);

    // Update wallet balance
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("agent_profiles")
      .select("id, wallet_balance, wallet_currency")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile) {
      throw new Error("Agent profile not found");
    }

    if (profile.wallet_currency !== "INR") {
      throw new Error("Agent wallet currency mismatch");
    }

    const newBalance = Number(profile.wallet_balance) + amountInr;

    // Update balance
    const { error: updateErr } = await supabaseAdmin
      .from("agent_profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", profile.id);

    if (updateErr) {
      console.error("Failed to update wallet balance:", updateErr);
      throw new Error("Failed to update wallet balance");
    }

    // Record transaction
    const { error: txErr } = await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        agent_id: profile.id,
        transaction_type: "credit",
        amount: amountInr,
        balance_after: newBalance,
        description: `Razorpay wallet top-up via ${payment.method}`,
        reference_id: razorpay_payment_id
      });

    if (txErr) {
      console.error("Failed to record transaction:", txErr);
    }

    console.log(`Wallet updated successfully. New balance: ₹${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: newBalance,
        amount_added: amountInr,
        currency: "INR"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error verifying Razorpay payment:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
