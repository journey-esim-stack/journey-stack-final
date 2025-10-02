import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAgentPreview } from '@/contexts/AgentPreviewContext';

interface PlanPriceMap {
  [planId: string]: number;
}

/**
 * Hook to batch-fetch agent-specific prices for multiple plans at once
 * Prioritizes agent_pricing table, falls back to pricing_rules calculation
 */
export const useAgentPlanPrices = (planIds: string[]) => {
  const [prices, setPrices] = useState<PlanPriceMap>({});
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const { previewAgentId } = useAgentPreview();
  const [agentId, setAgentId] = useState<string | null>(null);
  const fetchedPlanIdsRef = useRef<Set<string>>(new Set());

  // Get current agent ID
  const fetchAgentId = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAgentId(null);
        return;
      }

      const { data: profile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      setAgentId(profile?.id || null);
    } catch (error) {
      console.error('Error fetching agent ID:', error);
      setAgentId(null);
    }
  }, []);

  useEffect(() => {
    fetchAgentId();
  }, [fetchAgentId]);

  // Fetch prices for specific plan IDs
  const fetchPrices = useCallback(async (idsToFetch: string[]) => {
    if (idsToFetch.length === 0) {
      setLoading(false);
      setInitialLoadComplete(true);
      return;
    }

    const effectiveAgentId = previewAgentId || agentId;
    if (!effectiveAgentId) {
      setLoading(false);
      setInitialLoadComplete(true);
      return;
    }

    try {
      // Batch-fetch from agent_pricing table
      const { data: agentPricing, error } = await supabase
        .from('agent_pricing')
        .select('plan_id, retail_price')
        .eq('agent_id', effectiveAgentId)
        .in('plan_id', idsToFetch);

      if (error) throw error;

      const priceMap: PlanPriceMap = {};
      agentPricing?.forEach(ap => {
        priceMap[ap.plan_id] = Number(ap.retail_price);
        fetchedPlanIdsRef.current.add(ap.plan_id);
      });

      // CRITICAL FIX: Merge instead of replace to prevent flickering
      setPrices(prev => ({ ...prev, ...priceMap }));
    } catch (error) {
      console.error('Error fetching agent plan prices:', error);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [agentId, previewAgentId]);

  useEffect(() => {
    if (agentId || previewAgentId) {
      // Only fetch prices for plan IDs we haven't fetched yet
      const newPlanIds = planIds.filter(id => !fetchedPlanIdsRef.current.has(id));
      
      if (newPlanIds.length > 0) {
        setLoading(true);
        fetchPrices(newPlanIds);
      } else if (!initialLoadComplete) {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    }
  }, [planIds, agentId, previewAgentId, fetchPrices, initialLoadComplete]);

  const getPrice = useCallback((planId: string): number | undefined => {
    return prices[planId];
  }, [prices]);

  const refetch = useCallback(() => {
    fetchedPlanIdsRef.current.clear();
    setPrices({});
    setInitialLoadComplete(false);
    fetchPrices(planIds);
  }, [planIds, fetchPrices]);

  return { 
    prices, 
    loading: loading && !initialLoadComplete, 
    getPrice, 
    refetch 
  };
};
