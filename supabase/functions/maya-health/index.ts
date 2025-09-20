import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Log diagnostic information to audit_logs
async function logTrace(supabaseClient: any, action: string, details: any) {
  try {
    await supabaseClient.from('audit_logs').insert({
      table_name: 'maya_health',
      action,
      new_values: details,
    });
  } catch (e) {
    console.error('audit log insert failed', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Maya Health Check starting...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    await logTrace(supabaseClient, 'health_check_start', { timestamp: new Date().toISOString() });

    // Retrieve Maya API credentials from environment variables
    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL');

    if (!mayaApiKey || !mayaApiSecret || !mayaApiUrl) {
      console.log('Missing Maya API credentials');
      await logTrace(supabaseClient, 'health_check_failed', { 
        error: 'Missing credentials',
        hasKey: !!mayaApiKey, 
        hasSecret: !!mayaApiSecret, 
        hasUrl: !!mayaApiUrl 
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Maya API credentials not configured',
          details: {
            hasKey: !!mayaApiKey,
            hasSecret: !!mayaApiSecret,
            hasUrl: !!mayaApiUrl
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await logTrace(supabaseClient, 'health_check_started', { 
      mayaApiUrl,
      credentialsPresent: true 
    });

    // Test OAuth 2.0 authentication
    const authResults: any = {
      oauth_success: false,
      oauth_endpoints_tested: [],
      access_token: null
    };

    const oauthEndpoints = [
      `${mayaApiUrl}/oauth/token`,
      `${mayaApiUrl}/connectivity/v1/oauth/token`
    ];

    for (const endpoint of oauthEndpoints) {
      const oauthTest = {
        endpoint,
        success: false,
        status: null as number | null,
        error: null as string | null,
        responseTime: 0
      };

      const startTime = Date.now();

      try {
        console.log(`Testing OAuth endpoint: ${endpoint}`);
        
        const response = await fetch(endpoint, {
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

        oauthTest.status = response.status;
        oauthTest.responseTime = Date.now() - startTime;

        if (response.ok) {
          const tokenData = await response.json();
          oauthTest.success = true;
          authResults.oauth_success = true;
          authResults.access_token = tokenData.access_token;
          console.log(`OAuth successful at: ${endpoint}`);
          break;
        } else {
          const errorData = await response.text();
          oauthTest.error = `HTTP ${response.status}: ${errorData}`;
          console.log(`OAuth failed at ${endpoint}: ${oauthTest.error}`);
        }

      } catch (error: any) {
        oauthTest.responseTime = Date.now() - startTime;
        oauthTest.error = error.message;
        console.log(`OAuth error at ${endpoint}: ${error.message}`);
      }

      authResults.oauth_endpoints_tested.push(oauthTest);
    }

    // Create Basic Auth header as fallback
    const authString = btoa(`${mayaApiKey}:${mayaApiSecret}`);
    const basicAuthHeader = `Basic ${authString}`;

    // Set up headers for API testing
    const testHeaders: Record<string, string> = {
      'Accept': 'application/json'
    };

    if (authResults.oauth_success && authResults.access_token) {
      testHeaders['Authorization'] = `Bearer ${authResults.access_token}`;
      console.log('Using OAuth Bearer token for API tests');
    } else {
      testHeaders['Authorization'] = basicAuthHeader;
      console.log('Using Basic Auth for API tests');
    }

    const results: any = {
      success: false,
      timestamp: new Date().toISOString(),
      authentication: authResults,
      probes: []
    };

    // Test endpoints to probe (try account-scoped first, then direct)
    const testEndpoints = [
      '/connectivity/v1/account/products',
      '/connectivity/v1/products',
      '/connectivity/v1/account/orders',
      '/connectivity/v1/orders'
    ];

    for (const endpoint of testEndpoints) {
      const probeResult = {
        endpoint,
        success: false,
        status: null as number | null,
        error: null as string | null,
        responseTime: 0,
        data: null as any,
        auth_method: authResults.oauth_success ? 'OAuth Bearer' : 'Basic Auth'
      };

      const startTime = Date.now();

      try {
        console.log(`Probing Maya API: ${mayaApiUrl}${endpoint}`);
        
        const response = await fetch(`${mayaApiUrl}${endpoint}`, {
          method: 'GET',
          headers: testHeaders
        });

        probeResult.status = response.status;
        probeResult.responseTime = Date.now() - startTime;

        if (response.ok) {
          const data = await response.json();
          probeResult.success = true;
          probeResult.data = data;
          console.log(`Probe successful: ${endpoint}`, data);
          results.success = true; // At least one probe succeeded
        } else {
          const errorData = await response.text();
          probeResult.error = `HTTP ${response.status}: ${errorData}`;
          console.log(`Probe failed: ${endpoint} - ${probeResult.error}`);
        }

      } catch (error: any) {
        probeResult.responseTime = Date.now() - startTime;
        probeResult.error = error.message;
        console.log(`Probe error: ${endpoint} - ${error.message}`);
      }

      results.probes.push(probeResult);
      await logTrace(supabaseClient, 'health_probe_completed', probeResult);
    }

    await logTrace(supabaseClient, 'health_check_overall_status', results);

    console.log('Maya Health Check completed:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Maya Health Check failed:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
        await logTrace(supabaseClient, 'health_check_error', { 
          error: error.message,
          stack: error.stack 
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});