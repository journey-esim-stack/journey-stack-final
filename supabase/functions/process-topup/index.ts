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
    // Get auth token and validate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr) throw new Error(`Auth failed: ${userErr.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const { iccid, packageCode, amount } = await req.json();
    if (!iccid || !packageCode || !amount) {
      throw new Error("iccid, packageCode, and amount are required");
    }

    // Use service role client for database operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get agent profile
    const { data: profile, error: profileError } = await supabaseService
      .from("agent_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      throw new Error("Agent profile not found");
    }

    // Check if agent has enough balance
    if (profile.wallet_balance < amount) {
      throw new Error("Insufficient wallet balance");
    }

    // Get eSIM Access API credentials
    const accessCode = Deno.env.get("ESIMACCESS_ACCESS_CODE");
    const secretKey = Deno.env.get("ESIMACCESS_SECRET_KEY");

    if (!accessCode || !secretKey) {
      throw new Error("eSIM Access API credentials not configured");
    }

    console.log("Processing top-up with eSIM Access API...");

    // Generate unique transaction ID
    const transactionId = `TOPUP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Make top-up request to eSIM Access API
    const topupPayload = {
      iccid: iccid,
      packageCode: packageCode,
      amount: (amount * 100).toString(), // Convert to cents
      transactionId: transactionId,
    };

    console.log("Top-up request payload:", topupPayload);

    const response = await fetch("https://api.esimaccess.com/api/v1/open/esim/topup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "RT-AccessCode": accessCode,
        "RT-SecretKey": secretKey,
      },
      body: JSON.stringify(topupPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("eSIM Access top-up API error:", response.status, errorText);
      throw new Error(`Top-up API request failed: ${response.status} - ${errorText}`);
    }

    const apiResult = await response.json();
    console.log("Top-up API response:", apiResult);

    // Check if top-up was successful
    const isSuccess = apiResult?.success === true || apiResult?.success === "true";
    if (!isSuccess) {
      const errCode = apiResult?.errorCode ?? apiResult?.code ?? "unknown";
      const errMsg = apiResult?.errorMessage ?? apiResult?.errorMsg ?? "Unknown error from provider";
      console.error("eSIM Access top-up failed:", { errCode, errMsg, apiResult });
      throw new Error(`Top-up failed: ${errCode} - ${errMsg}`);
    }

    // Deduct amount from agent's wallet
    const newBalance = profile.wallet_balance - amount;
    
    const { error: balanceError } = await supabaseService
      .from("agent_profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", profile.id);

    if (balanceError) {
      console.error("Balance update error:", balanceError);
      throw new Error("Failed to update wallet balance");
    }

    // Record wallet transaction
    const { error: transactionError } = await supabaseService
      .from("wallet_transactions")
      .insert({
        agent_id: profile.id,
        transaction_type: "debit",
        amount: -amount,
        balance_after: newBalance,
        description: `Top-up for eSIM ${iccid}`,
        reference_id: transactionId,
      });

    if (transactionError) {
      console.error("Transaction record error:", transactionError);
      // Don't throw here as the top-up was successful
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transactionId,
        newBalance: newBalance,
        topupDetails: apiResult.obj,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in process-topup:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});