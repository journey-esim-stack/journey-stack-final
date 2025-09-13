import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Test eSIM Function Started ===');
    
    // Test environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const accessCode = Deno.env.get('ESIMACCESS_ACCESS_CODE');
    const secretKey = Deno.env.get('ESIMACCESS_SECRET_KEY');

    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasAccessCode: !!accessCode,
      hasSecretKey: !!secretKey,
      supabaseUrlLength: supabaseUrl?.length || 0,
      accessCodeLength: accessCode?.length || 0,
      secretKeyLength: secretKey?.length || 0
    });

    const supabaseClient = createClient(supabaseUrl ?? '', supabaseKey ?? '');

    // Test database connection
    const { data: testPlan, error: testError } = await supabaseClient
      .from('esim_plans')
      .select('id, supplier_plan_id, title')
      .eq('id', '02e547a4-46b6-4ee0-8edb-5b595faf7655')
      .single();

    console.log('Database test result:', { testPlan, testError });

    if (testError) {
      return new Response(JSON.stringify({ 
        error: 'Database connection failed',
        details: testError
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test provider API with the plan
    if (accessCode && secretKey && testPlan) {
      console.log('Testing provider API...');
      
      const apiPayload = {
        access_code: accessCode,
        secret_key: secretKey,
        plan_id: testPlan.supplier_plan_id,
        quantity: 1
      };

      console.log('API payload (secret hidden):', { 
        ...apiPayload, 
        secret_key: '[HIDDEN]' 
      });

      try {
        const response = await fetch('https://api.esimaccess.com/api/v1/esim/order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(apiPayload),
        });

        const responseData = await response.json();
        
        console.log('API Response:', {
          status: response.status,
          ok: response.ok,
          data: responseData
        });

        return new Response(JSON.stringify({ 
          success: true,
          environment_ok: true,
          database_ok: true,
          api_test: {
            status: response.status,
            ok: response.ok,
            data: responseData
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (apiError) {
        console.error('API test failed:', apiError);
        return new Response(JSON.stringify({ 
          error: 'API test failed',
          details: apiError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      environment_ok: true,
      database_ok: true,
      plan: testPlan
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Test function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Test failed',
      message: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});