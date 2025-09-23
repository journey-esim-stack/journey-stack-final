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
  const [hasInitialized, setHasInitialized] = useState(false);
  
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchUserIdRef = useRef<string | null>(null);

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

    console.log('Setting up real-time channel');
    
    const channel = supabase
      .channel(`agent_markup_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_profiles',
          filter: `user_id=eq.${user.id}`,
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
          console.log('⚠️ Real-time connection failed:', status);
          
          // Only attempt reconnection if we haven't exceeded max attempts
          setConnectionAttempts(prev => {
            if (prev < 3) { // Reduced from 5 to 3 attempts
              const delay = Math.min(5000 * Math.pow(2, prev), 60000); // Increased base delay to 5s
              console.log(`🔄 Will retry connection in ${delay}ms (attempt ${prev + 1}/3)`);
              
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
              }
              
              reconnectTimeoutRef.current = setTimeout(() => {
                setupRealtimeChannel();
              }, delay);
              
              return prev + 1;
            } else {
              console.log('⚠️ Max reconnection attempts reached. Real-time updates disabled until page refresh.');
              return prev;
            }
          });
        }
      });

    channelRef.current = channel;
  }, []); // Removed connectionAttempts from dependencies to prevent infinite loop

  const fetchMarkup = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Prevent duplicate fetches for same user
      if (lastFetchUserIdRef.current === user.id && markup !== null) {
        setLoading(false);
        return;
      }

      setLoading(true);
      lastFetchUserIdRef.current = user.id;

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
      setHasInitialized(true);
    } catch (error) {
      console.error('Error fetching markup:', error);
      // Only show toast on first error, not on retries
      if (!hasInitialized) {
        toast.error('Failed to fetch pricing information');
      }
      setMarkup({ markup_type: 'percent', markup_value: 300 });
      setHasInitialized(true);
    } finally {
      setLoading(false);
    }
  }, [markup, hasInitialized]);

  useEffect(() => {
    let mounted = true;

    const initializeMarkup = async () => {
      if (!mounted) return;
      await fetchMarkup();
      
      // Only setup realtime after initial fetch
      if (mounted && hasInitialized) {
        setupRealtimeChannel();
      }
    };

    initializeMarkup();

    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (session?.user && event !== 'INITIAL_SESSION') {
        // Reset state for new user
        lastFetchUserIdRef.current = null;
        setHasInitialized(false);
        await fetchMarkup();
        setupRealtimeChannel();
      } else if (!session?.user) {
        setMarkup(null);
        setHasInitialized(false);
        setIsConnected(true);
        lastFetchUserIdRef.current = null;
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      }
    });

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      authSub?.subscription?.unsubscribe?.();
    };
  }, []); // Remove all dependencies to prevent loops

  return { 
    markup, 
    loading, 
    calculatePrice, 
    refetch: fetchMarkup,
    isConnected 
  };
};