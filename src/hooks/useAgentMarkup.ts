import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const setupRealtimeChannel = useCallback(async () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log('Setting up real-time channel, attempt:', connectionAttempts + 1);
    
    const channel = supabase
      .channel(`agent_markup_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_profiles',
        },
        async (payload) => {
          try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser && payload.new.user_id === currentUser.id) {
              const newMarkup = {
                markup_type: payload.new.markup_type || 'percent',
                markup_value: payload.new.markup_value ?? 300,
              };
              setMarkup(newMarkup);
              setIsConnected(true);
              setConnectionAttempts(0);
              console.log('Markup updated in real-time:', newMarkup);
              toast.success(`Pricing updated: ${newMarkup.markup_value}${newMarkup.markup_type === 'percent' ? '%' : ' USD'} markup`);
            }
          } catch (error) {
            console.error('Error handling markup update:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionAttempts(0);
          console.log('✅ Real-time connection established');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsConnected(false);
          console.warn('❌ Real-time connection failed:', status);
          
          // Implement exponential backoff for reconnection
          if (connectionAttempts < 5) {
            const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
            console.log(`🔄 Reconnecting in ${delay}ms...`);
            
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            reconnectTimeoutRef.current = setTimeout(() => {
              setConnectionAttempts(prev => prev + 1);
              setupRealtimeChannel();
            }, delay);
          } else {
            console.log('⚠️ Max reconnection attempts reached. Real-time updates disabled.');
          }
        }
      });

    channelRef.current = channel;
  }, [connectionAttempts]);

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
          console.log('No agent profile found - using default markup');
          setMarkup({ markup_type: 'percent', markup_value: 300 });
        } else {
          throw error;
        }
      } else {
        const markupData = {
          markup_type: profile.markup_type || 'percent',
          markup_value: profile.markup_value ?? 300
        };
        console.log('Fetched markup from database:', markupData);
        setMarkup(markupData);
      }
    } catch (error) {
      console.error('Error fetching markup:', error);
      toast.error('Failed to fetch pricing information');
      setMarkup({ markup_type: 'percent', markup_value: 300 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkup();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchMarkup();
        setupRealtimeChannel();
      } else {
        setMarkup(null);
        setIsConnected(true);
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      }
    });

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      authSub?.subscription?.unsubscribe?.();
    };
  }, [setupRealtimeChannel]);

  return { 
    markup, 
    loading, 
    calculatePrice, 
    refetch: fetchMarkup,
    isConnected 
  };
};