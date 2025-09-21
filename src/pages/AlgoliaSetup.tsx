import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function AlgoliaSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<any>(null);
  const { toast } = useToast();

  const runAlgoliaSetup = async () => {
    setIsLoading(true);
    setSetupResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('setup-algolia-sync');

      if (error) {
        console.error('Setup error:', error);
        toast({
          title: "Setup Failed",
          description: error.message || "Failed to setup Algolia integration",
          variant: "destructive",
        });
        setSetupResult({ success: false, error: error.message });
      } else {
        console.log('Setup success:', data);
        toast({
          title: "Setup Complete!",
          description: `Successfully synced ${data.recordCount} records to Algolia`,
        });
        setSetupResult(data);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Setup Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      setSetupResult({ success: false, error: 'Unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Algolia Integration Setup
          </CardTitle>
          <CardDescription>
            Initialize your Algolia search index with eSIM plans data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">What this will do:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Create and configure your Algolia search index</li>
              <li>• Sync all active eSIM plans with agent pricing</li>
              <li>• Set up search attributes and faceting</li>
              <li>• Enable instant search capabilities</li>
            </ul>
          </div>

          <Button 
            onClick={runAlgoliaSetup} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up Algolia...
              </>
            ) : (
              'Run Algolia Setup'
            )}
          </Button>

          {setupResult && (
            <Card className={setupResult.success ? "border-green-200" : "border-red-200"}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  {setupResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div className="space-y-2">
                    <p className="font-medium">
                      {setupResult.success ? 'Setup Successful!' : 'Setup Failed'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {setupResult.message || setupResult.error}
                    </p>
                    {setupResult.success && (
                      <div className="text-sm space-y-1">
                        <p>Index Name: <code className="bg-muted px-1 rounded">{setupResult.indexName}</code></p>
                        <p>Records Synced: <span className="font-medium">{setupResult.recordCount}</span></p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-muted-foreground">
            <p><strong>Note:</strong> You need admin privileges to run this setup.</p>
            <p>Make sure your Algolia credentials are configured in the Supabase secrets.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}