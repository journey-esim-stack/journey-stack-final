import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SearchAnalytics {
  totalSearches: number;
  popularQueries: Array<{ query: string; count: number }>;
  averageResponseTime: number;
  errorRate: number;
}

export const useAlgoliaAnalytics = () => {
  const [analytics, setAnalytics] = useState<SearchAnalytics>({
    totalSearches: 0,
    popularQueries: [],
    averageResponseTime: 0,
    errorRate: 0,
  });

  const [isLoading, setIsLoading] = useState(false);

  const trackSearch = async (query: string, responseTime: number, hasError = false) => {
    try {
      // Store search analytics in local storage for now
      // In production, you'd send this to your analytics service
      const searchData = {
        query,
        responseTime,
        hasError,
        timestamp: Date.now(),
        userId: (await supabase.auth.getUser()).data.user?.id,
      };

      const existingData = JSON.parse(localStorage.getItem('algolia_analytics') || '[]');
      existingData.push(searchData);
      
      // Keep only last 1000 searches
      const recentData = existingData.slice(-1000);
      localStorage.setItem('algolia_analytics', JSON.stringify(recentData));
      
      updateAnalytics(recentData);
    } catch (error) {
      console.error('Failed to track search analytics:', error);
    }
  };

  const updateAnalytics = (searchData: any[]) => {
    const totalSearches = searchData.length;
    const errorCount = searchData.filter(s => s.hasError).length;
    const errorRate = totalSearches > 0 ? (errorCount / totalSearches) * 100 : 0;
    
    const averageResponseTime = totalSearches > 0 
      ? searchData.reduce((sum, s) => sum + s.responseTime, 0) / totalSearches 
      : 0;

    // Count popular queries
    const queryCount: Record<string, number> = {};
    searchData.forEach(s => {
      if (s.query && s.query.length > 2) {
        queryCount[s.query] = (queryCount[s.query] || 0) + 1;
      }
    });

    const popularQueries = Object.entries(queryCount)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setAnalytics({
      totalSearches,
      popularQueries,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
    });
  };

  const loadAnalytics = () => {
    setIsLoading(true);
    try {
      const data = JSON.parse(localStorage.getItem('algolia_analytics') || '[]');
      updateAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  return {
    analytics,
    isLoading,
    trackSearch,
    refreshAnalytics: loadAnalytics,
  };
};
