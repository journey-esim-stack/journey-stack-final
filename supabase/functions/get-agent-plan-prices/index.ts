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

    // STEP 1: Fetch CSV pricing (agent_pricing table) in chunks
    const chunkSize = 50;
    const csvPricing: Array<{ plan_id: string; retail_price: number; updated_at: string }> = [];

    for (let i = 0; i < planIds.length; i += chunkSize) {
      const slice = planIds.slice(i, i + chunkSize);
      const { data, error } = await adminClient
        .from('agent_pricing')
        .select('plan_id, retail_price, updated_at')
        .eq('agent_id', agentId)
        .in('plan_id', slice)
        .order('updated_at', { ascending: false });
      if (error) {
        console.error('agent_pricing fetch error', { index: i, error });
        return new Response(JSON.stringify({ error: 'Failed to fetch pricing' }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (data) csvPricing.push(...(data as any));
    }

    // Sort by updated_at desc to ensure latest wins
    csvPricing.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    // Build CSV price map (plan_id -> retail_price)
    const csvMap: Record<string, number> = {};
    for (const row of csvPricing) {
      if (csvMap[row.plan_id] === undefined) {
        csvMap[row.plan_id] = Number(row.retail_price);
      }
    }

    // STEP 2: Identify plans missing CSV pricing
    const missingPlanIds = planIds.filter(pid => csvMap[pid] === undefined);
    
    // STEP 3: Calculate prices for missing plans using pricing_rules
    if (missingPlanIds.length > 0) {
      // Fetch pricing rules once
      const { data: rulesData, error: rulesError } = await adminClient
        .from('pricing_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });
      
      if (rulesError) {
        console.error('pricing_rules fetch error', rulesError);
      }
      
      const rules = rulesData || [];
      
      // Fetch plan wholesale prices for missing plans in chunks to avoid URL length limits
      const PLAN_CHUNK_SIZE = 80;
      const allPlans: any[] = [];
      const totalChunks = Math.ceil(missingPlanIds.length / PLAN_CHUNK_SIZE);

      console.log(`Fetching ${missingPlanIds.length} missing plans in ${totalChunks} chunks`);

      for (let i = 0; i < missingPlanIds.length; i += PLAN_CHUNK_SIZE) {
        const chunk = missingPlanIds.slice(i, i + PLAN_CHUNK_SIZE);
        const chunkNum = Math.floor(i / PLAN_CHUNK_SIZE) + 1;
        
        console.log(`Fetching esim_plans chunk ${chunkNum}/${totalChunks} (${chunk.length} IDs)`);
        
        const { data: chunkData, error: chunkError } = await adminClient
          .from('esim_plans')
          .select('id, wholesale_price, country_code, supplier_plan_id')
          .in('id', chunk);
        
        if (chunkError) {
          console.error(`Error fetching esim_plans chunk ${chunkNum}:`, chunkError);
          return new Response(JSON.stringify({ error: 'Failed to fetch plan data' }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        allPlans.push(...(chunkData || []));
      }

      console.log(`Successfully fetched ${allPlans.length} plans from ${totalChunks} chunks`);
      const plansData = allPlans;
      const plansError = null;
      
      if (plansError) {
        console.error('esim_plans fetch error', plansError);
      }
      
      const plansMap = new Map((plansData || []).map(p => [p.id, p]));
      
      // Calculate price for each missing plan
      for (const planId of missingPlanIds) {
        const planData = plansMap.get(planId);
        if (!planData) continue;
        
        const wholesalePrice = Number(planData.wholesale_price) || 0;
        const countryCode = planData.country_code;
        const supplierPlanId = planData.supplier_plan_id;
        
        // Apply pricing rules logic (matching usePricingRules.ts)
        let selectedRule = null;
        let highestPriority = -1;
        
        for (const rule of rules) {
          // Check if rule matches
          let matches = false;
          
          if (rule.rule_type === 'global') {
            matches = true;
          } else if (rule.rule_type === 'country' && rule.target_id === countryCode) {
            matches = true;
          } else if (rule.rule_type === 'plan' && rule.target_id === planId) {
            matches = true;
          } else if (rule.rule_type === 'supplier_plan' && rule.target_id === supplierPlanId) {
            matches = true;
          }
          
          // Check agent filter if present
          if (matches && rule.agent_filter) {
            matches = rule.agent_filter === agentId;
          }
          
          // Select highest priority matching rule
          if (matches && rule.priority > highestPriority) {
            highestPriority = rule.priority;
            selectedRule = rule;
          }
        }
        
        // Calculate final price
        let finalPrice = wholesalePrice * 4; // Default 300% markup (4x) for agents
        
        if (selectedRule) {
          if (selectedRule.markup_type === 'percent') {
            const multiplier = 1 + (Number(selectedRule.markup_value) / 100);
            finalPrice = wholesalePrice * multiplier;
          } else if (selectedRule.markup_type === 'fixed') {
            finalPrice = Number(selectedRule.markup_value);
          }
        } else {
          // No rule matched - check partner type for fallback
          const { data: agentProfile } = await adminClient
            .from('agent_profiles')
            .select('partner_type')
            .eq('id', agentId)
            .single();
          
          if (agentProfile?.partner_type === 'api_partner') {
            finalPrice = wholesalePrice * 1.3; // 30% markup for API partners
          }
        }
        
        csvMap[planId] = finalPrice;
      }
    }

    return new Response(JSON.stringify({ prices: csvMap }), { 
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
