import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, MapPin, Calendar, Database, TrendingUp, Filter, SortAsc, SortDesc, Zap, RefreshCw } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { usePriceCalculator } from '@/hooks/usePriceCalculator';
import { getSearchClient, ESIM_PLANS_INDEX } from '@/lib/algolia';
import { getCountryFlag } from '@/utils/countryFlags';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Skeleton } from "@/components/ui/skeleton";
import { InstantSearch, SearchBox, RefinementList, Stats, Configure, useHits, useStats, useSearchBox, useRefinementList, Pagination, usePagination, useInstantSearch } from 'react-instantsearch';
import { AlgoliaErrorBoundary } from '@/components/AlgoliaErrorBoundary';
import { AgentPreviewSelector } from '@/components/AgentPreviewSelector';

interface EsimPlan {
  objectID: string;
  id: string;
  title: string;
  description?: string;
  country_name: string;
  country_code: string;
  data_amount: string;
  validity_days: number;
  currency: string;
  is_active: boolean;
  wholesale_price: number;
  supplier_plan_id: string;
}

// Enhanced Search Box with analytics tracking
const EnhancedSearchBox = () => {
  const { query, refine } = useSearchBox();
  const { indexUiState } = useInstantSearch();
  
  const handleSearchChange = useCallback((value: string) => {
    refine(value);
    
    // Track search analytics
    if (value.length > 2) {
      console.log('Search analytics:', { query: value, timestamp: Date.now() });
    }
  }, [refine]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        placeholder="Search countries, data plans, or destinations..."
        value={query}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="pl-10 pr-4 py-2 h-12 text-base"
      />
      {query && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-1/2 transform -translate-y-1/2"
          onClick={() => handleSearchChange('')}
        >
          ×
        </Button>
      )}
    </div>
  );
};

// Enhanced Stats with performance metrics
const EnhancedStats = () => {
  const { nbHits, processingTimeMS } = useStats();
  
  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-1">
        <Database className="h-4 w-4" />
        <span>{nbHits.toLocaleString()} plans</span>
      </div>
      <div className="flex items-center gap-1">
        <Zap className="h-4 w-4" />
        <span>{processingTimeMS}ms</span>
      </div>
    </div>
  );
};

// Enhanced Refinement List with improved UI
const EnhancedRefinementList = ({ attribute, title, icon }: { attribute: string; title: string; icon?: React.ReactNode }) => {
  const { items, refine } = useRefinementList({ attribute, limit: 10, showMore: true });

  if (!items.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.slice(0, 8).map((item) => (
          <label key={item.value} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={item.isRefined}
              onChange={() => refine(item.value)}
              className="rounded border-gray-300"
            />
            <span className="text-sm flex-1">{item.value}</span>
            <Badge variant="secondary" className="text-xs">
              {item.count}
            </Badge>
          </label>
        ))}
      </CardContent>
    </Card>
  );
};

