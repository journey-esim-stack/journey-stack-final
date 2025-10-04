import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePriceCalculator } from './usePriceCalculator';

interface FallbackPlan {
  id: string;
  title: string;
  description: string;
  country_name: string;
  country_code: string;
  data_amount: string;
  validity_days: number;
  wholesale_price?: number;
  currency: string;
  supplier_name?: string;
  is_active: boolean;
  agent_price: number;
}

export const useAlgoliaFallback = () => {
  const [fallbackPlans, setFallbackPlans] = useState<FallbackPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { calculatePrice } = usePriceCalculator();

  const searchFallback = async (query: string = '', filters: Record<string, string> = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all visible plans via secure RPC with pagination
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error: supabaseError } = await supabase
          .rpc('get_agent_visible_plans')
          .range(from, from + pageSize - 1);
        
        if (supabaseError) throw supabaseError;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        
        from += pageSize;
      }

      // Apply client-side filters
      let filtered = allData;

      if (query.trim()) {
        const q = query.toLowerCase();
        filtered = filtered.filter(p =>
          (p.title || '').toLowerCase().includes(q) ||
          (p.country_name || '').toLowerCase().includes(q) ||
          (p.data_amount || '').toLowerCase().includes(q)
        );
      }

      if (filters.country_name) {
        filtered = filtered.filter(p => p.country_name === filters.country_name);
      }

      if (filters.validity_days) {
        filtered = filtered.filter(p => String(p.validity_days) === String(filters.validity_days));
      }

      // Map to expected shape; sensitive fields are intentionally absent
      const plansWithPricing = filtered.map(p => ({
        ...p,
        wholesale_price: 0,
        supplier_name: undefined,
        agent_price: 0
      } as any));

      setFallbackPlans(plansWithPricing as any);

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