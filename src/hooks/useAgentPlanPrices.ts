import { useState, useEffect, useCallback } from 'react';
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
  const { previewAgentId } = useAgentPreview();
  const [agentId, setAgentId] = useState<string | null>(null);

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

  // Fetch prices for all plan IDs
  const fetchPrices = useCallback(async () => {
    if (planIds.length === 0) {
      setPrices({});
      setLoading(false);
      return;
    }

    const effectiveAgentId = previewAgentId || agentId;
    if (!effectiveAgentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Batch-fetch from agent_pricing table
      const { data: agentPricing, error } = await supabase
        .from('agent_pricing')
        .select('plan_id, retail_price')
        .eq('agent_id', effectiveAgentId)
        .in('plan_id', planIds);

      if (error) throw error;

      const priceMap: PlanPriceMap = {};
      agentPricing?.forEach(ap => {
        priceMap[ap.plan_id] = Number(ap.retail_price);
      });

      setPrices(priceMap);
    } catch (error) {
      console.error('Error fetching agent plan prices:', error);
      setPrices({});
    } finally {
      setLoading(false);
    }
  }, [planIds, agentId, previewAgentId]);

  useEffect(() => {
    if (agentId || previewAgentId) {
      fetchPrices();
    }
  }, [fetchPrices, agentId, previewAgentId]);

  const getPrice = useCallback((planId: string): number | undefined => {
    return prices[planId];
  }, [prices]);

  return { prices, loading, getPrice, refetch: fetchPrices };
};
