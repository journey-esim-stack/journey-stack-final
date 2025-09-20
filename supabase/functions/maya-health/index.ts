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

    // Create Basic Auth header
    const basicAuth = btoa(`${mayaApiKey}:${mayaApiSecret}`);
    
    // Test Maya API connectivity with a simple endpoint
    const testUrl = `${mayaApiUrl}/connectivity/v1/account/products`;
    console.log('Testing Maya API connectivity to:', testUrl);
    
    await logTrace(supabaseClient, 'api_request_start', { url: testUrl });

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
    });

    const responseHeaders = Object.fromEntries(response.headers.entries());
    console.log('Maya API Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });

    await logTrace(supabaseClient, 'api_response_headers', { 
      status: response.status, 
      statusText: response.statusText,
      headers: responseHeaders 
    });

    // Try to get response body (limit to first 500 chars for safety)
    let responseBody = '';
    let parseError = null;
    
    try {
      const text = await response.text();
      responseBody = text.substring(0, 500);
      
      // Try parsing as JSON if it looks like JSON
      if (responseBody.trim().startsWith('{') || responseBody.trim().startsWith('[')) {
        JSON.parse(responseBody);
      }
    } catch (e) {
      parseError = e.message;
    }

    await logTrace(supabaseClient, 'api_response_body', { 
      responseBody, 
      parseError,
      contentType: response.headers.get('content-type')
    });

    const healthResult = {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      bodySnippet: responseBody,
      parseError,
      timestamp: new Date().toISOString(),
      testUrl
    };

    await logTrace(supabaseClient, 'health_check_complete', healthResult);

    console.log('Maya Health Check completed:', healthResult);

    return new Response(JSON.stringify(healthResult), {
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