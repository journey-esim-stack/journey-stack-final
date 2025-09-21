import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, CheckCircle, XCircle } from "lucide-react";

export default function AdminPlanSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const { toast } = useToast();

  const runComprehensiveSync = async () => {
    setIsLoading(true);
    setSyncResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-all-plans');
      
      if (error) {
        throw error;
      }

      setSyncResult(data);
      
      if (data.success) {
        toast({
          title: "Sync Completed Successfully",
          description: data.message,
        });
      } else {
        toast({
          title: "Sync Completed with Errors",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Comprehensive Plan Sync
          </CardTitle>
          <CardDescription>
            Sync all available plans from both eSIM Access and Maya suppliers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">This sync will:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Fetch all available plans from eSIM Access API</li>
              <li>Fetch all regional plans from Maya API</li>
              <li>Update existing plans and add new ones</li>
              <li>Deactivate plans no longer available</li>
            </ul>
          </div>

          <Button 
            onClick={runComprehensiveSync} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing Plans...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Start Comprehensive Sync
              </>
            )}
          </Button>

          {syncResult && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                {syncResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  {syncResult.success ? 'Sync Completed' : 'Sync Completed with Errors'}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="bg-muted p-3 rounded">
                  <p><strong>Total Active Plans:</strong> {syncResult.total_active_plans}</p>
                  {syncResult.results && (
                    <>
                      <p><strong>eSIM Access:</strong> {syncResult.results.esim_access.synced} plans synced
                        {syncResult.results.esim_access.error && (
                          <span className="text-red-500 ml-2">Error: {syncResult.results.esim_access.error}</span>
                        )}
                      </p>
                      <p><strong>Maya:</strong> {syncResult.results.maya.synced} plans synced
                        {syncResult.results.maya.error && (
                          <span className="text-red-500 ml-2">Error: {syncResult.results.maya.error}</span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}