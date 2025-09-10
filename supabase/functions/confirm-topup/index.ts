import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id is required");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe secret key not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Identify user (required to find agent profile)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw new Error(`Auth failed: ${userErr.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Retrieve checkout session and verify payment
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }
    const amountCents = session.amount_total ?? 0;
    if (amountCents <= 0) throw new Error("Invalid payment amount");
    const amount = amountCents / 100;

    // Get agent profile
    const { data: profile, error: profileErr } = await supabase
      .from("agent_profiles")
      .select("id, wallet_balance")
      .eq("user_id", user.id)
      .single();
    if (profileErr) throw profileErr;

    // Idempotency: check if this session was already recorded
    const { data: existingTx, error: txErr } = await supabase
      .from("wallet_transactions")
      .select("id, balance_after")
      .eq("reference_id", session_id)
      .limit(1);
    if (txErr) throw txErr;

    if (existingTx && existingTx.length > 0) {
      return new Response(
        JSON.stringify({ status: "already_confirmed", balance: existingTx[0].balance_after }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const newBalance = Number(profile.wallet_balance) + amount;

    // Update balance
    const { error: updateErr } = await supabase
      .from("agent_profiles")
      .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (updateErr) throw updateErr;

    // Insert transaction
    const { error: insertErr } = await supabase.from("wallet_transactions").insert({
      agent_id: profile.id,
      transaction_type: "deposit", // Use correct enum value
      description: "Stripe Top-Up",
      reference_id: session_id,
      amount,
      balance_after: newBalance,
    });
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ balance: newBalance, amount }), {
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
