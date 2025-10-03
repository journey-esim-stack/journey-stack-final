import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePricingRules } from './usePricingRules';
import { useAgentPreview } from '@/contexts/AgentPreviewContext';

/**
 * Centralized price calculator hook
 * Uses pricing_rules system with Airtable integration
 * Note: For CSV-uploaded agent_pricing, use useAgentPlanPrices hook directly
 * Default: 300% markup, overridden by pricing rules
 */
export const usePriceCalculator = () => {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentResolved, setAgentResolved] = useState(false);
  const { previewAgentId } = useAgentPreview();
  const { calculatePrice: calculatePriceWithRules, loading: rulesLoading, refetch: refetchRules, getAppliedRule } = usePricingRules();

  // Fetch current agent ID
  const fetchAgentId = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAgentId(null);
        setLoading(false);
        setAgentResolved(true);
        return;
      }

      const { data: profile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      setAgentId(profile?.id || null);
      setAgentResolved(true);
    } catch (error) {
      console.error('Error fetching agent ID:', error);
      setAgentId(null);
      setAgentResolved(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate price using pricing rules (fallback for when agent_pricing is not available)
  const calculatePrice = useCallback((
    wholesalePrice: number,
    options?: {
      countryCode?: string;
      planId?: string;
      supplierPlanId?: string;
    }
  ): number => {
    // Use preview agent ID if available (for admin testing), otherwise use actual agent ID
    const effectiveAgentId = previewAgentId || agentId;

    // Evaluate pricing rules (plan/country/agent-specific/default). Falls back to 300% if no matches.
    return calculatePriceWithRules({
      wholesalePrice,
      agentId: effectiveAgentId || undefined,
      countryCode: options?.countryCode,
      planId: options?.planId,
      supplierPlanId: options?.supplierPlanId
    });
  }, [agentId, previewAgentId, calculatePriceWithRules]);

  // Debug meta
  const debugGetPriceMeta = useCallback((
    wholesalePrice: number,
    options?: {
      countryCode?: string;
      planId?: string;
      supplierPlanId?: string;
    }
  ) => {
    const effectiveAgentId = previewAgentId || agentId;
    return getAppliedRule({
      wholesalePrice,
      agentId: effectiveAgentId || undefined,
      countryCode: options?.countryCode,
      planId: options?.planId,
      supplierPlanId: options?.supplierPlanId
    });
  }, [agentId, previewAgentId, getAppliedRule]);

  // Refresh pricing rules
  const refreshPricing = useCallback(async () => {
    await refetchRules();
  }, [refetchRules]);

  useEffect(() => {
    fetchAgentId();

    // Listen for auth changes
    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      fetchAgentId();
    });

    return () => {
      authSub?.subscription?.unsubscribe?.();
    };
  }, [fetchAgentId]);

  return {
    calculatePrice,
    loading: loading || rulesLoading,
    refreshPricing,
    agentId: previewAgentId || agentId,
    agentResolved,
    debugGetPriceMeta,
  };
};