// Enhanced Plan Card with better UX
const PlanCard = ({ plan, calculatePrice }: { plan: EsimPlan, calculatePrice: (price: number, options?: { supplierPlanId?: string; countryCode?: string; }) => number }) => {
  const { addToCart } = useCart();
  const { convertPrice, selectedCurrency, getCurrencySymbol } = useCurrency();
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      const priceUSD = calculatePrice?.(plan.wholesale_price || 0, { supplierPlanId: plan.supplier_plan_id, countryCode: plan.country_code }) ?? 0;
      await addToCart({
        id: `${plan.id}-${Date.now()}`,
        planId: plan.id,
        title: plan.title,
        countryName: plan.country_name,
        countryCode: plan.country_code,
        dataAmount: plan.data_amount,
        validityDays: plan.validity_days,
        agentPrice: priceUSD,
        currency: plan.currency,
        
      });
      
      toast({
        title: "Added to cart",
        description: `${plan.title} has been added to your cart.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add plan to cart. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const isDayPass = plan.data_amount?.toLowerCase().includes('day');
  const countryFlag = getCountryFlag(plan.country_code);

  return (
    <Card className="h-full flex flex-col transition-all duration-200 hover:shadow-lg border-border/50 hover:border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{countryFlag}</span>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                {plan.country_name}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {plan.data_amount}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {plan.currency}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{plan.data_amount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{plan.validity_days} days</span>
            </div>
          </div>

          {plan.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {plan.description}
            </p>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary">
              {(() => {
                const priceUSD = calculatePrice?.(plan.wholesale_price || 0, { supplierPlanId: plan.supplier_plan_id, countryCode: plan.country_code }) ?? 0;
                return getCurrencySymbol() + convertPrice(priceUSD).toFixed(2);
              })()}
            </span>
            {isDayPass && (
              <Badge variant="outline" className="text-xs">
                Day Pass
              </Badge>
            )}
          </div>

          <Button
            onClick={handleAddToCart}
            disabled={isAdding}
            className="w-full"
            size="sm"
          >
            {isAdding ? "Adding..." : "Add to Cart"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Enhanced Search Results with performance optimizations
const SearchResults = ({ calculatePrice }: { calculatePrice: (price: number) => number }) => {
  const { hits } = useHits<EsimPlan>();

  const enhancedHits = useMemo(() => {
    return hits.map(hit => ({
      ...hit,
      wholesale_price: (hit as any).wholesale_price ?? 0
    }));
  }, [hits]);

  if (!enhancedHits.length) {
    return (
      <div className="text-center py-12">
        <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No plans found</h3>
        <p className="text-muted-foreground">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {enhancedHits.map((plan) => (
        <PlanCard key={plan.objectID} plan={plan as any} calculatePrice={calculatePrice} />
      ))}
    </div>
  );
};

// Enhanced Pagination
const EnhancedPagination = () => {
  const { currentRefinement, refine, nbPages, pages } = usePagination();

  if (nbPages <= 1) return null;

  return (
    <div className="flex justify-center mt-8">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refine(currentRefinement - 1)}
          disabled={currentRefinement === 0}
        >
          Previous
        </Button>
        
        {pages.map((page) => (
          <Button
            key={page}
            variant={currentRefinement === page ? "default" : "outline"}
            size="sm"
            onClick={() => refine(page)}
          >
            {page + 1}
          </Button>
        ))}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => refine(currentRefinement + 1)}
          disabled={currentRefinement >= nbPages - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

// Loading skeleton
const LoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="h-64">
          <CardHeader>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-16 w-full mb-4" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export default function AlgoliaPlansOptimized() {
  const [searchClient, setSearchClient] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { calculatePrice, refreshPricing } = usePriceCalculator();

  // Initialize Algolia client
  useEffect(() => {
    const initializeAlgolia = async () => {
      try {
        setIsLoading(true);
        const client = await getSearchClient();
        setSearchClient(client);
        setError(null);
      } catch (err: any) {
        console.error('Failed to initialize Algolia:', err);
        setError(err.message);
        toast({
          title: "Search Setup Error",
          description: "Failed to initialize search. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeAlgolia();
  }, [toast]);

  // Real-time sync monitoring
  useEffect(() => {
    const channel = supabase
      .channel('esim_plans_optimized')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'esim_plans',
      }, () => {
        toast({
          title: "Plans Updated",
          description: "Search results refreshed with latest data.",
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Loading eSIM Plans...</h1>
          <p className="text-muted-foreground">Setting up advanced search</p>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !searchClient) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">Search Error</CardTitle>
            <CardDescription>
              Unable to load search functionality. Please try refreshing the page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="w-full">
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AlgoliaErrorBoundary>
      <InstantSearch searchClient={searchClient} indexName={ESIM_PLANS_INDEX}>
        <Configure hitsPerPage={20} maxValuesPerFacet={100} />
        
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Premium eSIM Plans</h1>
            <p className="text-muted-foreground">Advanced search powered by Algolia</p>
          </div>

          {/* Admin Preview Selector */}
          <div className="max-w-2xl mx-auto">
            <AgentPreviewSelector />
          </div>

          {/* Search */}
          <div className="max-w-2xl mx-auto">
            <EnhancedSearchBox />
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filters Sidebar */}
            <div className="lg:w-64 space-y-4">
              <EnhancedRefinementList
                attribute="country_name"
                title="Countries"
                icon={<MapPin className="h-4 w-4" />}
              />
              <EnhancedRefinementList
                attribute="validity_days"
                title="Duration"
                icon={<Calendar className="h-4 w-4" />}
              />
            </div>

            {/* Main Content */}
            <div className="flex-1 space-y-4">
              {/* Stats and Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <EnhancedStats />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshPricing}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Pricing
                </Button>
              </div>

{/* Results */}
              <SearchResults calculatePrice={calculatePrice} />

              {/* Pagination */}
              <EnhancedPagination />
            </div>
          </div>
        </div>
      </InstantSearch>
    </AlgoliaErrorBoundary>
  );
}