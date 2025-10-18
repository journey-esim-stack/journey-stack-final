import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlanIdMapping {
  [planId: string]: string; // maps plan.id -> canonical supplier_plan_id
}

/**
 * Hook to fetch canonical supplier_plan_id mappings from Supabase
 * This is needed because Algolia may have different IDs than the pricing_rules table
 */
export const usePlanIdMapping = (planIds: string[]) => {
  const [mapping, setMapping] = useState<PlanIdMapping>({});
  const [loading, setLoading] = useState(false);

  const fetchMappings = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('esim_plans')
        .select('id, supplier_plan_id')
        .in('id', ids);

      if (error) throw error;

      const newMapping: PlanIdMapping = {};
      data?.forEach(plan => {
        newMapping[plan.id] = plan.supplier_plan_id;
      });

      setMapping(prev => ({ ...prev, ...newMapping }));
    } catch (error) {
      console.error('Error fetching plan ID mappings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Filter out IDs we already have
    const missingIds = planIds.filter(id => !(id in mapping));
    if (missingIds.length > 0) {
      fetchMappings(missingIds);
    }
  }, [planIds, mapping, fetchMappings]);

  const getCanonicalId = useCallback((planId: string): string | undefined => {
    return mapping[planId];
  }, [mapping]);

  return { mapping, loading, getCanonicalId };
};
