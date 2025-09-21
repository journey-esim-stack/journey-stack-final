import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAgentMarkup } from './useAgentMarkup';

interface FallbackPlan {
  id: string;
  title: string;
  description: string;
  country_name: string;
  country_code: string;
  data_amount: string;
  validity_days: number;
  wholesale_price: number;
  currency: string;
  supplier_name: string;
  is_active: boolean;
  agent_price: number;
}

export const useAlgoliaFallback = () => {
  const [fallbackPlans, setFallbackPlans] = useState<FallbackPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { calculatePrice } = useAgentMarkup();

  const searchFallback = async (query: string = '', filters: Record<string, string> = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      let supabaseQuery = supabase
        .from('esim_plans')
        .select('*')
        .eq('is_active', true)
        .eq('admin_only', false);

      // Apply search query
      if (query.trim()) {
        supabaseQuery = supabaseQuery.or(
          `title.ilike.%${query}%,country_name.ilike.%${query}%,data_amount.ilike.%${query}%`
        );
      }

      // Apply country filter
      if (filters.country_name) {
        supabaseQuery = supabaseQuery.eq('country_name', filters.country_name);
      }

      // Apply supplier filter
      if (filters.supplier_name) {
        supabaseQuery = supabaseQuery.eq('supplier_name', filters.supplier_name);
      }

      // Apply validity filter
      if (filters.validity_days) {
        supabaseQuery = supabaseQuery.eq('validity_days', parseInt(filters.validity_days));
      }

      const { data, error: supabaseError } = await supabaseQuery
        .order('country_name')
        .limit(100);

      if (supabaseError) throw supabaseError;

      const plansWithPricing = (data || []).map(plan => ({
        ...plan,
        agent_price: calculatePrice(plan.wholesale_price)
      }));

      setFallbackPlans(plansWithPricing);
    } catch (err) {
      console.error('Fallback search error:', err);
      setError('Failed to load plans from fallback source');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fallbackPlans,
    searchFallback,
    isLoading,
    error
  };
};