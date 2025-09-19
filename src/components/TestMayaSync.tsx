import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function TestMayaSync() {
  const [loading, setLoading] = useState(false);

  const syncMayaPlans = async () => {
    setLoading(true);
    try {
      console.log('Starting Maya sync...');
      const { data, error } = await supabase.functions.invoke('sync-maya-plans');
      
      if (error) {
        console.error('Maya sync error:', error);
        throw error;
      }

      console.log('Maya sync response:', data);
      toast({
        title: "Success",
        description: `Maya plans synced: ${data?.synced_count || 0} plans`,
      });
    } catch (error: any) {
      console.error('Error syncing Maya plans:', error);
      const message = error?.message || error?.error || 'Failed to sync Maya plans';
      toast({
        title: "Error",
        description: String(message).slice(0, 300),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Test Maya Regional Plans Sync</h3>
      <Button 
        onClick={syncMayaPlans} 
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Syncing Maya Plans...' : 'Sync Maya Regional Plans'}
      </Button>
    </div>
  );
}