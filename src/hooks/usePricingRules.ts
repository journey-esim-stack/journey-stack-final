import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PricingRule {
  id: string;
  rule_type: string; // 'agent', 'country', 'plan', 'default'
  target_id: string | null; // agent_id, country_code, plan_id
  markup_type: string; // 'percent' or 'fixed'
  markup_value: number;
  min_order_amount: number;
  max_order_amount: number | null;
  is_active: boolean;
  priority: number;
}

interface CalculatePriceParams {
  wholesalePrice: number;
  agentId?: string;
  countryCode?: string;
  planId?: string;
}

export const usePricingRules = () => {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  // Fetch pricing rules from database
  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true }); // Lower priority number = higher priority

      if (error) {
        throw error;
      }

      setRules(data || []);
      console.log('✅ Fetched pricing rules:', data?.length || 0);
      
    } catch (error) {
      console.error('❌ Error fetching pricing rules:', error);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate price based on rules hierarchy
  const calculatePrice = useCallback((params: CalculatePriceParams): number => {
    const { wholesalePrice, agentId, countryCode, planId } = params;

    // Find the best matching rule in priority order
    const applicableRules = rules.filter(rule => {
      // Check if rule applies to this context
      switch (rule.rule_type) {
        case 'plan':
          return rule.target_id === planId;
        case 'agent':
          return rule.target_id === agentId;
        case 'country':
          return rule.target_id === countryCode;
        case 'default':
          return true; // Default rule applies to everything
        default:
          return false;
      }
    });

    // Get the highest priority rule (lowest priority number)
    const selectedRule = applicableRules[0];

    if (!selectedRule) {
      // Fallback to 300% markup if no rules found
      console.log('⚠️ No pricing rules found, using default 300% markup');
      return wholesalePrice * 4; // 300% markup = 4x price
    }

    console.log('💰 Applying pricing rule:', {
      rule_type: selectedRule.rule_type,
      target_id: selectedRule.target_id,
      markup_type: selectedRule.markup_type,
      markup_value: selectedRule.markup_value
    });

    // Apply the markup based on type
    if (selectedRule.markup_type === 'percent') {
      return wholesalePrice * (1 + selectedRule.markup_value / 100);
    } else if (selectedRule.markup_type === 'fixed') {
      return wholesalePrice + selectedRule.markup_value;
    }

    // Fallback
    return wholesalePrice * 4;
  }, [rules]);

  // Setup real-time updates for pricing rules
  useEffect(() => {
    fetchRules();

    // Listen for real-time updates to pricing rules
    const channel = supabase
      .channel('pricing_rules_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pricing_rules',
        },
        (payload) => {
          console.log('🔄 Pricing rules updated in real-time:', payload);
          fetchRules(); // Refetch all rules when any change occurs
        }
      )
      .subscribe((status) => {
        console.log('📡 Pricing rules real-time status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRules]);

  return {
    rules,
    loading,
    isConnected,
    calculatePrice,
    refetch: fetchRules
  };
};