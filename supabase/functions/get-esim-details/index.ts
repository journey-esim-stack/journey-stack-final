import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to get Maya OAuth 2.0 access token
async function getMayaAccessToken(apiKey: string, apiSecret: string, apiUrl: string): Promise<string | null> {
  const authEndpoints = [
    `${apiUrl}/oauth/token`,
    `${apiUrl}/connectivity/v1/oauth/token`
  ];

  for (const endpoint of authEndpoints) {
    try {
      console.log(`Attempting OAuth at: ${endpoint}`);
      
      const tokenResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: apiKey,
          client_secret: apiSecret
        })
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        console.log(`OAuth success at: ${endpoint}`);
        return tokenData.access_token;
      }
    } catch (error) {
      console.log(`OAuth failed at ${endpoint}:`, error);
    }
  }

  console.log('All OAuth attempts failed, falling back to Basic Auth');
  return null;
}

// Map Maya eSIM statuses to common format
function mapMayaStatus(mayaStatus: string): string {
  const statusMap: Record<string, string> = {
    'NEW': 'Ready',
    'DOWNLOADING': 'Installing', 
    'DOWNLOADED': 'Installed',
    'INSTALLED': 'Installed',
    'ENABLED': 'Active',
    'DISABLED': 'Inactive',
    'DELETED': 'Deleted'
  };
  return statusMap[mayaStatus] || mayaStatus;
}

// Get eSIM details from Maya API
async function getMayaESIMDetails(iccid: string, supabaseClient: any) {
  const mayaApiKey = Deno.env.get('MAYA_API_KEY');
  const mayaApiSecret = Deno.env.get('MAYA_API_SECRET');
  const mayaApiUrl = Deno.env.get('MAYA_API_URL');

  if (!mayaApiKey || !mayaApiSecret || !mayaApiUrl) {
    throw new Error('Maya API credentials not configured');
  }

  // Try OAuth 2.0 authentication first
  const accessToken = await getMayaAccessToken(mayaApiKey, mayaApiSecret, mayaApiUrl);
  
  // Set up authentication headers
  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
    console.log('Using OAuth Bearer token for Maya');
  } else {
    const authString = btoa(`${mayaApiKey}:${mayaApiSecret}`);
    headers['Authorization'] = `Basic ${authString}`;
    console.log('Using Basic Auth fallback for Maya');
  }

  // Try account-scoped endpoint first, then fallback
  const endpoints = [
    `${mayaApiUrl}/connectivity/v1/account/sims/${iccid}`,
    `${mayaApiUrl}/connectivity/v1/sims/${iccid}`
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Attempting Maya eSIM details request to: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers
      });

      console.log(`Maya response status: ${response.status} from ${endpoint}`);

      if (response.ok) {
        const data = await response.json();
        console.log('Maya eSIM details response:', data);
        
        // Transform Maya response to standard format
        const esim = data.sim || data;
        return {
          iccid: esim.iccid || iccid,
          status: mapMayaStatus(esim.profile_status || esim.status || 'NEW'),
          dataUsage: {
            used: esim.data_usage?.used_mb ? (esim.data_usage.used_mb / 1024).toFixed(2) : "0",
            total: esim.data_usage?.total_mb ? (esim.data_usage.total_mb / 1024).toFixed(2) : "0",
          },
          network: {
            connected: (esim.profile_status || esim.status) === 'ENABLED',
            operator: esim.network_operator || '',
            country: esim.country || '',
            signalStrength: '0',
          },
          plan: {
            expiresAt: esim.expires_at || esim.expiry_date || null,
          },
          activation: {
            ac: esim.activation_code || esim.manual_code || '',
            qrCodeUrl: esim.qr_code || esim.qrcode || '',
            lpaString: esim.lpa_string || esim.qr_code || '',
          },
          sessions: esim.sessions || [],
        };
      } else if (response.status === 404 && endpoint === endpoints[0]) {
        console.log('404 on account endpoint, trying direct endpoint');
        continue;
      } else {
        const errorText = await response.text().catch(() => '');
        console.error(`Maya API error ${response.status}:`, errorText);
        throw new Error(`Maya API error: ${response.status}`);
      }
    } catch (error) {
      console.error(`Request failed for ${endpoint}:`, error);
      if (endpoint === endpoints[endpoints.length - 1]) {
        throw error;
      }
    }
  }

  throw new Error('All Maya API endpoints failed');
}

// Get eSIM details from eSIM Access API
async function getESIMAccessDetails(iccid: string) {
  const accessCode = Deno.env.get('ESIMACCESS_ACCESS_CODE');
  const secretKey = Deno.env.get('ESIMACCESS_SECRET_KEY');
  const providerApiUrl = Deno.env.get('PROVIDER_API_URL');

  if (!accessCode || !secretKey || !providerApiUrl) {
    throw new Error('eSIM Access credentials not configured');
  }

  const response = await fetch(`${providerApiUrl}/api/v1/open/esim/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'RT-AccessCode': accessCode,
      'RT-SecretKey': secretKey,
    },
    body: JSON.stringify({
      iccid,
      pager: { pageNum: 1, pageSize: 5 }
    }),
  });

  const raw = await response.json();
  
  if (!response.ok || !(raw?.success === true || String(raw?.success).toLowerCase() === 'true')) {
    console.error('eSIM Access API error:', raw);
    throw new Error('Failed to fetch eSIM details from eSIM Access');
  }

  const esim = raw?.obj?.esimList?.[0] ?? null;
  
  if (!esim) {
    return null;
  }

  return {
    iccid: esim.iccid,
    status: esim.esimStatus,
    dataUsage: {
      used: (Number(esim.orderUsage || 0) / (1024 * 1024 * 1024)).toFixed(2),
      total: (Number(esim.totalVolume || 0) / (1024 * 1024 * 1024)).toFixed(2),
    },
    network: {
      connected: esim.esimStatus === 'IN_USE',
      operator: '',
      country: (esim.packageList?.[0]?.locationCode) || '',
      signalStrength: '0',
    },
    plan: {
      expiresAt: esim.expiredTime || null,
    },
    activation: {
      ac: esim.ac,
      qrCodeUrl: esim.qrCodeUrl,
    },
    sessions: [],
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { iccid } = await req.json();
    
    if (!iccid) {
      return new Response(JSON.stringify({ error: 'ICCID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching eSIM details for ICCID:', iccid);

    // First, identify the supplier by checking the order
    const { data: orderData, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        esim_plans (
          supplier_name
        )
      `)
      .eq('esim_iccid', iccid)
      .single();

    if (orderError && orderError.code !== 'PGRST116') {
      console.error('Error fetching order:', orderError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supplier = orderData?.esim_plans?.supplier_name || 'esim_access';
    console.log('Identified supplier:', supplier);

    let esimDetails = null;

    try {
      if (supplier === 'maya') {
        console.log('Fetching from Maya API...');
        esimDetails = await getMayaESIMDetails(iccid, supabaseClient);
      } else {
        console.log('Fetching from eSIM Access API...');
        esimDetails = await getESIMAccessDetails(iccid);
      }
    } catch (apiError) {
      console.error(`${supplier} API error:`, apiError);
      // Return basic error without exposing internal details
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch eSIM details from provider' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = {
      success: true,
      obj: esimDetails,
      supplier: supplier
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-esim-details function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});