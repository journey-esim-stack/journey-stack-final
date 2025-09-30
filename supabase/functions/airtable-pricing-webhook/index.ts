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
  supplier_plan_id: string;
  final_price: number;
}

// Internal rule format for database
interface PricingRule {
  record_id: string;
  rule_type: string;
  target_id: string;
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
        // Auto-populate all fields from simplified input
        const ruleData: PricingRule = {
          record_id: rule.record_id,
          rule_type: 'plan', // Always 'plan' for agent-specific pricing
          target_id: rule.supplier_plan_id, // The plan being priced
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
          supplier_plan_id: rule.supplier_plan_id,
          final_price: rule.final_price,
          auto_populated: ruleData
        })

        // Upsert the pricing rule
        const { error: upsertError } = await supabase
          .from('pricing_rules')
          .upsert({
            airtable_record_id: ruleData.record_id,
            rule_type: ruleData.rule_type,
            target_id: ruleData.target_id,
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
          console.error('❌ Error upserting rule:', upsertError)
          results.push({ 
            record_id: ruleData.record_id, 
            status: 'error', 
            error: upsertError.message 
          })
        } else {
          console.log('✅ Rule upserted successfully:', ruleData.record_id)
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
      
      const { error: deleteError } = await supabase
        .from('pricing_rules')
        .delete()
        .in('airtable_record_id', payload.deleted_records)

      if (deleteError) {
        console.error('❌ Error deleting rules:', deleteError)
      } else {
        console.log('✅ Deleted rules successfully')
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