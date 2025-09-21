import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface ESimStatusUpdate {
  id: string;
  esim_iccid: string;
  status: string;
  real_status: string;
  updated_at: string;
}

export const useRealtimeESimStatus = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Subscribe to real-time updates on orders table
    const ordersChannel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Real-time order update:', payload);
          setLastSync(new Date());
          
          // Show toast notification for status changes
          if (payload.new.real_status !== payload.old.real_status) {
            const realStatus = JSON.parse(payload.new.real_status || '{}');
            toast({
              title: "eSIM Status Updated",
              description: `ICCID ${payload.new.esim_iccid} is now ${realStatus.display_status || 'Unknown'}`,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('Orders subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Subscribe to real-time updates on esim_status_events table
    const eventsChannel = supabase
      .channel('esim-events-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'esim_status_events'
        },
        (payload) => {
          console.log('Real-time status event:', payload);
          setLastSync(new Date());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [toast]);

  // Function to trigger manual sync
  const triggerSync = async () => {
    try {
      console.log('Triggering Maya sync...');
      const { data, error } = await supabase.functions.invoke('realtime-maya-sync');
      
      if (error) {
        console.error('Sync error:', error);
        toast({
          title: "Sync Failed",
          description: "Failed to sync Maya eSIM statuses",
          variant: "destructive",
        });
      } else {
        console.log('Sync completed:', data);
        setLastSync(new Date());
        toast({
          title: "Sync Completed",
          description: `Synced ${data.synced_count || 0} eSIM statuses`,
        });
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast({
        title: "Sync Error",
        description: "An error occurred during sync",
        variant: "destructive",
      });
    }
  };

  // Auto-sync every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      triggerSync();
    }, 30000); // 30 seconds

    // Initial sync
    triggerSync();

    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    lastSync,
    triggerSync
  };
};