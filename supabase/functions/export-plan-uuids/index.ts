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
    console.log('📊 Generating CSV export of plan UUIDs')
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify user is authenticated and is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!roles) {
      throw new Error('Admin access required')
    }

    console.log('✅ Admin verified, fetching plans...')

    // Fetch all active plans with their UUIDs
    const { data: plans, error: plansError } = await supabase
      .from('esim_plans')
      .select('id, supplier_plan_id, title, country_code, data_amount, validity_days, supplier_name')
      .eq('is_active', true)
      .order('country_code')
      .order('title')

    if (plansError) {
      throw plansError
    }

    console.log(`📦 Fetched ${plans?.length || 0} plans`)

    // Generate CSV content
    const headers = [
      'old_supplier_code',
      'new_plan_uuid',
      'plan_title',
      'country_code',
      'data_amount',
      'validity_days',
      'supplier_name'
    ]

    let csvContent = headers.join(',') + '\n'

    for (const plan of plans || []) {
      const row = [
        `"${plan.supplier_plan_id}"`,
        `"${plan.id}"`,
        `"${plan.title?.replace(/"/g, '""') || ''}"`, // Escape quotes in title
        `"${plan.country_code}"`,
        `"${plan.data_amount}"`,
        `"${plan.validity_days}"`,
        `"${plan.supplier_name}"`
      ]
      csvContent += row.join(',') + '\n'
    }

    console.log('✅ CSV generated successfully')

    // Return CSV file
    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="plan-uuid-mapping.csv"',
      },
      status: 200
    })

  } catch (error) {
    console.error('❌ Error generating CSV:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})