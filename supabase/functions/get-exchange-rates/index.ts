import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_RATES = {
  USD: 1,
  INR: 90,
  AUD: 1.58,
  EUR: 0.95
};

const CACHE_DURATION_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const exchangeRateApiKey = Deno.env.get('EXCHANGE_RATE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we have cached rates that are still fresh
    const { data: cachedRates, error: cacheError } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('base_currency', 'USD')
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cacheError && cachedRates) {
      const cacheAge = Date.now() - new Date(cachedRates.last_updated).getTime();
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);

      if (cacheAgeHours < CACHE_DURATION_HOURS) {
        console.log(`Using cached rates (${cacheAgeHours.toFixed(1)} hours old)`);
        return new Response(
          JSON.stringify({
            success: true,
            rates: cachedRates.rates,
            lastUpdated: cachedRates.last_updated,
            source: 'cache'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If no API key, use fallback rates
    if (!exchangeRateApiKey) {
      console.log('No API key configured, using fallback rates');
      return new Response(
        JSON.stringify({
          success: true,
          rates: FALLBACK_RATES,
          lastUpdated: new Date().toISOString(),
          source: 'fallback'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch fresh rates from ExchangeRate-API
    console.log('Fetching fresh exchange rates from API...');
    const apiUrl = `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/latest/USD`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.result === 'success') {
      const rates = {
        USD: data.conversion_rates.USD,
        INR: data.conversion_rates.INR,
        AUD: data.conversion_rates.AUD,
        EUR: data.conversion_rates.EUR
      };

      // Store in cache
      const { error: insertError } = await supabase
        .from('exchange_rates')
        .insert({
          base_currency: 'USD',
          rates: rates,
          last_updated: new Date().toISOString()
        });

      if (insertError) {
        console.error('Failed to cache rates:', insertError);
      } else {
        console.log('Successfully cached fresh rates');
      }

      return new Response(
        JSON.stringify({
          success: true,
          rates: rates,
          lastUpdated: new Date().toISOString(),
          source: 'api'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('API returned error:', data);
      throw new Error('Failed to fetch rates from API');
    }

  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    
    // Return fallback rates on any error
    return new Response(
      JSON.stringify({
        success: true,
        rates: FALLBACK_RATES,
        lastUpdated: new Date().toISOString(),
        source: 'fallback',
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
