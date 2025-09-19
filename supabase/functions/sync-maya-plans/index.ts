import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MayaPlan {
  product_id: string;
  title: string;
  description?: string;
  country_code: string;
  country_name: string;
  data_amount: string;
  validity_days: number;
  price: number;
  currency: string;
  active: boolean;
}

interface MayaResponse {
  success: boolean;
  data: MayaPlan[];
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Maya plans sync...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Maya API credentials
    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL');

    if (!mayaApiKey || !mayaApiSecret || !mayaApiUrl) {
      throw new Error('Maya API credentials not configured');
    }

    console.log('Maya credentials configured: true');
    console.log('Fetching data from Maya API...');

    // Build Basic Auth header
    const basicAuth = 'Basic ' + btoa(`${mayaApiKey}:${mayaApiSecret}`);

    // Regions to include (per Maya docs)
    const regions = ['europe', 'apac', 'latam', 'caribbean', 'mena', 'balkans', 'caucasus'];

    // Helper to format MB nicely
    const formatData = (mb: number) => {
      if (!mb || isNaN(mb)) return '';
      if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
      return `${mb} MB`;
    };

    // Fetch products for each region in parallel
    const fetches = regions.map(async (region) => {
      const url = `${mayaApiUrl}/connectivity/v1/account/products?region=${region}`;
      console.log('Fetching region:', region, 'URL:', url);
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': basicAuth,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`Region ${region} fetch failed`, res.status, res.statusText, text.slice(0, 300));
        throw new Error(`Region ${region} fetch failed: ${res.status}`);
      }

      const json = await res.json().catch(async () => {
        const text = await res.text().catch(() => '');
        console.error('Invalid JSON for region', region, text.slice(0, 300));
        throw new Error(`Invalid JSON for region ${region}`);
      });

      const products = Array.isArray(json?.products) ? json.products : [];
      console.log(`Region ${region} products:`, products.length);
      return { region, products } as { region: string; products: any[] };
    });

    const regionResults = await Promise.all(fetches);

    // Deduplicate by product uid
    const productMap = new Map<string, { region: string; product: any }>();
    for (const { region, products } of regionResults) {
      for (const p of products) {
        if (!p?.uid) continue;
        if (!productMap.has(p.uid)) {
          productMap.set(p.uid, { region, product: p });
        }
      }
    }

    const allProducts = Array.from(productMap.values());
    console.log('Total unique regional products:', allProducts.length);

    // Transform to our database format (mark as Regional "RG")
    const transformedPlans = allProducts.map(({ region, product }) => {
      const countries = Array.isArray(product?.countries_enabled) ? product.countries_enabled : [];
      const desc = `Region: ${region.toUpperCase()}. Countries: ${countries.join(', ')}`;
      const dataAmount = formatData(Number(product?.data_quota_mb));
      const price = Number(product?.wholesale_price_usd);

      return {
        supplier_plan_id: `maya_${product.uid}`,
        supplier_name: 'maya',
        title: product?.name || `Maya ${region} plan`,
        description: desc,
        country_code: 'RG',
        country_name: `${region[0].toUpperCase()}${region.slice(1)} Region`,
        data_amount: dataAmount,
        validity_days: Number(product?.validity_days) || 0,
        wholesale_price: isNaN(price) ? 0 : price,
        currency: 'USD',
        is_active: true,
        admin_only: false,
      };
    });

    console.log('Transformed Maya plans:', transformedPlans.length);

    if (transformedPlans.length === 0) {
      console.log('No regional products returned from Maya');
      return new Response(
        JSON.stringify({ success: true, message: 'No regional Maya products to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transformed Maya plans:', transformedPlans.length);

    if (transformedPlans.length === 0) {
      console.log('No active plans found from Maya');
      return new Response(
        JSON.stringify({ success: true, message: 'No active Maya plans to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert plans to database
    const { error: upsertError } = await supabase
      .from('esim_plans')
      .upsert(transformedPlans, { 
        onConflict: 'supplier_plan_id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      throw new Error(`Database upsert error: ${upsertError.message}`);
    }

    console.log(`Successfully synced ${transformedPlans.length} Maya plans`);

    // Get all current Maya plan IDs from API
    const currentMayaPlanIds = transformedPlans.map(plan => plan.supplier_plan_id);

    // Deactivate plans that are no longer in the API response
    try {
      const { error: deactivateError } = await supabase
        .from('esim_plans')
        .update({ is_active: false })
        .eq('supplier_name', 'maya')
        .not('supplier_plan_id', 'in', `(${currentMayaPlanIds.map(id => `"${id}"`).join(',')})`);

      if (deactivateError) {
        console.error('Error deactivating old Maya plans:', deactivateError);
      } else {
        console.log('Successfully deactivated old Maya plans');
      }
    } catch (deactivateErr) {
      console.error('Error deactivating old Maya plans:', deactivateErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully synced ${transformedPlans.length} Maya plans`,
        synced_count: transformedPlans.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Maya sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});