import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PricingRule {
  id: string;
  rule_type: string; // 'agent', 'country', 'plan', 'default'
  target_id: string | null; // agent_id, country_code (not used for plan rules anymore)
  plan_id: string | null; // UUID reference to esim_plans.id (for plan rules)
  agent_filter?: string | null; // For agent-specific plan pricing
  markup_type: string; // 'percent', 'fixed', or 'fixed_price'
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
  supplierPlanId?: string;
}

export const usePricingRules = () => {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  // Fetch pricing rules from database with pagination
  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      
      let allRules: PricingRule[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      // Fetch in batches to handle more than 1000 rules
      while (hasMore) {
        const start = page * pageSize;
        const end = start + pageSize - 1;

        const { data, error } = await supabase
          .from('pricing_rules')
          .select('*')
          .eq('is_active', true)
          .order('priority', { ascending: true }) // Lower priority number = higher priority
          .range(start, end);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          allRules = [...allRules, ...data];
          hasMore = data.length === pageSize; // Continue if we got a full page
          page++;
        } else {
          hasMore = false;
        }
      }

      setRules(allRules);
      console.log(`✅ Fetched ${allRules.length} pricing rules across ${page} page(s)`);
      
      // Warn if we're approaching large numbers
      if (allRules.length >= 5000) {
        console.warn('⚠️ Large number of pricing rules loaded. Consider optimizing rule structure.');
      }
      
    } catch (error) {
      console.error('❌ Error fetching pricing rules:', error);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate price based on rules hierarchy
  const calculatePrice = useCallback((params: CalculatePriceParams): number => {
    const { wholesalePrice, agentId, countryCode, planId, supplierPlanId } = params;
    console.log('🔍 PricingRules.calculatePrice', { wholesalePrice, agentId, countryCode, planId, supplierPlanId, rulesCount: rules.length });

    // Sample first 3 rules for debugging
    if (rules.length > 0) {
      console.log('📋 Sample rules:', rules.slice(0, 3).map(r => ({ 
        type: r.rule_type, 
        target: r.target_id, 
        agent_filter: r.agent_filter,
        priority: r.priority 
      })));
    }

    // Find best matching rule using priority + specificity (plan+agent > plan > agent > country > default)
    const matches = rules.filter(rule => {
      const type = rule.rule_type?.toLowerCase();
      const tgt = (rule.target_id ?? '').toString();
      switch (type) {
        case 'plan': {
          // NEW: Use plan_id (UUID) for exact matching
          const planMatches = rule.plan_id && planId && rule.plan_id === planId;
          if (rule.agent_filter) {
            return planMatches && rule.agent_filter.toString().trim().toLowerCase() === (agentId ?? '').toString().trim().toLowerCase();
          }
          return planMatches;
        }
        case 'agent':
          return tgt.trim().toLowerCase() === (agentId ?? '').toString().trim().toLowerCase();
        case 'country':
          return tgt.trim().toUpperCase() === (countryCode ?? '').toString().trim().toUpperCase();
        case 'default':
          return true;
        default:
          return false;
      }
    });

    console.log('✅ Matched rules:', matches.length, matches.map(r => ({ 
      type: r.rule_type, 
      target: r.target_id, 
      agent_filter: r.agent_filter 
    })));

    const specificity = (rule: PricingRule) => {
      const type = rule.rule_type?.toLowerCase();
      const tgt = (rule.target_id ?? '').toString();
      const planMatch = rule.plan_id && planId && rule.plan_id === planId;
      if (type === 'plan' && rule.agent_filter && agentId && rule.agent_filter.toString().trim().toLowerCase() === (agentId ?? '').toString().trim().toLowerCase() && planMatch) return 5;
      if (type === 'plan' && planMatch) return 4;
      if (type === 'agent' && tgt.trim().toLowerCase() === (agentId ?? '').toString().trim().toLowerCase()) return 3;
      if (type === 'country' && tgt.trim().toUpperCase() === (countryCode ?? '').toString().trim().toUpperCase()) return 2;
      return 1; // default
    };

    // Choose rule: lowest priority number wins; if tie, higher specificity wins
    const selectedRule = matches.reduce<PricingRule | undefined>((best, rule) => {
      if (!best) return rule;
      if (rule.priority < best.priority) return rule;
      if (rule.priority === best.priority && specificity(rule) > specificity(best)) return rule;
      return best;
    }, undefined);

    if (!selectedRule) {
      // Fallback to 300% markup if no rules found
      console.log('⚠️ No pricing rules found, using default 300% markup');
      return wholesalePrice * 4; // 300% markup = 4x price
    }

    console.log('💰 Applying pricing rule:', {
      rule_type: selectedRule.rule_type,
      target_id: selectedRule.target_id,
      agent_filter: selectedRule.agent_filter,
      markup_type: selectedRule.markup_type,
      markup_value: selectedRule.markup_value
    });

    // Apply the markup based on type
    if (selectedRule.markup_type === 'fixed_price') {
      // For fixed_price, markup_value IS the final retail price
      return selectedRule.markup_value;
    } else if (selectedRule.markup_type === 'percent') {
      return wholesalePrice * (1 + selectedRule.markup_value / 100);
    } else if (selectedRule.markup_type === 'fixed') {
      return wholesalePrice + selectedRule.markup_value;
    }

    // Fallback
    return wholesalePrice * 4;
  }, [rules]);

  // Debug helper to inspect which rule would apply
  const getAppliedRule = useCallback((params: CalculatePriceParams) => {
    const { wholesalePrice, agentId, countryCode, planId, supplierPlanId } = params;

    const matches = rules.filter(rule => {
      const type = rule.rule_type?.toLowerCase();
      const tgt = (rule.target_id ?? '').toString();
      switch (type) {
        case 'plan': {
          // NEW: Use plan_id (UUID) for exact matching
          const planMatches = rule.plan_id && planId && rule.plan_id === planId;
          if (rule.agent_filter) return planMatches && rule.agent_filter.toString().trim().toLowerCase() === (agentId ?? '').toString().trim().toLowerCase();
          return planMatches;
        }
        case 'agent':
          return tgt.trim().toLowerCase() === (agentId ?? '').toString().trim().toLowerCase();
        case 'country':
          return tgt.trim().toUpperCase() === (countryCode ?? '').toString().trim().toUpperCase();
        case 'default':
          return true;
        default:
          return false;
      }
    });

    const specificity = (rule: PricingRule) => {
      const type = rule.rule_type?.toLowerCase();
      const tgt = (rule.target_id ?? '').toString();
      const planMatch = rule.plan_id && planId && rule.plan_id === planId;
      if (type === 'plan' && rule.agent_filter && agentId && rule.agent_filter.toString().trim().toLowerCase() === (agentId ?? '').toString().trim().toLowerCase() && planMatch) return 5;
      if (type === 'plan' && planMatch) return 4;
      if (type === 'agent' && tgt.trim().toLowerCase() === (agentId ?? '').toString().trim().toLowerCase()) return 3;
      if (type === 'country' && tgt.trim().toUpperCase() === (countryCode ?? '').toString().trim().toUpperCase()) return 2;
      return 1;
    };

    const selectedRule = matches.reduce<PricingRule | undefined>((best, rule) => {
      if (!best) return rule;
      if (rule.priority < best.priority) return rule;
      if (rule.priority === best.priority && specificity(rule) > specificity(best)) return rule;
      return best;
    }, undefined);

    let price = wholesalePrice * 4;
    if (selectedRule) {
      if (selectedRule.markup_type === 'fixed_price') price = selectedRule.markup_value;
      else if (selectedRule.markup_type === 'percent') price = wholesalePrice * (1 + selectedRule.markup_value / 100);
      else if (selectedRule.markup_type === 'fixed') price = wholesalePrice + selectedRule.markup_value;
    }

    return { selectedRule, price };
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
    getAppliedRule,
    refetch: fetchRules
  };
};