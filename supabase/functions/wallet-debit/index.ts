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
    const { amount, description, reference_id } = await req.json();
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

    // Insert transaction
    const { error: insertErr } = await supabase.from("wallet_transactions").insert({
      agent_id: profile.id,
      transaction_type: "debit",
      description: description ?? "Cart purchase",
      reference_id: reference_id ?? `cart-${Date.now()}`,
      amount,
      balance_after: newBalance,
    });
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ balance: newBalance }), {
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
