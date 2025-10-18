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
    
    // Configure optimized index settings based on implementation guide
    const indexSettings = {
      searchableAttributes: [
        'country_name',  // Prioritize country for accurate country-based search
        'title',
        'data_amount',
        'description'
      ],
      attributesForFaceting: [
        'filterOnly(country_name)',
        'filterOnly(supplier_name)', 
        'filterOnly(validity_days)',
        'filterOnly(is_active)',
        'filterOnly(admin_only)',
        'searchable(country_name)'
      ],
      customRanking: [
        'desc(data_amount_value)',
        'asc(wholesale_price)',
        'desc(updated_at)'
      ],
      ranking: [
        'typo',
        'geo', 
        'words',
        'filters',
        'proximity',
        'attribute', 
        'exact',
        'custom'
      ],
      attributesToRetrieve: [
        'objectID', 'id', 'title', 'description', 'country_name', 
        'country_code', 'data_amount', 'validity_days', 'wholesale_price', 
        'currency', 'supplier_name', 'supplier_plan_id', 'is_active', 'admin_only'
      ],
      attributesToHighlight: ['title', 'country_name', 'data_amount'],
      attributesToSnippet: ['description:20'],
      hitsPerPage: 24,
      maxValuesPerFacet: 100,
      typoTolerance: true,
      minWordSizefor1Typo: 4,
      minWordSizefor2Typos: 8,
      removeWordsIfNoResults: 'none',  // Changed from 'allOptional' to prevent irrelevant results
      queryType: 'prefixLast',
      queryLanguages: ['en'],  // Added for better language-specific search
      ignorePlurals: true,  // Added to handle singular/plural variations
      advancedSyntax: true,  // Added for advanced query features
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      snippetEllipsisText: '…'
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

    // Get current eSIM plans data with pagination to bypass 1000-row limit
    const pageSize = 1000;
    let fromIndex = 0;
    let allPlans: any[] = [];

    while (true) {
      const { data: page, error: pageError } = await supabaseClient
        .from('esim_plans')
        .select('*')
        .eq('is_active', true)
        .eq('admin_only', false)
        .range(fromIndex, fromIndex + pageSize - 1);

      if (pageError) {
        console.error('Error fetching plans page:', pageError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch plans data' }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (page && page.length > 0) {
        allPlans = allPlans.concat(page);
      }

      if (!page || page.length < pageSize) break; // last page reached
      fromIndex += pageSize;
    }

    const plans = allPlans;

    // Transform plans data for Algolia with enhanced data processing
    const algoliaRecords = plans?.map(plan => {
      // Extract numeric value from data_amount for better filtering and sorting
      const extractDataValue = (dataStr: string): number => {
        const match = dataStr.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
        if (!match) return 0;
        
        const [, value, unit] = match;
        const numValue = parseFloat(value);
        
        switch (unit.toUpperCase()) {
          case 'TB': return numValue * 1000000;
          case 'GB': return numValue * 1000;
          case 'MB': return numValue;
          default: return numValue;
        }
      };
      
      return {
        objectID: plan.id,
        id: plan.id,
        title: plan.title,
        description: plan.description || '',
        country_name: plan.country_name,
        country_code: plan.country_code,
        data_amount: plan.data_amount,
        data_amount_value: extractDataValue(plan.data_amount),
        validity_days: plan.validity_days,
        wholesale_price: parseFloat(plan.wholesale_price),
        currency: plan.currency,
        supplier_name: plan.supplier_name,
        supplier_plan_id: plan.supplier_plan_id,
        is_active: plan.is_active,
        admin_only: plan.admin_only,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
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