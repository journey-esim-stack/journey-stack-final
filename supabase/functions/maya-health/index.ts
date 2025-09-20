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

// Get Maya OAuth access token
async function getMayaAccessToken(apiKey: string, apiSecret: string, apiUrl: string) {
  const oauthEndpoints = [
    `${apiUrl}/oauth/token`,
    `${apiUrl}/connectivity/v1/oauth/token`
  ];

  for (const endpoint of oauthEndpoints) {
    try {
      console.log(`Testing OAuth at: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: apiKey,
          client_secret: apiSecret,
        }),
      });

      console.log(`OAuth response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          console.log('OAuth successful, got access token');
          return { success: true, token: `Bearer ${data.access_token}`, method: 'OAuth', endpoint };
        }
      } else {
        const errorText = await response.text();
        console.log(`OAuth failed at ${endpoint}:`, errorText);
      }
    } catch (error) {
      console.log(`OAuth attempt failed at ${endpoint}:`, error.message);
    }
  }

  console.log('All OAuth attempts failed, using Basic Auth');
  return { 
    success: false, 
    token: `Basic ${btoa(`${apiKey}:${apiSecret}`)}`, 
    method: 'Basic Auth',
    endpoint: 'fallback'
  };
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

    // Get Maya API credentials
    const mayaApiKey = Deno.env.get('MAYA_API_KEY');
    const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
    const mayaApiUrl = Deno.env.get('MAYA_API_URL');

    console.log('Maya credentials check:', {
      hasMayaApiKey: !!mayaApiKey,
      hasMayaApiSecret: !!mayaApiSecret,
      hasMayaApiUrl: !!mayaApiUrl,
      mayaApiUrl
    });

    await logTrace(supabaseClient, 'credentials_check', { 
      hasMayaApiKey: !!mayaApiKey, 
      hasMayaApiSecret: !!mayaApiSecret, 
      hasMayaApiUrl: !!mayaApiUrl,
      mayaApiUrl 
    });

    if (!mayaApiKey || !mayaApiSecret || !mayaApiUrl) {
      const error = 'Missing Maya API credentials';
      await logTrace(supabaseClient, 'credentials_missing', { error });
      return new Response(JSON.stringify({ 
        success: false, 
        error,
        details: {
          hasMayaApiKey: !!mayaApiKey,
          hasMayaApiSecret: !!mayaApiSecret,
          hasMayaApiUrl: !!mayaApiUrl
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const healthResults = {
      credentials: 'OK',
      auth: {},
      endpoints: {},
      products: {},
      recommendations: []
    };

    // Test authentication
    const authResult = await getMayaAccessToken(mayaApiKey, mayaApiSecret, mayaApiUrl);
    healthResults.auth = authResult;
    await logTrace(supabaseClient, 'auth_test', authResult);

    // Test endpoints with the auth token
    const testEndpoints = [
      `${mayaApiUrl}/connectivity/v1/account/orders`,
      `${mayaApiUrl}/connectivity/v1/orders`,
      `${mayaApiUrl}/connectivity/v1/products`,
      `${mayaApiUrl}/connectivity/v1/account/products`,
    ];

    for (const endpoint of testEndpoints) {
      try {
        console.log(`Testing endpoint: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': authResult.token,
            'Accept': 'application/json',
          },
        });

        const responseText = await response.text();
        
        const endpointResult = {
          status: response.status,
          ok: response.ok,
          contentType: response.headers.get('content-type'),
          responsePreview: responseText.substring(0, 200)
        };
        
        healthResults.endpoints[endpoint] = endpointResult;
        await logTrace(supabaseClient, 'endpoint_test', { endpoint, result: endpointResult });

        console.log(`${endpoint}: ${response.status} - ${response.ok ? 'OK' : 'FAILED'}`);

        // If this is a products endpoint and it works, try to get products
        if (response.ok && endpoint.includes('products')) {
          try {
            const products = JSON.parse(responseText);
            const productInfo = {
              count: products?.data?.length || products?.length || 0,
              sampleProducts: (products?.data || products || []).slice(0, 3).map((p: any) => ({
                uid: p.uid || p.product_uid || p.id,
                name: p.name || p.title,
                type: p.type
              }))
            };
            healthResults.products[endpoint] = productInfo;
            await logTrace(supabaseClient, 'products_found', { endpoint, productInfo });
          } catch (parseError) {
            healthResults.products[endpoint] = { error: 'Failed to parse products' };
          }
        }
      } catch (error) {
        const errorResult = { error: error.message };
        healthResults.endpoints[endpoint] = errorResult;
        await logTrace(supabaseClient, 'endpoint_error', { endpoint, error: error.message });
        console.error(`Error testing ${endpoint}:`, error.message);
      }
    }

    // Generate recommendations
    if (!authResult.success) {
      healthResults.recommendations.push('OAuth authentication failed - using Basic Auth fallback');
    }

    const workingEndpoints = Object.entries(healthResults.endpoints)
      .filter(([_, result]: [string, any]) => result.ok)
      .map(([endpoint, _]) => endpoint);

    if (workingEndpoints.length === 0) {
      healthResults.recommendations.push('No endpoints are accessible - check API credentials and base URL');
    } else {
      healthResults.recommendations.push(`Working endpoints found: ${workingEndpoints.join(', ')}`);
      
      const hasAccountEndpoints = workingEndpoints.some(ep => ep.includes('/account/'));
      if (hasAccountEndpoints) {
        healthResults.recommendations.push('Use account-scoped endpoints (/account/orders) for better reliability');
      }
    }

    const hasProducts = Object.values(healthResults.products).some((p: any) => p.count > 0);
    if (!hasProducts) {
      healthResults.recommendations.push('No products found - check if account has access to eSIM products');
    }

    await logTrace(supabaseClient, 'health_check_complete', healthResults);
    console.log('Maya Health Check completed:', healthResults);

    return new Response(JSON.stringify(healthResults, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
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