import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AirtableRule {
  record_id: string;
  rule_type: string; // 'agent', 'country', 'plan', 'default'
  target_id?: string; // agent_id, country_code, plan_id
  markup_type: string; // 'percent' or 'fixed'
  markup_value: number;
  min_order_amount?: number;
  max_order_amount?: number | null;
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

    // Process each rule from Airtable
    const results = []
    
    for (const rule of payload.rules || []) {
      try {
        const ruleData: AirtableRule = {
          record_id: rule.record_id,
          rule_type: rule.rule_type,
          target_id: rule.target_id || null,
          markup_type: rule.markup_type || 'percent',
          markup_value: parseFloat(rule.markup_value) || 300,
          min_order_amount: rule.min_order_amount ? parseFloat(rule.min_order_amount) : 0,
          max_order_amount: rule.max_order_amount ? parseFloat(rule.max_order_amount) : undefined,
          is_active: rule.is_active !== false, // Default to true
          priority: parseInt(rule.priority) || 100
        }

        console.log('💡 Processing rule:', ruleData)

        // Upsert the pricing rule
        const { error: upsertError } = await supabase
          .from('pricing_rules')
          .upsert({
            airtable_record_id: ruleData.record_id,
            rule_type: ruleData.rule_type,
            target_id: ruleData.target_id,
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