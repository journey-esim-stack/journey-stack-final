import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // System prompt with eSIM business context
    const systemPrompt = `You are an AI assistant for Journey Stack, an eSIM platform for travel businesses.

Your role is to help agents find the best eSIM plans for their customers based on:
- Travel destination(s)
- Trip duration
- Data requirements
- Budget constraints
- Coverage needs (single country vs regional)

You have access to tools to search the plan database. When recommending plans:
1. Ask clarifying questions if needed (destination, duration, data needs)
2. Use the search tool to find matching plans
3. Present options in order of best value
4. Explain key differences (coverage, validity, data amount)
5. Mention when regional plans offer better value than single-country plans
6. Keep responses concise and helpful

Always show prices in the agent's currency. Focus on helping agents make informed decisions for their customers.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_plans',
              description: 'Search eSIM plans by country, data amount, validity days, or price range. Returns matching plans with details.',
              parameters: {
                type: 'object',
                properties: {
                  country: {
                    type: 'string',
                    description: 'Country name or code (e.g., "France", "FR", "United States")',
                  },
                  min_data_gb: {
                    type: 'number',
                    description: 'Minimum data amount in GB',
                  },
                  max_data_gb: {
                    type: 'number',
                    description: 'Maximum data amount in GB',
                  },
                  min_validity_days: {
                    type: 'number',
                    description: 'Minimum validity period in days',
                  },
                  max_price_usd: {
                    type: 'number',
                    description: 'Maximum wholesale price in USD',
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default 10)',
                  },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please contact support.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stream the response back to client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
