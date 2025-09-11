import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AgentMarkup {
  markup_type: string;
  markup_value: number;
}

export const useAgentMarkup = () => {
  const [markup, setMarkup] = useState<AgentMarkup | null>(null);
  const [loading, setLoading] = useState(true);

  const calculatePrice = (wholesalePrice: number, markupData?: AgentMarkup) => {
    const currentMarkup = markupData || markup;
    if (!currentMarkup) return wholesalePrice;

    const type = currentMarkup.markup_type?.toLowerCase();
    if (type === 'percent') {
      return wholesalePrice * (1 + currentMarkup.markup_value / 100);
    } else if (type === 'fixed' || type === 'flat') {
      return wholesalePrice + currentMarkup.markup_value;
    }
    return wholesalePrice;
  };

  const fetchMarkup = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('agent_profiles')
        .select('markup_type, markup_value')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setMarkup(profile);
    } catch (error) {
      console.error('Error fetching markup:', error);
      toast.error('Failed to fetch pricing information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkup();

    // Subscribe to real-time updates for agent markup changes
    const channel = supabase
      .channel('agent_markup_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_profiles',
        },
        async (payload) => {
          // Check if this update is for the current user
          const { data: { user } } = await supabase.auth.getUser();
          if (user && payload.new.user_id === user.id) {
            setMarkup({
              markup_type: payload.new.markup_type,
              markup_value: payload.new.markup_value,
            });
            toast.success('Pricing updated automatically');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { markup, loading, calculatePrice, refetch: fetchMarkup };
};