import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to log health check results
async function logTrace(supabaseClient: any, action: string, details: any) {
  try {
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'maya_health',
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
    console.log('=== Maya Health Check Started ===');
    
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
      const error = 'Maya API credentials not configured';
      await logTrace(supabase, 'health_check_failed', { error, reason: 'missing_credentials' });
      return new Response(
        JSON.stringify({ 
          healthy: false, 
          error,
          checks: []
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      healthy: true,
      timestamp: new Date().toISOString(),
      checks: [] as any[]
    };

    // Test OAuth authentication
    console.log('Testing OAuth authentication...');
    const oauthResult = { name: 'oauth_auth', status: 'failed', details: '' };
    
    const authEndpoints = [
      `${mayaApiUrl}/oauth/token`,
      `${mayaApiUrl}/connectivity/v1/oauth/token`
    ];

    let accessToken = null;
    for (const endpoint of authEndpoints) {
      try {
        const tokenResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: mayaApiKey,
            client_secret: mayaApiSecret
          })
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          accessToken = tokenData.access_token;
          oauthResult.status = 'success';
          oauthResult.details = `OAuth successful at ${endpoint}`;
          break;
        }
      } catch (error) {
        oauthResult.details = `OAuth failed: ${error.message}`;
      }
    }
    results.checks.push(oauthResult);

    // Set up authentication headers
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      console.log('Using OAuth Bearer token for health checks');
    } else {
      const authString = btoa(`${mayaApiKey}:${mayaApiSecret}`);
      headers['Authorization'] = `Basic ${authString}`;
      console.log('Using Basic Auth for health checks');
    }

    // Test API endpoints
    const endpointsToTest = [
      { name: 'account_products', url: `${mayaApiUrl}/connectivity/v1/account/products` },
      { name: 'direct_products', url: `${mayaApiUrl}/connectivity/v1/products` },
      { name: 'account_orders', url: `${mayaApiUrl}/connectivity/v1/account/orders` },
      { name: 'direct_orders', url: `${mayaApiUrl}/connectivity/v1/orders` }
    ];

    for (const endpoint of endpointsToTest) {
      console.log(`Testing endpoint: ${endpoint.name}`);
      const checkResult = { 
        name: endpoint.name, 
        status: 'failed' as 'success' | 'failed', 
        details: '',
        response_time: 0
      };

      try {
        const startTime = Date.now();
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers
        });
        const endTime = Date.now();
        checkResult.response_time = endTime - startTime;

        checkResult.status = response.ok ? 'success' : 'failed';
        checkResult.details = `Status: ${response.status} ${response.statusText} (${checkResult.response_time}ms)`;
        
        if (!response.ok && response.status !== 404) {
          results.healthy = false;
        }
      } catch (error) {
        checkResult.details = `Network error: ${error.message}`;
        results.healthy = false;
      }

      results.checks.push(checkResult);
    }

    // Test plan availability
    console.log('Testing plan availability...');
    const planCheck = { name: 'plan_availability', status: 'failed' as 'success' | 'failed', details: '' };
    
    try {
      const { data: mayaPlans, error } = await supabase
        .from('esim_plans')
        .select('supplier_plan_id, title, is_active')
        .eq('supplier_name', 'maya')
        .eq('is_active', true)
        .limit(5);

      if (error) {
        planCheck.details = `Database error: ${error.message}`;
      } else {
        planCheck.status = 'success';
        planCheck.details = `Found ${mayaPlans?.length || 0} active Maya plans in database`;
      }
    } catch (error) {
      planCheck.details = `Plan check error: ${error.message}`;
    }
    results.checks.push(planCheck);

    // Log health check results
    await logTrace(supabase, 'health_check_completed', {
      healthy: results.healthy,
      checks: results.checks,
      duration: results.checks.reduce((sum, check) => sum + (check.response_time || 0), 0)
    });

    console.log('=== Maya Health Check Completed ===');
    console.log('Overall health:', results.healthy ? 'HEALTHY' : 'UNHEALTHY');

    return new Response(
      JSON.stringify(results),
      { 
        status: results.healthy ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({ 
        healthy: false, 
        error: error.message,
        checks: []
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});