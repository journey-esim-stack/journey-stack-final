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

    const accessCode = Deno.env.get('ESIMACCESS_ACCESS_CODE');
    const secretKey = Deno.env.get('ESIMACCESS_SECRET_KEY');

    if (!accessCode || !secretKey) {
      return new Response(JSON.stringify({ error: 'Service credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Query eSIM details by ICCID using provider API
    const response = await fetch('https://api.esimaccess.com/api/v1/open/esim/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'RT-AccessCode': accessCode,
        'RT-SecretKey': secretKey,
      },
      body: JSON.stringify({
        iccid,
        pager: { pageNum: 1, pageSize: 1 }
      }),
    });

    const raw = await response.json();
    
    if (!response.ok || !(raw?.success === true || String(raw?.success).toLowerCase() === 'true')) {
      console.error('Provider API error:', raw);
      return new Response(JSON.stringify({ error: 'Failed to fetch eSIM details' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const esim = raw?.obj?.esimList?.[0] ?? null;

    const result = {
      success: true,
      obj: esim
        ? {
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
          }
        : null,
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