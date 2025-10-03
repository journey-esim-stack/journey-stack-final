import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Security hook that ensures wholesale_price and supplier_name are never exposed to non-admin users
 * Even if a developer tries to query these fields, they'll be filtered out for agents
 */
export const useSecurePlanData = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      setIsAdmin(roles?.some(r => r.role === 'admin') || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filters sensitive fields from plan data for non-admin users
   * CRITICAL SECURITY: This ensures wholesale_price and supplier_name are never exposed
   */
  const filterPlanData = <T extends Record<string, any>>(data: T | T[] | null): T | T[] | null => {
    if (!data) return data;
    if (isAdmin) return data; // Admins can see everything

    const removeSensitiveFields = (item: T): T => {
      const filtered = { ...item };
      delete (filtered as any).wholesale_price;
      delete (filtered as any).supplier_name;
      delete (filtered as any).supplier_plan_id;
      return filtered;
    };

    if (Array.isArray(data)) {
      return data.map(removeSensitiveFields) as T[];
    }

    return removeSensitiveFields(data);
  };

  return {
    isAdmin,
    loading,
    filterPlanData,
  };
};
