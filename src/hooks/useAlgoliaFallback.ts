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
  const { calculatePrice } = usePriceCalculator();

  const searchFallback = async (query: string = '', filters: Record<string, string> = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all plans in batches using RPC with pagination
      let allPlans: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: rpcData, error: rpcError } = await (supabase as any)
          .rpc('get_agent_visible_plans')
          .range(from, from + batchSize - 1);
        
        if (rpcError) throw rpcError;

        const batch = Array.isArray(rpcData) ? rpcData : [];
        if (batch.length > 0) {
          allPlans.push(...batch);
          hasMore = batch.length === batchSize;
          from += batchSize;
        } else {
          hasMore = false;
        }
      }

      let plans = allPlans;

      // Apply client-side search and filters
      if (query.trim()) {
        const q = query.toLowerCase();
        plans = plans.filter(plan =>
          plan.title?.toLowerCase().includes(q) ||
          plan.country_name?.toLowerCase().includes(q) ||
          plan.data_amount?.toLowerCase().includes(q)
        );
      }

      if (filters.country_name) {
        plans = plans.filter(plan => plan.country_name === filters.country_name);
      }

      if (filters.supplier_name) {
        plans = plans.filter(plan => plan.supplier_name === filters.supplier_name);
      }

      if (filters.validity_days) {
        plans = plans.filter(plan => plan.validity_days === parseInt(filters.validity_days));
      }

      // Apply agent pricing
      const plansWithPricing = plans.map(plan => ({
        ...plan,
        agent_price: calculatePrice(plan.wholesale_price, { supplierPlanId: plan.supplier_plan_id, countryCode: plan.country_code, planId: plan.id })
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