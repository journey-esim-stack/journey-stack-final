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

    const { iccid, packageCode } = await req.json();
    if (!iccid && !packageCode) {
      throw new Error("Either iccid or packageCode is required");
    }

    // Get eSIM Access API credentials
    const accessCode = Deno.env.get("ESIMACCESS_ACCESS_CODE");
    const secretKey = Deno.env.get("ESIMACCESS_SECRET_KEY");

    if (!accessCode || !secretKey) {
      throw new Error("eSIM Access API credentials not configured");
    }

    console.log("Fetching top-up plans from eSIM Access API...");

    // Create request payload for getting TOPUP plans
    const requestPayload: any = {
      type: "TOPUP"
    };

    if (iccid) {
      requestPayload.iccid = iccid;
    }
    if (packageCode) {
      requestPayload.packageCode = packageCode;
    }

    const response = await fetch("https://api.esimaccess.com/api/v1/open/package/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "RT-AccessCode": accessCode,
        "RT-SecretKey": secretKey,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("eSIM Access API error:", response.status, errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const apiData = await response.json();
    console.log("Received top-up plans from eSIM Access:", apiData);

    // Check if response is successful
    const isSuccess = apiData?.success === true || apiData?.success === "true";
    if (!isSuccess) {
      const errCode = apiData?.errorCode ?? apiData?.code ?? "unknown";
      const errMsg = apiData?.errorMessage ?? apiData?.errorMsg ?? "Unknown error from provider";
      console.error("eSIM Access returned error:", { errCode, errMsg, apiData });
      throw new Error(`Provider error: ${errCode} - ${errMsg}`);
    }

    const topupPlans = apiData.obj?.packageList || [];

    // Transform the plans to match our format
    const formattedPlans = topupPlans.map((plan: any) => ({
      packageCode: plan.packageCode,
      title: plan.name,
      data_amount: plan.volume ? `${(plan.volume / (1024 * 1024 * 1024)).toFixed(1)}GB` : plan.description,
      validity_days: plan.duration,
      wholesale_price: plan.price / 10000, // Convert from API units to dollars (63000 -> 6.30)
      currency: plan.currencyCode || "USD",
      country_name: plan.location || "",
      country_code: plan.locationCode || "",
      description: plan.description || "",
    }));

    return new Response(JSON.stringify({ success: true, plans: formattedPlans }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in get-topup-plans:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});