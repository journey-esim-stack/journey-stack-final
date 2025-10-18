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
  const requestCountRef = useRef(0);
  const circuitBreakerRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Circuit breaker to prevent infinite loops
  const resetCircuitBreaker = useCallback(() => {
    requestCountRef.current = 0;
    circuitBreakerRef.current = false;
    console.log('🔧 Circuit breaker reset');
  }, []);

  const debouncedFetchMarkup = useCallback(async (force = false) => {
    // Circuit breaker check
    if (circuitBreakerRef.current && !force) {
      console.log('🚫 Circuit breaker active - skipping fetch');
      return;
    }

    // Rate limiting
    requestCountRef.current++;
    if (requestCountRef.current > 10) {
      circuitBreakerRef.current = true;
      console.error('🚨 Too many requests - activating circuit breaker');
      setTimeout(resetCircuitBreaker, 10000); // Reset after 10 seconds
      return;
    }

    // Clear existing debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce the actual fetch
    return new Promise((resolve) => {
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('🔍 fetchMarkup called - request count:', requestCountRef.current);
          
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            setLoading(false);
            resolve(undefined);
            return;
          }

          // Prevent duplicate fetches for same user
          if (lastFetchUserIdRef.current === user.id && markup !== null && !force) {
            setLoading(false);
            resolve(undefined);
            return;
          }

          setLoading(true);
          lastFetchUserIdRef.current = user.id;

          const { data: profile, error } = await supabase
            .from('agent_profiles')
            .select('markup_type, markup_value')
            .eq('user_id', user.id)
            .maybeSingle();

          if (error) {
            throw error;
          }

          if (!profile) {
            console.log('No agent profile found - using default markup');
            setMarkup({ markup_type: 'percent', markup_value: 300 });
          } else {
            const markupData = {
              markup_type: profile.markup_type || 'percent',
              markup_value: profile.markup_value ?? 300
            };
            console.log('Fetched markup from database:', markupData);
            setMarkup(markupData);
          }
          setHasInitialized(true);
          
          // Reset request count on successful fetch
          requestCountRef.current = Math.max(0, requestCountRef.current - 1);
          
        } catch (error) {
          console.error('Error fetching markup:', error);
          
          // Handle resource exhaustion specifically
          if (error?.message?.includes('ERR_INSUFFICIENT_RESOURCES')) {
            circuitBreakerRef.current = true;
            console.error('🚨 Resource exhaustion detected - activating circuit breaker');
            setTimeout(resetCircuitBreaker, 30000); // Longer reset for resource issues
          }
          
          // Only show toast on first error, not on retries
          if (!hasInitialized) {
            toast.error('Failed to fetch pricing information');
          }
          setMarkup({ markup_type: 'percent', markup_value: 300 });
          setHasInitialized(true);
        } finally {
          setLoading(false);
          resolve(undefined);
        }
      }, 500); // 500ms debounce
    });
  }, [resetCircuitBreaker]);

  const fetchMarkup = useCallback(() => debouncedFetchMarkup(), [debouncedFetchMarkup]);

  useEffect(() => {
    let mounted = true;

    const initializeMarkup = async () => {
      if (!mounted || circuitBreakerRef.current) return;
      
      console.log('🚀 Initializing markup hook');
      await debouncedFetchMarkup(true); // Force initial fetch
      
      // Setup realtime immediately after fetch, don't wait for hasInitialized
      if (mounted) {
        setupRealtimeChannel();
      }
    };

    initializeMarkup();

    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || circuitBreakerRef.current) return;
      
      console.log('🔄 Auth state change:', event);
      
      if (session?.user && event !== 'INITIAL_SESSION') {
        // Reset state for new user
        lastFetchUserIdRef.current = null;
        setHasInitialized(false);
        resetCircuitBreaker(); // Reset circuit breaker for new user
        await debouncedFetchMarkup(true);
        setupRealtimeChannel();
      } else if (!session?.user) {
        setMarkup(null);
        setHasInitialized(false);
        setIsConnected(true);
        lastFetchUserIdRef.current = null;
        resetCircuitBreaker();
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      }
    });

    return () => {
      mounted = false;
      console.log('🧹 Cleaning up markup hook');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      authSub?.subscription?.unsubscribe?.();
    };
  }, []); // No dependencies to prevent loops

  return { 
    markup, 
    loading, 
    calculatePrice, 
    refetch: fetchMarkup,
    isConnected 
  };
};