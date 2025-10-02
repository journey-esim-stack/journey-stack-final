import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simplified input format from Airtable
interface AirtableSimplifiedRule {
  record_id: string;
  agent_id: string;
  plan_id?: string; // Preferred: UUID from esim_plans.id
  supplier_plan_id?: string; // Backward-compat: treat as plan_id if provided
  final_price: number;
}

// Internal rule format for database
interface PricingRule {
  record_id: string;
  rule_type: string;
  target_id: string | null;
  plan_id: string; // UUID reference to esim_plans.id
  agent_filter: string;
  markup_type: string;
  markup_value: number;
  min_order_amount: number;
  max_order_amount: number | null;
  is_active: boolean;
  priority: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🎯 Airtable webhook received')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log('📦 Webhook payload:', JSON.stringify(payload, null, 2))

    // Process each rule from Airtable (simplified 3-column format)
    const results = []
    
    for (const rule of payload.rules || []) {
      try {
        // Normalize plan id: accept plan_id (preferred) or supplier_plan_id (back-compat)
        const incomingPlanId = (rule.plan_id ?? rule.supplier_plan_id)?.toString().trim();
        if (!incomingPlanId || incomingPlanId === '#N/A') {
          console.warn('⚠️ Skipping rule - missing plan_id', { record_id: rule.record_id, keys: Object.keys(rule) });
          results.push({
            record_id: rule.record_id,
            status: 'error',
            error: 'Missing plan_id (ensure your webhook sends plan_id UUID)'
          });
          continue;
        }

        // Validate if incomingPlanId is a UUID; if not, look up by supplier_plan_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let finalPlanId = incomingPlanId;
        
        if (!uuidRegex.test(incomingPlanId)) {
          // Not a UUID - assume it's a supplier_plan_id, look up the real UUID
          console.log(`🔍 Looking up plan UUID for supplier_plan_id: ${incomingPlanId}`);
          const { data: planData, error: lookupError } = await supabase
            .from('esim_plans')
            .select('id')
            .ilike('supplier_plan_id', incomingPlanId)
            .limit(1)
            .single();
          
          if (lookupError || !planData) {
            console.warn(`⚠️ No plan found for supplier_plan_id: ${incomingPlanId}`);
            results.push({
              record_id: rule.record_id,
              status: 'error',
              error: `Plan not found for supplier_plan_id: ${incomingPlanId}`
            });
            continue;
          }
          
          finalPlanId = planData.id;
          console.log(`✅ Resolved ${incomingPlanId} → ${finalPlanId}`);
        }

        // Auto-populate all fields from simplified input
        const ruleData: PricingRule = {
          record_id: rule.record_id,
          rule_type: 'plan', // Always 'plan' for agent-specific pricing
          target_id: null, // DEPRECATED: No longer used for plan rules
          plan_id: finalPlanId, // UUID from esim_plans.id
          agent_filter: rule.agent_id, // The specific agent
          markup_type: 'fixed_price', // Always fixed price
          markup_value: parseFloat(rule.final_price), // The final retail price
          min_order_amount: 0, // No minimum
          max_order_amount: null, // No maximum
          is_active: true, // Active by default
          priority: 1 // Highest priority for agent-specific rules
        }

        console.log('💡 Processing simplified rule:', {
          agent_id: rule.agent_id,
          incoming_plan_id: incomingPlanId,
          final_plan_id: finalPlanId,
          final_price: rule.final_price,
          received_keys: Object.keys(rule),
          auto_populated: ruleData
        })

        // Upsert the pricing rule
        const { error: upsertError } = await supabase
          .from('pricing_rules')
          .upsert({
            airtable_record_id: ruleData.record_id,
            rule_type: ruleData.rule_type,
            target_id: ruleData.target_id,
            plan_id: ruleData.plan_id,
            agent_filter: ruleData.agent_filter,
            markup_type: ruleData.markup_type,
            markup_value: ruleData.markup_value,
            min_order_amount: ruleData.min_order_amount,
            max_order_amount: ruleData.max_order_amount,
            is_active: ruleData.is_active,
            priority: ruleData.priority
          }, {
            onConflict: 'airtable_record_id',
            ignoreDuplicates: false
          })

        if (upsertError) {
          console.error('❌ Error upserting pricing_rules:', upsertError)
          results.push({ 
            record_id: ruleData.record_id, 
            status: 'error', 
            error: upsertError.message 
          })
        } else {
          console.log('✅ pricing_rules upserted:', ruleData.record_id)

          // Also upsert to agent_pricing for fast lookups
          const { error: agentPricingError } = await supabase
            .from('agent_pricing')
            .upsert({
              agent_id: ruleData.agent_filter,
              plan_id: ruleData.plan_id,
              retail_price: ruleData.markup_value
            }, {
              onConflict: 'agent_id,plan_id',
              ignoreDuplicates: false
            })

          if (agentPricingError) {
            console.error('⚠️ Error upserting agent_pricing:', agentPricingError)
          } else {
            console.log('✅ agent_pricing upserted for agent:', ruleData.agent_filter)
          }

          results.push({ 
            record_id: ruleData.record_id, 
            status: 'success' 
          })
        }
        } catch (ruleError) {
          console.error('❌ Error processing individual rule:', ruleError)
          results.push({ 
            record_id: rule.record_id || 'unknown', 
            status: 'error', 
            error: ruleError instanceof Error ? ruleError.message : 'Unknown error'
          })
        }
    }

    // Handle deleted rules if provided
    if (payload.deleted_records && payload.deleted_records.length > 0) {
      console.log('🗑️ Processing deleted records:', payload.deleted_records)
      
      // Get agent_filter and plan_id for deletion from agent_pricing
      const { data: rulesToDelete } = await supabase
        .from('pricing_rules')
        .select('agent_filter, plan_id')
        .in('airtable_record_id', payload.deleted_records)

      const { error: deleteError } = await supabase
        .from('pricing_rules')
        .delete()
        .in('airtable_record_id', payload.deleted_records)

      if (deleteError) {
        console.error('❌ Error deleting pricing_rules:', deleteError)
      } else {
        console.log('✅ Deleted pricing_rules successfully')

        // Also delete from agent_pricing
        if (rulesToDelete && rulesToDelete.length > 0) {
          for (const rule of rulesToDelete) {
            if (rule.agent_filter && rule.plan_id) {
              await supabase
                .from('agent_pricing')
                .delete()
                .eq('agent_id', rule.agent_filter)
                .eq('plan_id', rule.plan_id)
            }
          }
          console.log('✅ Deleted corresponding agent_pricing rows')
        }
      }
    }

    console.log('🎉 Webhook processing completed')
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pricing rules updated successfully',
        results: results,
        processed_count: results.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('🚨 Webhook error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})