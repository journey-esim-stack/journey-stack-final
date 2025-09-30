import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePricingRules } from './usePricingRules';
import { useAgentPreview } from '@/contexts/AgentPreviewContext';

/**
 * Centralized price calculator hook
 * Uses the new pricing_rules system with Airtable integration
 * Default: 300% markup, overridden by Airtable custom prices
 */
export const usePriceCalculator = () => {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { previewAgentId } = useAgentPreview();
  const { calculatePrice: calculatePriceWithRules, loading: rulesLoading, refetch: refetchRules } = usePricingRules();

  // Fetch current agent ID
  const fetchAgentId = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAgentId(null);
        setLoading(false);
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
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate price using pricing rules
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

    if (!effectiveAgentId) {
      // Fallback to default 300% markup if no agent
      return wholesalePrice * 4;
    }

    return calculatePriceWithRules({
      wholesalePrice,
      agentId: effectiveAgentId,
      countryCode: options?.countryCode,
      planId: options?.planId,
      supplierPlanId: options?.supplierPlanId
    });
  }, [agentId, previewAgentId, calculatePriceWithRules]);

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
    agentId: previewAgentId || agentId
  };
};