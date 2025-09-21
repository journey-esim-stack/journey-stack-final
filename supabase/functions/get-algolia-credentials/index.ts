import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), { status: 401, headers: corsHeaders });
    }

    // Allow admins or approved agents
    let allowed = false;
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (role) allowed = true;
    if (!allowed) {
      const { data: agent } = await supabase.from('agent_profiles').select('id,status').eq('user_id', user.id).eq('status', 'approved').maybeSingle();
      if (agent) allowed = true;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders });
    }

    const appId = Deno.env.get('ALGOLIA_APPLICATION_ID');
    const adminKey = Deno.env.get('ALGOLIA_ADMIN_API_KEY');
    if (!appId || !adminKey) {
      return new Response(JSON.stringify({ error: 'Algolia not configured' }), { status: 500, headers: corsHeaders });
    }

    // Generate a secured API key restricted to the public index/filters
    const validUntil = Math.floor(Date.now() / 1000) + 60 * 60 * 6; // 6 hours (seconds)
    const queryParams = `filters=is_active:true AND admin_only:false&restrictIndices=esim_plans&validUntil=${validUntil}`;

    const signatureHex = await hmacHex(adminKey, queryParams);
    const securedApiKey = btoa(signatureHex + queryParams);

    return new Response(
      JSON.stringify({ appId, apiKey: securedApiKey, validUntil }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('get-algolia-credentials error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders });
  }
});