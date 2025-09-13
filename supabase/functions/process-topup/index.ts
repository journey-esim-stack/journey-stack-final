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
    if (!iccid || !packageCode) {
      throw new Error("iccid and packageCode are required");
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

    // Wallet balance check will occur after fetching latest provider price and applying markup

    // Get provider API credentials
    const accessCode = Deno.env.get("PROVIDER_ACCESS_CODE");
    const secretKey = Deno.env.get("PROVIDER_SECRET_KEY");

    if (!accessCode || !secretKey) {
      throw new Error("Service API credentials not configured");
    }

    console.log("Processing top-up with provider API...");

    // First, refresh the latest plans to get current pricing
    console.log("Refreshing top-up plans...");
    const providerApiUrl = Deno.env.get("PROVIDER_API_URL");
    const refreshPlansResponse = await fetch(`${providerApiUrl}/api/v1/open/package/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "RT-AccessCode": accessCode,
        "RT-SecretKey": secretKey,
      },
      body: JSON.stringify({
        type: "TOPUP",
        iccid: iccid,
        packageCode: packageCode,
      }),
    });

    if (!refreshPlansResponse.ok) {
      console.error("Failed to refresh plans:", refreshPlansResponse.status);
      throw new Error(`Failed to refresh plans: ${refreshPlansResponse.status}`);
    }

    const refreshPlansData = await refreshPlansResponse.json();
    console.log("Refreshed plans response: Success");

    // Check if refresh was successful
    const refreshSuccess = refreshPlansData?.success === true || refreshPlansData?.success === "true";
    if (!refreshSuccess) {
      const errCode = refreshPlansData?.errorCode ?? "unknown";
      const errMsg = refreshPlansData?.errorMessage ?? refreshPlansData?.errorMsg ?? "Failed to refresh plans";
      console.error("Plans refresh failed:", { errCode, errMsg, refreshPlansData });
      throw new Error(`Plans refresh failed: ${errCode} - ${errMsg}`);
    }

    // Find the specific package from refreshed plans
    const availablePlans = refreshPlansData.obj?.packageList || [];
    const targetPlan = availablePlans.find((plan: any) => plan.packageCode === packageCode);
    
    if (!targetPlan) {
      throw new Error(`Package ${packageCode} not found in refreshed plans`);
    }

    console.log("Found target plan:", targetPlan);

    // Compute wholesale price in dollars
    const wholesaleDollars = targetPlan.price / 10000;

    // Calculate retail price using agent's markup
    let retailPrice = wholesaleDollars;
    if (profile.markup_type === 'percent') {
      retailPrice = wholesaleDollars * (1 + profile.markup_value / 100);
    } else if (profile.markup_type === 'fixed') {
      retailPrice = wholesaleDollars + profile.markup_value;
    }

    // Use the retail price calculated with markup for charging
    const chargeAmount = Number(retailPrice.toFixed(2));
    
    console.log("Top-up pricing details:", {
      wholesaleDollars,
      retailPrice,
      chargeAmount,
      markupType: profile.markup_type,
      markupValue: profile.markup_value
    });

    // Ensure sufficient balance based on retail price
    const currentBalance = Number(profile.wallet_balance);
    if (currentBalance < chargeAmount) {
      throw new Error("Insufficient wallet balance");
    }

    // Generate unique transaction ID
    const transactionId = `TOPUP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Make top-up request to provider API
    const topupPayload = {
      iccid: iccid,
      packageCode: packageCode,
      amount: String(targetPlan.price), // Send provider's current package price in provider units
      transactionId: transactionId,
    };

    console.log("Top-up request payload:", topupPayload);

    const response = await fetch(`${providerApiUrl}/api/v1/open/esim/topup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "RT-AccessCode": accessCode,
        "RT-SecretKey": secretKey,
      },
      body: JSON.stringify(topupPayload),
    });

    if (!response.ok) {
      console.error("Provider top-up API error:", response.status);
      throw new Error(`Top-up API request failed: ${response.status}`);
    }

    const apiResult = await response.json();
    console.log("Top-up API response: Success");

    // Check if top-up was successful
    const isSuccess = apiResult?.success === true || apiResult?.success === "true";
    if (!isSuccess) {
      const errCode = apiResult?.errorCode ?? apiResult?.code ?? "unknown";
      const errMsg = apiResult?.errorMessage ?? apiResult?.errorMsg ?? "Unknown error from provider";
      console.error("Provider top-up failed");
      throw new Error(`Top-up failed: ${errCode} - ${errMsg}`);
    }

    // Prepare display values
    const dataAmount = targetPlan.volume ? `${(targetPlan.volume / (1024 * 1024 * 1024)).toFixed(1)}GB` : targetPlan.description;

    // Deduct retail amount from agent's wallet
    const newBalance = Number(profile.wallet_balance) - chargeAmount;
    
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
        transaction_type: "purchase",
        amount: -chargeAmount,
        balance_after: newBalance,
        description: `eSIM top-up: ${targetPlan.location} ${dataAmount} ${targetPlan.duration}Days`,
        reference_id: `topup-${packageCode}-${Date.now()}`,
      });
    
    console.log("Recording wallet transaction:", {
      amount: -chargeAmount,
      description: `eSIM top-up: ${dataAmount} ${targetPlan.duration}Days`,
      balance_after: newBalance
    });

    if (transactionError) {
      console.error("Transaction record error:", transactionError);
      // Don't throw here as the top-up was successful
    }

    // Record the top-up in history
    const { error: topupError } = await supabaseService
      .from("esim_topups")
      .insert({
        agent_id: profile.id,
        iccid: iccid,
        package_code: packageCode,
        amount: chargeAmount,
        data_amount: dataAmount,
        validity_days: targetPlan.duration,
        transaction_id: transactionId,
        status: 'completed',
      });

    if (topupError) {
      console.error("Top-up history record error:", topupError);
      // Don't throw here as the top-up was successful
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transactionId,
        newBalance: newBalance,
        topupDetails: apiResult.obj,
        planDetails: {
          data_amount: dataAmount,
          validity_days: targetPlan.duration,
        },
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