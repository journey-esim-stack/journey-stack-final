// Deno Edge Function: admin-agent-pricing
// Admin-only management of agent_pricing (list, upsert, update, delete, bulk_replace)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.3";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'list' | 'upsert' | 'update' | 'delete' | 'bulk_replace';

type Payload =
  | { action: 'list'; agentId: string }
  | { action: 'upsert'; agentId: string; planId: string; retailPrice: number }
  | { action: 'update'; pricingId: string; retailPrice: number }
  | { action: 'delete'; pricingId: string }
  | { action: 'bulk_replace'; agentId: string; records: Array<{ plan_id: string; retail_price: number }> };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase env vars', { url: !!SUPABASE_URL, anon: !!SUPABASE_ANON_KEY, service: !!SUPABASE_SERVICE_ROLE_KEY });
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload = (await req.json()) as Payload;
    const action = (payload as any).action as Action;

    // Authenticate & authorize admin
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = userRes.user.id;

    const { data: isAdmin } = await userClient.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'list') {
      const { agentId } = payload as Extract<Payload, { action: 'list' }>;

      // PostgREST may cap results (commonly at 1000). Page through all records.
      const pageSize = 1000;
      let from = 0;
      let all: any[] = [];
      while (true) {
        const { data, error } = await adminClient
          .from('agent_pricing')
          .select('*')
          .eq('agent_id', agentId)
          .order('updated_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) {
          console.error('list error', error);
          return new Response(JSON.stringify({ error: 'Failed to list pricing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (data && data.length > 0) {
          all = all.concat(data as any[]);
          if (data.length < pageSize) break; // last page
          from += pageSize;
        } else {
          break;
        }
      }

      return new Response(JSON.stringify({ pricing: all }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'upsert') {
      const { agentId, planId, retailPrice } = payload as Extract<Payload, { action: 'upsert' }>;
      const { data, error } = await adminClient
        .from('agent_pricing')
        .upsert({ agent_id: agentId, plan_id: planId, retail_price: retailPrice }, { onConflict: 'agent_id,plan_id' })
        .select()
        .maybeSingle();
      if (error) {
        console.error('upsert error', error);
        return new Response(JSON.stringify({ error: 'Failed to upsert pricing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ pricing: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update') {
      const { pricingId, retailPrice } = payload as Extract<Payload, { action: 'update' }>;
      const { data, error } = await adminClient
        .from('agent_pricing')
        .update({ retail_price: retailPrice })
        .eq('id', pricingId)
        .select()
        .maybeSingle();
      if (error) {
        console.error('update error', error);
        return new Response(JSON.stringify({ error: 'Failed to update pricing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ pricing: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete') {
      const { pricingId } = payload as Extract<Payload, { action: 'delete' }>;
      const { error } = await adminClient
        .from('agent_pricing')
        .delete()
        .eq('id', pricingId);
      if (error) {
        console.error('delete error', error);
        return new Response(JSON.stringify({ error: 'Failed to delete pricing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'bulk_replace') {
      const { agentId, records } = payload as Extract<Payload, { action: 'bulk_replace' }>;

      // Delete existing for agent
      const { error: delErr } = await adminClient.from('agent_pricing').delete().eq('agent_id', agentId);
      if (delErr) {
        console.error('bulk delete error', delErr);
        return new Response(JSON.stringify({ error: 'Failed to reset pricing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Insert in chunks
      const chunkSize = 500;
      let inserted = 0;
      for (let i = 0; i < records.length; i += chunkSize) {
        const batch = records.slice(i, i + chunkSize).map(r => ({ agent_id: agentId, plan_id: r.plan_id, retail_price: r.retail_price }));
        const { error: insErr, count } = await adminClient
          .from('agent_pricing')
          .insert(batch, { count: 'exact' });
        if (insErr) {
          console.error('bulk insert error', insErr);
          return new Response(JSON.stringify({ error: 'Failed to import pricing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        inserted += count || batch.length;
      }

      return new Response(JSON.stringify({ inserted }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Unhandled error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
