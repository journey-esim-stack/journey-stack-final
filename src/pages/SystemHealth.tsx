import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SystemHealth() {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: healthData, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('system-health-check');
      
      if (error) {
        console.error('Health check error:', error);
        throw error;
      }
      return data;
    },
    refetchInterval: 60000, // Auto-refresh every minute
    retry: 1,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast({
      title: "Health check refreshed",
      description: "System status has been updated",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'not_configured':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    if (!status) return <Badge variant="outline">UNKNOWN</Badge>;
    
    const variants: any = {
      'healthy': 'default',
      'error': 'destructive',
      'not_configured': 'secondary',
      'deployed': 'default',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  if (queryError) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-red-500" />
              Error Loading Health Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {queryError instanceof Error ? queryError.message : 'Failed to load system health data'}
            </p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of critical system components
          </p>
        </div>
        <div className="flex items-center gap-3">
          {healthData?.timestamp && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Last checked: {new Date(healthData.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Algolia Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(healthData?.algolia?.status)}
                Search System (Algolia)
              </CardTitle>
              <CardDescription>{healthData?.algolia?.message}</CardDescription>
            </div>
            {getStatusBadge(healthData?.algolia?.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Response Time</p>
              <p className="text-2xl font-bold">{healthData?.algolia?.responseTime}ms</p>
            </div>
            {healthData?.algolia?.metrics?.validUntil && (
              <div>
                <p className="text-sm font-medium">Credentials Valid Until</p>
                <p className="text-sm">{new Date(healthData.algolia.metrics.validUntil * 1000).toLocaleString()}</p>
              </div>
            )}
          </div>
          
          {healthData?.algolia?.details && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
              <p className="text-sm font-medium text-destructive">Error Details:</p>
              <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(healthData.algolia.details, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing System Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(healthData?.pricing?.status)}
                Pricing System
              </CardTitle>
              <CardDescription>{healthData?.pricing?.message}</CardDescription>
            </div>
            {getStatusBadge(healthData?.pricing?.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium">Custom Prices</p>
              <p className="text-2xl font-bold">{healthData?.pricing?.metrics?.customPriceCount || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Active Rules</p>
              <p className="text-2xl font-bold">{healthData?.pricing?.metrics?.activeRulesCount || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium">API Response</p>
              <p className="text-2xl font-bold">{healthData?.pricing?.responseTime}ms</p>
            </div>
          </div>
          {healthData?.pricing?.metrics?.functionTest && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">get-agent-plan-prices Function</span>
                {getStatusBadge(healthData.pricing.metrics.functionTest.status)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {healthData.pricing.metrics.functionTest.message}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* eSIM Status Sync Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(healthData?.esimSync?.status)}
                eSIM Status Sync
              </CardTitle>
              <CardDescription>{healthData?.esimSync?.message}</CardDescription>
            </div>
            {getStatusBadge(healthData?.esimSync?.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Active eSIMs</p>
              <p className="text-2xl font-bold">{healthData?.esimSync?.metrics?.activeESimCount || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Last Webhook</p>
              <p className="text-sm">
                {healthData?.esimSync?.metrics?.lastWebhookAt 
                  ? new Date(healthData.esimSync.metrics.lastWebhookAt).toLocaleString()
                  : 'No recent activity'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {healthData?.esimSync?.metrics?.esimAccessApi && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">eSIM Access API</span>
                  {getStatusBadge(healthData.esimSync.metrics.esimAccessApi.status)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {healthData.esimSync.metrics.esimAccessApi.message}
                </p>
              </div>
            )}

            {healthData?.esimSync?.metrics?.mayaApi && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Maya API</span>
                  {getStatusBadge(healthData.esimSync.metrics.mayaApi.status)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {healthData.esimSync.metrics.mayaApi.message}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Database Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(healthData?.database?.status)}
                Database
              </CardTitle>
              <CardDescription>{healthData?.database?.message}</CardDescription>
            </div>
            {getStatusBadge(healthData?.database?.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {healthData?.database?.metrics?.tables?.map((table: any) => (
              <div key={table.table} className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(table.status)}
                  <span className="text-sm font-medium">{table.table}</span>
                </div>
                <span className="text-sm text-muted-foreground">{table.count} records</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edge Functions Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(healthData?.edgeFunctions?.status)}
                Edge Functions
              </CardTitle>
              <CardDescription>{healthData?.edgeFunctions?.message}</CardDescription>
            </div>
            {getStatusBadge(healthData?.edgeFunctions?.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {healthData?.edgeFunctions?.metrics?.functions?.map((fn: any) => (
              <div key={fn.function} className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-sm font-medium">{fn.function}</span>
                {getStatusBadge(fn.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
