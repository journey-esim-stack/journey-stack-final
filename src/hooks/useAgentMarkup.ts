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
  const [isConnected, setIsConnected] = useState(true);

  const calculatePrice = (wholesalePrice: number, markupData?: AgentMarkup) => {
    const currentMarkup = markupData || markup;
    
    // Default to 300% markup if no markup is set
    if (!currentMarkup) {
      return wholesalePrice * 4; // 300% markup = 4x price (100% + 300% = 400% = 4x)
    }

    const type = currentMarkup.markup_type?.toLowerCase();
    if (type === 'percent') {
      // For percent type: add the markup percentage to 100%
      return wholesalePrice * (1 + currentMarkup.markup_value / 100);
    } else if (type === 'fixed' || type === 'flat') {
      // For flat type: add the fixed amount
      return wholesalePrice + currentMarkup.markup_value;
    }
    
    // Fallback to default 300% markup
    return wholesalePrice * 4;
  };

  const fetchMarkup = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('agent_profiles')
        .select('markup_type, markup_value')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found - this is normal for new users
          console.log('No agent profile found - using default markup');
          setMarkup({ markup_type: 'percent', markup_value: 300 });
        } else {
          throw error;
        }
      } else {
        // Profile exists, use its values or defaults if null
        const markupData = {
          markup_type: profile.markup_type || 'percent',
          markup_value: profile.markup_value ?? 300
        };
        setMarkup(markupData);
      }
    } catch (error) {
      console.error('Error fetching markup:', error);
      toast.error('Failed to fetch pricing information');
      // Set default markup even on error to ensure app functionality
      setMarkup({ markup_type: 'percent', markup_value: 300 });
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
          try {
            // Check if this update is for the current user
            const { data: { user } } = await supabase.auth.getUser();
            if (user && payload.new.user_id === user.id) {
              const newMarkup = {
                markup_type: payload.new.markup_type,
                markup_value: payload.new.markup_value,
              };
              setMarkup(newMarkup);
              setIsConnected(true);
              toast.success('Pricing updated automatically');
            }
          } catch (error) {
            console.error('Error handling markup update:', error);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          toast.error('Real-time connection lost. Prices may not update automatically.');
        }
      });

    // Heartbeat to maintain connection
    const heartbeat = setInterval(() => {
      if (channel.state === 'joined') {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
    };
  }, []);

  return { 
    markup, 
    loading, 
    calculatePrice, 
    refetch: fetchMarkup,
    isConnected 
  };
};