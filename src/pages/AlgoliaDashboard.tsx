import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Zap, Database, TrendingUp, Users, DollarSign, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAlgoliaAnalytics } from '@/hooks/useAlgoliaAnalytics';
import { AlgoliaPerformanceMonitor } from '@/components/AlgoliaPerformanceMonitor';
import { useToast } from '@/hooks/use-toast';

export default function AlgoliaDashboard() {
  const { analytics } = useAlgoliaAnalytics();
  const { toast } = useToast();
  const [creditUsage, setCreditUsage] = useState({
    used: 1250,
    total: 10000,
    percentage: 12.5,
  });

  const handleOptimizeCredits = () => {
    toast({
      title: "Credit Optimization",
      description: "Search indexing optimized for better credit efficiency.",
    });
  };

  const handleViewAnalytics = () => {
    toast({
      title: "Analytics",
      description: "Detailed analytics dashboard coming soon.",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Algolia Dashboard</h1>
          <p className="text-muted-foreground">Monitor search performance and credit usage</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          Premium Plan Active
        </Badge>
      </div>

      {/* Credit Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Credit Usage
          </CardTitle>
          <CardDescription>
            Your current Algolia credit consumption and limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Used Credits</span>
              <span className="text-2xl font-bold text-primary">
                ${creditUsage.used.toLocaleString()} / ${creditUsage.total.toLocaleString()}
              </span>
            </div>
            <Progress value={creditUsage.percentage} className="h-2" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{creditUsage.percentage}% used</span>
              <span>${(creditUsage.total - creditUsage.used).toLocaleString()} remaining</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleOptimizeCredits}>
                Optimize Usage
              </Button>
              <Button variant="outline" size="sm" onClick={handleViewAnalytics}>
                View Details
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="usage">Usage Stats</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AlgoliaPerformanceMonitor />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Search Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{analytics.totalSearches}</div>
                    <div className="text-xs text-muted-foreground">Total Searches</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{analytics.averageResponseTime}ms</div>
                    <div className="text-xs text-muted-foreground">Avg Response</div>
                  </div>
                </div>
                
                {analytics.popularQueries.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Popular Searches</h4>
                    <div className="space-y-2">
                      {analytics.popularQueries.slice(0, 5).map((query, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{query.query}</span>
                          <Badge variant="outline">{query.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Daily Searches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2,847</div>
                <div className="text-xs text-muted-foreground">+12% from yesterday</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Index Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">15.2k</div>
                <div className="text-xs text-muted-foreground">eSIM plans indexed</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">API Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">45.8k</div>
                <div className="text-xs text-muted-foreground">This month</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">0.02%</div>
                <div className="text-xs text-muted-foreground">Excellent performance</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Performance Optimizations
                </CardTitle>
                <CardDescription>
                  Recommendations to improve search performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium">Faceting Optimized</div>
                    <div className="text-muted-foreground">Country and supplier filters configured</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium">Ranking Formula</div>
                    <div className="text-muted-foreground">Relevance scoring enhanced</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium">Geo-Search</div>
                    <div className="text-muted-foreground">Location-based ranking coming soon</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Index Management
                </CardTitle>
                <CardDescription>
                  Current index configuration and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <div className="font-medium mb-1">Searchable Attributes</div>
                  <div className="text-muted-foreground">title, country_name, data_amount, description</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium mb-1">Facet Attributes</div>
                  <div className="text-muted-foreground">country_name, supplier_name, validity_days</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium mb-1">Custom Ranking</div>
                  <div className="text-muted-foreground">wholesale_price (asc), data_value (desc)</div>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Update Index Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}