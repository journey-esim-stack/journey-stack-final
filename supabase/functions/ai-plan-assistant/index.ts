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

    // Get agent profile
    const { data: agentProfile } = await supabase
      .from('agent_profiles')
      .select('id, markup_type, markup_value')
      .eq('user_id', user.id)
      .single();

    if (!agentProfile) {
      return new Response(JSON.stringify({ error: 'Agent profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an AI assistant for Journey Stack eSIM platform.

When a user asks about plans:
1. ALWAYS call the search_plans function immediately
2. After getting results, explain the top recommendations
3. Highlight key benefits: coverage, data, validity, price
4. Be concise and helpful

The search_plans function will return actual plan data that will be displayed as interactive tiles with "Add to Cart" buttons.`;

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
              description: 'Search eSIM plans by country. Returns top matching plans.',
              parameters: {
                type: 'object',
                properties: {
                  country: {
                    type: 'string',
                    description: 'Country name or code (e.g., "Japan", "France", "UAE")',
                  },
                  min_data_gb: {
                    type: 'number',
                    description: 'Minimum data in GB',
                  },
                  min_validity_days: {
                    type: 'number',
                    description: 'Minimum validity days',
                  },
                },
                required: ['country'],
              },
            },
          },
        ],
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('AI service error');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        let toolCallBuffer = '';
        let inToolCall = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              if (!line.startsWith('data: ')) continue;

              const data = line.slice(6);
              if (data === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;

                if (toolCalls && toolCalls[0]) {
                  inToolCall = true;
                  const args = toolCalls[0].function?.arguments || '';
                  toolCallBuffer += args;

                  // Try to parse accumulated tool call
                  try {
                    const toolArgs = JSON.parse(toolCallBuffer);
                    console.log('Tool call:', toolArgs);

                    // Search for plans
                    let query = supabase
                      .from('esim_plans')
                      .select('*')
                      .eq('is_active', true);

                    if (toolArgs.country) {
                      const country = toolArgs.country.toLowerCase();
                      query = query.or(`country_name.ilike.%${country}%,country_code.ilike.%${country}%`);
                    }

                    if (toolArgs.min_data_gb) {
                      query = query.gte('data_amount', `${toolArgs.min_data_gb}GB`);
                    }

                    if (toolArgs.min_validity_days) {
                      query = query.gte('validity_days', toolArgs.min_validity_days);
                    }

                    const { data: plans } = await query.limit(5);

                    if (plans && plans.length > 0) {
                      // Calculate agent prices
                      const markup = agentProfile.markup_type === 'percent' 
                        ? (agentProfile.markup_value || 300) / 100
                        : agentProfile.markup_value || 0;

                      const plansWithPrices = plans.map(plan => ({
                        id: plan.id,
                        title: plan.title,
                        country_name: plan.country_name,
                        country_code: plan.country_code,
                        data_amount: plan.data_amount,
                        validity_days: plan.validity_days,
                        agent_price: agentProfile.markup_type === 'percent'
                          ? Number(plan.wholesale_price) * (1 + markup)
                          : Number(plan.wholesale_price) + markup,
                        currency: plan.currency,
                      }));

                      // Send plans as a special SSE event
                      const plansEvent = {
                        type: 'plans',
                        plans: plansWithPrices,
                      };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(plansEvent)}\n\n`));
                    }

                    toolCallBuffer = '';
                    inToolCall = false;
                  } catch (e) {
                    // Still accumulating tool call JSON
                  }
                } else if (!inToolCall) {
                  // Regular content chunk
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              } catch (e) {
                console.error('Parse error:', e);
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
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
