import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe secret key not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw new Error(`Auth failed: ${userErr.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    // Get agent profile
    const { data: profile, error: profileErr } = await supabase
      .from("agent_profiles")
      .select("id, wallet_balance")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!profile) throw new Error("Agent profile not found");

    // List recent checkout sessions and reconcile
    const nowSec = Math.floor(Date.now() / 1000);
    const oneWeekAgo = nowSec - 7 * 24 * 60 * 60;
    const sessions = await stripe.checkout.sessions.list({ limit: 30 });

    let newBalance = Number(profile.wallet_balance);
    let reconciled = 0;

    for (const s of sessions.data) {
      const email = (s.customer_details as any)?.email ?? s.customer_email ?? null;
      if (!email || email.toLowerCase() !== user.email.toLowerCase()) continue;
      if (s.payment_status !== "paid") continue;
      if ((s.created ?? 0) < oneWeekAgo) continue;

      const { data: existing } = await supabase
        .from("wallet_transactions")
        .select("id")
        .eq("reference_id", s.id)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const amount = (s.amount_total ?? 0) / 100;
      if (amount <= 0) continue;
      newBalance = newBalance + amount;

      // Update balance first
      const { error: balErr } = await supabase
        .from("agent_profiles")
        .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (balErr) throw balErr;

      // Insert transaction as deposit
      const { error: txErr } = await supabase.from("wallet_transactions").insert({
        agent_id: profile.id,
        transaction_type: "deposit",
        description: "Stripe Top-Up (synced)",
        reference_id: s.id,
        amount,
        balance_after: newBalance,
      });
      if (txErr) throw txErr;
      reconciled += 1;
    }

    return new Response(JSON.stringify({ reconciled, balance: newBalance }), {
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