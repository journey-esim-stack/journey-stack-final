import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔧 Starting pricing rules backfill...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find all plan rules with NULL plan_id but non-NULL target_id
    const { data: rulesToFix, error: fetchError } = await supabase
      .from('pricing_rules')
      .select('id, target_id, airtable_record_id')
      .eq('rule_type', 'plan')
      .is('plan_id', null)
      .not('target_id', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    console.log(`📊 Found ${rulesToFix?.length || 0} rules to backfill`)

    const results = []
    let fixed = 0
    let notFound = 0

    for (const rule of rulesToFix || []) {
      // Look up the plan by supplier_plan_id (case-insensitive)
      const { data: planData, error: planError } = await supabase
        .from('esim_plans')
        .select('id, supplier_plan_id')
        .ilike('supplier_plan_id', rule.target_id)
        .limit(1)
        .single()

      if (planError || !planData) {
        console.warn(`⚠️ No plan found for supplier_plan_id: ${rule.target_id}`)
        notFound++
        results.push({
          rule_id: rule.id,
          target_id: rule.target_id,
          status: 'not_found'
        })
        continue
      }

      // Update the pricing rule with the correct plan_id UUID
      const { error: updateError } = await supabase
        .from('pricing_rules')
        .update({ plan_id: planData.id })
        .eq('id', rule.id)

      if (updateError) {
        console.error(`❌ Failed to update rule ${rule.id}:`, updateError)
        results.push({
          rule_id: rule.id,
          target_id: rule.target_id,
          status: 'error',
          error: updateError.message
        })
      } else {
        console.log(`✅ Updated rule ${rule.id}: ${rule.target_id} → ${planData.id}`)
        fixed++
        results.push({
          rule_id: rule.id,
          target_id: rule.target_id,
          plan_id: planData.id,
          status: 'fixed'
        })
      }
    }

    console.log(`🎉 Backfill complete: ${fixed} fixed, ${notFound} not found`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backfill completed',
        stats: {
          total: rulesToFix?.length || 0,
          fixed,
          not_found: notFound
        },
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('🚨 Backfill error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
