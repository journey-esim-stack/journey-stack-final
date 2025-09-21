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
    // Authenticate admin user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user is admin
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const algoliaAppId = Deno.env.get('ALGOLIA_APPLICATION_ID');
    const algoliaAdminKey = Deno.env.get('ALGOLIA_ADMIN_API_KEY');

    if (!algoliaAppId || !algoliaAdminKey) {
      return new Response(
        JSON.stringify({ error: 'Algolia credentials not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Initialize Algolia client
    const algoliaHeaders = {
      'X-Algolia-Application-Id': algoliaAppId,
      'X-Algolia-API-Key': algoliaAdminKey,
      'Content-Type': 'application/json'
    };

    // Create index for eSIM plans
    const indexName = 'esim_plans';
    
    // Configure index settings
    const indexSettings = {
      searchableAttributes: [
        'title',
        'description', 
        'country_name',
        'data_amount',
        'unordered(country_code)'
      ],
      attributesForFaceting: [
        'country_code',
        'country_name',
        'supplier_name',
        'currency',
        'is_active',
        'data_amount_value',
        'validity_days'
      ],
      customRanking: [
        'desc(is_active)',
        'asc(retail_price)'
      ],
      ranking: [
        'words',
        'typo',
        'geo',
        'proximity',
        'attribute',
        'exact',
        'custom'
      ]
    };

    // Set index settings
    const settingsResponse = await fetch(
      `https://${algoliaAppId}-dsn.algolia.net/1/indexes/${indexName}/settings`,
      {
        method: 'PUT',
        headers: algoliaHeaders,
        body: JSON.stringify(indexSettings)
      }
    );

    if (!settingsResponse.ok) {
      const error = await settingsResponse.text();
      console.error('Failed to configure Algolia index:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to configure search index' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Get current eSIM plans data
    const { data: plans, error: plansError } = await supabaseClient
      .from('esim_plans')
      .select('*')
      .eq('is_active', true)
      .eq('admin_only', false);

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch plans data' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Transform plans data for Algolia
    const algoliaRecords = plans?.map(plan => {
      // Extract numeric value from data_amount for filtering
      const dataAmountMatch = plan.data_amount.match(/(\d+(?:\.\d+)?)/);
      const dataAmountValue = dataAmountMatch ? parseFloat(dataAmountMatch[1]) : 0;
      
      return {
        objectID: plan.id,
        ...plan,
        data_amount_value: dataAmountValue
      };
    }) || [];

    // Send initial data to Algolia
    const dataResponse = await fetch(
      `https://${algoliaAppId}-dsn.algolia.net/1/indexes/${indexName}/batch`,
      {
        method: 'POST',
        headers: algoliaHeaders,
        body: JSON.stringify({
          requests: algoliaRecords.map(record => ({
            action: 'addObject',
            body: record
          }))
        })
      }
    );

    if (!dataResponse.ok) {
      const error = await dataResponse.text();
      console.error('Failed to sync data to Algolia:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to sync initial data' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const dataResult = await dataResponse.json();
    console.log(`Successfully synced ${algoliaRecords.length} records to Algolia`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Algolia integration setup complete. Synced ${algoliaRecords.length} records.`,
        indexName,
        recordCount: algoliaRecords.length,
        taskID: dataResult.taskID
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in setup-algolia-sync:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});