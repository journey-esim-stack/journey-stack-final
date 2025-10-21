import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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

    // Listen for relevant auth changes only (avoid clearing on INITIAL_SESSION/TOKEN_REFRESHED)
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'SIGNED_IN') {
        console.log('[useAgentPlanPrices] Auth event:', event, '-> refetching agentId');
        fetchAgentId();
      }
    });

    return () => {
      authSub?.subscription?.unsubscribe?.();
    };
  }, [fetchAgentId]);

  const effectiveAgentId = previewAgentId || agentId;
  
  // Stable query key based on sorted plan IDs to prevent unnecessary refetches
  const queryKey = ['agent-plan-prices', effectiveAgentId, planIds.length > 0 ? planIds.sort().join(',') : 'empty'];

  // React Query with caching for instant subsequent loads
  const { data: prices = {}, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!effectiveAgentId || planIds.length === 0) {
        return {};
      }

      console.log(`[useAgentPlanPrices] Fetching ${planIds.length} prices for agent ${effectiveAgentId}`);
      const startTime = Date.now();

      try {
        const { data, error } = await supabase.functions.invoke('get-agent-plan-prices', {
          body: { agentId: effectiveAgentId, planIds }
        });

        if (error) {
          console.error('[useAgentPlanPrices] Edge function error', error);
          throw error;
        }

        const fetchTime = Date.now() - startTime;
        console.log(`[useAgentPlanPrices] Fetched ${planIds.length} prices in ${fetchTime}ms`);

        return (data?.prices || {}) as PlanPriceMap;
      } catch (error) {
        console.error('Error fetching agent plan prices:', error);
        throw error;
      }
    },
    enabled: !!effectiveAgentId && planIds.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes - prices don't change frequently
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
    retry: 1,
  });

  const getPrice = useCallback((planId: string): number | undefined => {
    return prices[planId];
  }, [prices]);

  // Listen for global agent pricing updates to invalidate React Query cache
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as { agentId?: string } | undefined;
      const updatedAgentId = detail?.agentId;
      if (!updatedAgentId || updatedAgentId !== effectiveAgentId) return;
      console.log('[useAgentPlanPrices] Pricing updated event received, refetching');
      refetch();
    };
    window.addEventListener('agent-pricing-updated', handler as EventListener);
    return () => window.removeEventListener('agent-pricing-updated', handler as EventListener);
  }, [refetch, effectiveAgentId]);

  // Realtime: refresh prices when agent_pricing changes for this agent (cross-session invalidation)
  useEffect(() => {
    if (!effectiveAgentId) return;
    const channel = supabase
      .channel(`agent_pricing_changes_${effectiveAgentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_pricing',
        filter: `agent_id=eq.${effectiveAgentId}`
      }, () => {
        console.log('[useAgentPlanPrices] Realtime pricing change detected -> refetch');
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveAgentId, refetch]);

  return { 
    prices, 
    loading: isLoading,
    isReady: !isLoading && !!effectiveAgentId,
    getPrice, 
    refetch 
  };
};
