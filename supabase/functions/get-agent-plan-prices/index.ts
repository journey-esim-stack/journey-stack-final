// Deno Edge Function: get-agent-plan-prices
// Securely returns agent-specific prices for a list of plan IDs using POST to avoid URL length limits

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.3";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

try {
    // Ensure required secrets are available to avoid runtime errors
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase env vars', { url: !!SUPABASE_URL, anon: !!SUPABASE_ANON_KEY, service: !!SUPABASE_SERVICE_ROLE_KEY });
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('Authorization') || '';

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { agentId, planIds } = await req.json();

    if (!agentId || !Array.isArray(planIds)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Authorization: allow admins or the agent owner
    let isAdmin = false;
    try {
      const { data: userRes } = await userClient.auth.getUser();
      const userId = userRes?.user?.id;
      if (userId) {
        const { data: adminCheck } = await userClient.rpc('has_role', { _user_id: userId, _role: 'admin' });
        isAdmin = !!adminCheck;
      }
    } catch (e) {
      console.warn('Auth user fetch failed, proceeding with standard access check');
    }

    let hasAccess = false;
    if (!isAdmin) {
      const { data: accessOk, error: accessErr } = await userClient.rpc('validate_agent_wallet_access', { _agent_id: agentId });
      if (accessErr) {
        console.error('validate_agent_wallet_access error', accessErr);
        return new Response(JSON.stringify({ error: 'Access check failed' }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      hasAccess = !!accessOk;
    }

    if (!isAdmin && !hasAccess) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch prices in chunks to be safe
    const chunkSize = 50;
    const results: Array<{ plan_id: string; retail_price: number }> = [];

    for (let i = 0; i < planIds.length; i += chunkSize) {
      const slice = planIds.slice(i, i + chunkSize);
      const { data, error } = await adminClient
        .from('agent_pricing')
        .select('plan_id, retail_price')
        .eq('agent_id', agentId)
        .in('plan_id', slice);
      if (error) {
        console.error('agent_pricing fetch error', { index: i, error });
        return new Response(JSON.stringify({ error: 'Failed to fetch pricing' }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (data) results.push(...(data as any));
    }

    const map: Record<string, number> = {};
    for (const row of results) {
      map[row.plan_id] = Number(row.retail_price);
    }

    return new Response(JSON.stringify({ prices: map }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (e) {
    console.error('Unhandled error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
