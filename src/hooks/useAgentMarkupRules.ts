import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePricingRules } from './usePricingRules';

interface AgentMarkup {
  markup_type: string;
  markup_value: number;
}

export const useAgentMarkupRules = () => {
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);
  const { calculatePrice: calculatePriceWithRules, loading: rulesLoading } = usePricingRules();

  // Get current agent ID
  const fetchAgentProfile = useCallback(async () => {
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
      console.error('Error fetching agent profile:', error);
      setAgentId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate price using the new rules-based system
  const calculatePrice = useCallback((
    wholesalePrice: number, 
    options?: { 
      countryCode?: string; 
      planId?: string;
      supplierPlanId?: string;
    }
  ): number => {
    if (!agentId) {
      // Fallback to default 300% markup if no agent
      return wholesalePrice * 4;
    }

    return calculatePriceWithRules({
      wholesalePrice,
      agentId,
      countryCode: options?.countryCode,
      planId: options?.planId,
      supplierPlanId: options?.supplierPlanId
    });
  }, [agentId, calculatePriceWithRules]);

  // Legacy compatibility - return markup object for backward compatibility
  const markup: AgentMarkup | null = {
    markup_type: 'percent',
    markup_value: 300 // This is now just for compatibility
  };

  useEffect(() => {
    fetchAgentProfile();

    // Listen for auth changes
    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      fetchAgentProfile();
    });

    return () => {
      authSub?.subscription?.unsubscribe?.();
    };
  }, [fetchAgentProfile]);

  return {
    markup,
    loading: loading || rulesLoading,
    calculatePrice,
    refetch: fetchAgentProfile,
    isConnected: true // Always connected since we use the new system
  };
};