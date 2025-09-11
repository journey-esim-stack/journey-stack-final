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
      return new Response(JSON.stringify({ error: 'eSIM Access credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch eSIM details from eSIM Access API
    const response = await fetch('https://api.esimaccess.com/api/v1/esim/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_code: accessCode,
        secret_key: secretKey,
        iccid: iccid
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('eSIM Access API error:', data);
      return new Response(JSON.stringify({ error: 'Failed to fetch eSIM details' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
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