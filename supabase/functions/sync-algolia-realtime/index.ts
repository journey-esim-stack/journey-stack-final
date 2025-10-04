import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlgoliaRecord {
  objectID: string;
  id: string;
  title: string;
  description: string;
  country_name: string;
  country_code: string;
  data_amount: string;
  data_amount_value: number;
  validity_days: number;
  currency: string;
  is_active: boolean;
  admin_only: boolean;
  created_at: string;
  updated_at: string;
}

async function transformSupabaseToAlgolia(supabaseRecord: any): Promise<AlgoliaRecord> {
  // Extract numeric value from data_amount string (e.g., "5GB" -> 5000, "500MB" -> 500)
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

  // Filter out sensitive fields before indexing
  return {
    objectID: supabaseRecord.id,
    id: supabaseRecord.id,
    title: supabaseRecord.title,
    description: supabaseRecord.description || '',
    country_name: supabaseRecord.country_name,
    country_code: supabaseRecord.country_code,
    data_amount: supabaseRecord.data_amount,
    data_amount_value: extractDataValue(supabaseRecord.data_amount),
    validity_days: supabaseRecord.validity_days,
    currency: supabaseRecord.currency,
    is_active: supabaseRecord.is_active,
    admin_only: supabaseRecord.admin_only || false,
    created_at: supabaseRecord.created_at,
    updated_at: supabaseRecord.updated_at,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Algolia real-time sync');

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Check if user is admin or approved agent
    let allowed = false;
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (role) allowed = true;

    if (!allowed) {
      const { data: agent } = await supabase
        .from('agent_profiles')
        .select('id,status')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .maybeSingle();
      
      if (agent) allowed = true;
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { 
        status: 403, 
        headers: corsHeaders 
      });
    }

    // Get Algolia credentials
    const appId = Deno.env.get('ALGOLIA_APPLICATION_ID');
    const adminKey = Deno.env.get('ALGOLIA_ADMIN_API_KEY');

    if (!appId || !adminKey) {
      return new Response(JSON.stringify({ error: 'Algolia credentials not configured' }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Parse request body for the operation
    const { operation, recordId, record } = await req.json();

    const algoliaUrl = `https://${appId}-dsn.algolia.net/1/indexes/esim_plans`;
    const algoliaHeaders = {
      'X-Algolia-Application-Id': appId,
      'X-Algolia-API-Key': adminKey,
      'Content-Type': 'application/json',
    };

    let algoliaResponse;

    switch (operation) {
      case 'INSERT':
      case 'UPDATE':
        const algoliaRecord = await transformSupabaseToAlgolia(record);
        
        algoliaResponse = await fetch(`${algoliaUrl}/${recordId}`, {
          method: 'PUT',
          headers: algoliaHeaders,
          body: JSON.stringify(algoliaRecord),
        });
        break;

      case 'DELETE':
        algoliaResponse = await fetch(`${algoliaUrl}/${recordId}`, {
          method: 'DELETE',
          headers: algoliaHeaders,
        });
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    if (!algoliaResponse.ok) {
      const errorText = await algoliaResponse.text();
      throw new Error(`Algolia API error: ${algoliaResponse.status} - ${errorText}`);
    }

    const result = await algoliaResponse.json();
    console.log(`Successfully synced ${operation} for record ${recordId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        operation,
        recordId,
        algoliaTaskId: result.taskID 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Algolia real-time sync error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Real-time sync failed', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: corsHeaders 
      }
    );
  }
});