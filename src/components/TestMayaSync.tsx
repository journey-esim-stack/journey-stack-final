import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function TestMayaSync() {
  const [loading, setLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [validatorLoading, setValidatorLoading] = useState(false);

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

  const runHealthCheck = async () => {
    setHealthLoading(true);
    try {
      console.log('Starting Maya health check...');
      const { data, error } = await supabase.functions.invoke('maya-health');
      
      if (error) {
        console.error('Maya health check error:', error);
        throw error;
      }

      console.log('Maya health check response:', data);
      toast({
        title: data.healthy ? "Maya API Healthy" : "Maya API Issues Detected",
        description: `Completed ${data.checks?.length || 0} checks. ${data.healthy ? 'All systems operational.' : 'Check logs for details.'}`,
        variant: data.healthy ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error('Error running Maya health check:', error);
      const message = error?.message || error?.error || 'Failed to run health check';
      toast({
        title: "Error",
        description: String(message).slice(0, 300),
        variant: "destructive",
      });
    } finally {
      setHealthLoading(false);
    }
  };

  const validatePlans = async () => {
    setValidatorLoading(true);
    try {
      console.log('Starting Maya plan validation...');
      const { data, error } = await supabase.functions.invoke('maya-plan-validator', {
        body: { plan_ids: [] } // Empty array means validate all active plans
      });
      
      if (error) {
        console.error('Maya plan validation error:', error);
        throw error;
      }

      console.log('Maya plan validation response:', data);
      const summary = data.summary;
      toast({
        title: "Plan Validation Complete",
        description: `Validated ${summary.total_validated} plans. ${summary.invalid_plans} deactivated, ${summary.updated_plans} updated.`,
      });
    } catch (error: any) {
      console.error('Error validating Maya plans:', error);
      const message = error?.message || error?.error || 'Failed to validate plans';
      toast({
        title: "Error",
        description: String(message).slice(0, 300),
        variant: "destructive",
      });
    } finally {
      setValidatorLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold mb-4">Maya API Management & Stability</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Button 
          onClick={runHealthCheck} 
          disabled={healthLoading}
          variant="outline"
          className="w-full"
        >
          {healthLoading ? 'Checking Health...' : 'Health Check'}
        </Button>
        
        <Button 
          onClick={validatePlans} 
          disabled={validatorLoading}
          variant="outline"
          className="w-full"
        >
          {validatorLoading ? 'Validating Plans...' : 'Validate Plans'}
        </Button>
        
        <Button 
          onClick={syncMayaPlans} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Syncing...' : 'Sync Plans'}
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground mt-2">
        <p><strong>Health Check:</strong> Verifies Maya API connectivity and authentication</p>
        <p><strong>Validate Plans:</strong> Checks for invalid/outdated plans and fixes pricing</p>
        <p><strong>Sync Plans:</strong> Fetches latest plans from Maya API</p>
      </div>
    </div>
  );
}