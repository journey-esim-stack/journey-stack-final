import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAlgoliaAnalytics } from '@/hooks/useAlgoliaAnalytics';

export const AlgoliaPerformanceMonitor = () => {
  const { analytics, isLoading } = useAlgoliaAnalytics();
  const [connectionStatus, setConnectionStatus] = useState<'good' | 'slow' | 'error'>('good');

  useEffect(() => {
    // Determine connection status based on response time and error rate
    if (analytics.errorRate > 5) {
      setConnectionStatus('error');
    } else if (analytics.averageResponseTime > 500) {
      setConnectionStatus('slow');
    } else {
      setConnectionStatus('good');
    }
  }, [analytics]);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'slow':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'good':
        return 'Optimal';
      case 'slow':
        return 'Slow';
      case 'error':
        return 'Issues';
    }
  };

  if (isLoading) return null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Search Performance
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          {getStatusIcon()}
          Status: {getStatusText()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Response Time</div>
            <div className="font-medium">{analytics.averageResponseTime}ms</div>
          </div>
          <div>
            <div className="text-muted-foreground">Error Rate</div>
            <div className="font-medium">{analytics.errorRate}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total Searches</div>
            <div className="font-medium">{analytics.totalSearches}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Popular Queries</div>
            <div className="font-medium">{analytics.popularQueries.length}</div>
          </div>
        </div>

        {analytics.popularQueries.length > 0 && (
          <div>
            <div className="text-sm text-muted-foreground mb-2">Top Searches</div>
            <div className="space-y-1">
              {analytics.popularQueries.slice(0, 3).map((query, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{query.query}</span>
                  <Badge variant="secondary" className="ml-2">
                    {query.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};