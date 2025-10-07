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
  const lastAgentIdRef = useRef<string | null>(null);
  const hasAttemptedFetchRef = useRef(false);

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
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        console.log('[useAgentPlanPrices] Auth event:', event, '-> refetching agentId and clearing cache');
        setLoading(true);
        fetchedPlanIdsRef.current.clear();
        setPrices({});
        setInitialLoadComplete(false);
        hasAttemptedFetchRef.current = false;
        fetchAgentId();
      } else if (event === 'SIGNED_IN') {
        console.log('[useAgentPlanPrices] Auth event:', event, '-> refetching agentId without clearing cache');
        // Do not clear cache on SIGNED_IN to avoid UI flicker
        hasAttemptedFetchRef.current = false;
        fetchAgentId();
      } else {
        // Ignoring noise events like INITIAL_SESSION/TOKEN_REFRESHED to prevent flicker
      }
    });

    return () => {
      authSub?.subscription?.unsubscribe?.();
    };
  }, [fetchAgentId]);

  // Fetch prices for specific plan IDs
  const fetchPrices = useCallback(async (idsToFetch: string[]) => {
    if (idsToFetch.length === 0) {
      setLoading(false);
      // Only mark complete if we've already attempted a fetch before
      if (hasAttemptedFetchRef.current) {
        setInitialLoadComplete(true);
      }
      return;
    }

    hasAttemptedFetchRef.current = true;

    const effectiveAgentId = previewAgentId || agentId;
    if (!effectiveAgentId) {
      setLoading(false);
      setInitialLoadComplete(true);
      return;
    }

    try {
      // Prefer Edge Function to avoid URL length limits and ensure auth checks
      const { data, error } = await supabase.functions.invoke('get-agent-plan-prices', {
        body: { agentId: effectiveAgentId, planIds: idsToFetch }
      });

      if (error) {
        console.error('[useAgentPlanPrices] Edge function error', error);
        // Fallback to chunked REST calls if function fails
        const chunkSize = 100;
        const allResults: Array<{ plan_id: string; retail_price: number }> = [];
        for (let i = 0; i < idsToFetch.length; i += chunkSize) {
          const planSlice = idsToFetch.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from('agent_pricing')
            .select('plan_id, retail_price')
            .eq('agent_id', effectiveAgentId)
            .in('plan_id', planSlice);
          if (error) {
            console.error('[useAgentPlanPrices] Chunk fetch error', { index: i, size: planSlice.length, error });
            continue;
          }
          if (data) allResults.push(...(data as any));
        }
        const priceMap: PlanPriceMap = {};
        allResults.forEach((ap) => {
          priceMap[ap.plan_id] = Number(ap.retail_price);
          fetchedPlanIdsRef.current.add(ap.plan_id);
        });
        setPrices((prev) => ({ ...prev, ...priceMap }));
      } else {
        const priceMap: PlanPriceMap = data?.prices || {};
        // Mark fetched
        Object.keys(priceMap).forEach((pid) => fetchedPlanIdsRef.current.add(pid));
        setPrices((prev) => ({ ...prev, ...priceMap }));
      }
    } catch (error) {
      console.error('Error fetching agent plan prices:', error);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [agentId, previewAgentId]);

  const effectiveAgentId = previewAgentId || agentId;

  // Respond to agent change: clear cache and refetch
  useEffect(() => {
    if (!effectiveAgentId) {
      setLoading(false);
      setInitialLoadComplete(true);
      return;
    }

    if (lastAgentIdRef.current !== effectiveAgentId) {
      lastAgentIdRef.current = effectiveAgentId;
      fetchedPlanIdsRef.current.clear();
      setPrices({});
      setInitialLoadComplete(false);
      hasAttemptedFetchRef.current = false;
      setLoading(true);
      fetchPrices(planIds);
      return;
    }

    // Only fetch prices for plan IDs we haven't fetched yet
    const newPlanIds = planIds.filter(id => !fetchedPlanIdsRef.current.has(id));
    if (newPlanIds.length > 0) {
      setLoading(true);
      fetchPrices(newPlanIds);
    } else if (!initialLoadComplete) {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [effectiveAgentId, planIds, fetchPrices, initialLoadComplete]);

  const getPrice = useCallback((planId: string): number | undefined => {
    return prices[planId];
  }, [prices]);

  const refetch = useCallback(() => {
    fetchedPlanIdsRef.current.clear();
    setPrices({});
    setInitialLoadComplete(false);
    fetchPrices(planIds);
  }, [planIds, fetchPrices]);

  // Listen for global agent pricing updates to invalidate cache
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as { agentId?: string } | undefined;
      const updatedAgentId = detail?.agentId;
      const currentEffective = previewAgentId || agentId || null;
      if (!updatedAgentId || updatedAgentId !== currentEffective) return;
      refetch();
    };
    window.addEventListener('agent-pricing-updated', handler as EventListener);
    return () => window.removeEventListener('agent-pricing-updated', handler as EventListener);
  }, [refetch, agentId, previewAgentId]);

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

  // isReady means: we have an agent ID AND we've completed initial load
  const isReady = !!effectiveAgentId && initialLoadComplete;

  return { 
    prices, 
    loading: loading && !initialLoadComplete,
    isReady,
    getPrice, 
    refetch 
  };
};
