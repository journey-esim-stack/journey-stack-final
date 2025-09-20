import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to log validation results
async function logTrace(supabaseClient: any, action: string, details: any) {
  try {
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'maya_plan_validator',
        action: action,
        new_values: details,
        user_id: null,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log trace:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { plan_ids } = await req.json();
    console.log('=== Maya Plan Validator Started ===');
    console.log('Validating plans:', plan_ids);
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Maya API credentials
    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL');

    if (!mayaApiKey || !mayaApiSecret || !mayaApiUrl) {
      return new Response(
        JSON.stringify({ error: 'Maya API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get plans to validate
    const planFilter = plan_ids && plan_ids.length > 0 
      ? supabase.from('esim_plans').select('*').eq('supplier_name', 'maya').in('id', plan_ids)
      : supabase.from('esim_plans').select('*').eq('supplier_name', 'maya').eq('is_active', true);
    
    const { data: plans, error: planError } = await planFilter;

    if (planError || !plans) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch plans for validation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating ${plans.length} Maya plans...`);

    // Set up authentication
    const authString = btoa(`${mayaApiKey}:${mayaApiSecret}`);
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Accept': 'application/json'
    };

    // Fetch all available products from Maya API
    const allRegions = ['europe', 'apac', 'latam', 'caribbean', 'mena', 'balkans', 'caucasus'];
    const availableProducts = new Map<string, any>();

    console.log('Fetching available products from Maya API...');
    for (const region of allRegions) {
      try {
        const url = `${mayaApiUrl}/connectivity/v1/account/products?region=${region}`;
        const response = await fetch(url, { method: 'GET', headers });
        
        if (response.ok) {
          const data = await response.json();
          const products = Array.isArray(data?.products) ? data.products : [];
          
          for (const product of products) {
            if (product?.uid) {
              availableProducts.set(`maya_${product.uid}`, {
                uid: product.uid,
                name: product.name,
                region,
                active: true,
                wholesale_price_usd: product.wholesale_price_usd,
                data_quota_mb: product.data_quota_mb,
                validity_days: product.validity_days
              });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to fetch products for region ${region}:`, error);
      }
    }

    console.log(`Found ${availableProducts.size} available products from Maya API`);

    // Validate each plan
    const validationResults = [];
    const invalidPlans = [];
    const updatedPlans = [];

    for (const plan of plans) {
      const result = {
        plan_id: plan.id,
        supplier_plan_id: plan.supplier_plan_id,
        title: plan.title,
        status: 'valid' as 'valid' | 'invalid' | 'updated',
        issues: [] as string[],
        maya_product: null as any
      };

      const mayaProduct = availableProducts.get(plan.supplier_plan_id);
      
      if (!mayaProduct) {
        result.status = 'invalid';
        result.issues.push('Plan not found in Maya API');
        invalidPlans.push(plan.id);
      } else {
        result.maya_product = mayaProduct;
        
        // Check for price differences
        const dbPrice = Number(plan.wholesale_price);
        const apiPrice = Number(mayaProduct.wholesale_price_usd);
        
        if (Math.abs(dbPrice - apiPrice) > 0.01) {
          result.issues.push(`Price mismatch: DB=${dbPrice}, API=${apiPrice}`);
          result.status = 'updated';
          updatedPlans.push({
            id: plan.id,
            wholesale_price: apiPrice,
            updated_at: new Date().toISOString()
          });
        }

        // Check for data amount differences
        const formatData = (mb: number) => {
          if (!mb || isNaN(mb)) return '';
          if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
          return `${mb} MB`;
        };

        const dbDataAmount = plan.data_amount;
        const apiDataAmount = formatData(Number(mayaProduct.data_quota_mb));
        
        if (dbDataAmount !== apiDataAmount) {
          result.issues.push(`Data amount mismatch: DB="${dbDataAmount}", API="${apiDataAmount}"`);
          if (result.status === 'valid') result.status = 'updated';
          
          const existingUpdate = updatedPlans.find(u => u.id === plan.id);
          if (existingUpdate) {
            existingUpdate.data_amount = apiDataAmount;
          } else {
            updatedPlans.push({
              id: plan.id,
              data_amount: apiDataAmount,
              updated_at: new Date().toISOString()
            });
          }
        }

        // Check validity days
        const dbValidityDays = Number(plan.validity_days);
        const apiValidityDays = Number(mayaProduct.validity_days);
        
        if (dbValidityDays !== apiValidityDays) {
          result.issues.push(`Validity days mismatch: DB=${dbValidityDays}, API=${apiValidityDays}`);
          if (result.status === 'valid') result.status = 'updated';
          
          const existingUpdate = updatedPlans.find(u => u.id === plan.id);
          if (existingUpdate) {
            existingUpdate.validity_days = apiValidityDays;
          } else {
            updatedPlans.push({
              id: plan.id,
              validity_days: apiValidityDays,
              updated_at: new Date().toISOString()
            });
          }
        }
      }

      validationResults.push(result);
    }

    // Deactivate invalid plans
    if (invalidPlans.length > 0) {
      console.log(`Deactivating ${invalidPlans.length} invalid plans...`);
      const { error: deactivateError } = await supabase
        .from('esim_plans')
        .update({ 
          is_active: false, 
          updated_at: new Date().toISOString() 
        })
        .in('id', invalidPlans);

      if (deactivateError) {
        console.error('Failed to deactivate invalid plans:', deactivateError);
      }
    }

    // Update plans with corrected data
    if (updatedPlans.length > 0) {
      console.log(`Updating ${updatedPlans.length} plans with corrected data...`);
      for (const update of updatedPlans) {
        const { error: updateError } = await supabase
          .from('esim_plans')
          .update(update)
          .eq('id', update.id);

        if (updateError) {
          console.error(`Failed to update plan ${update.id}:`, updateError);
        }
      }
    }

    const summary = {
      total_validated: plans.length,
      valid_plans: validationResults.filter(r => r.status === 'valid').length,
      invalid_plans: invalidPlans.length,
      updated_plans: updatedPlans.length,
      available_products_in_api: availableProducts.size
    };

    // Log validation results
    await logTrace(supabase, 'plan_validation_completed', {
      summary,
      invalid_plan_ids: invalidPlans,
      updated_plan_ids: updatedPlans.map(u => u.id)
    });

    console.log('=== Maya Plan Validation Completed ===');
    console.log('Summary:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results: validationResults,
        actions_taken: {
          deactivated_plans: invalidPlans,
          updated_plans: updatedPlans.map(u => u.id)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Plan validation error:', error);
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