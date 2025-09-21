import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Globe, Clock, Database, Wifi, ShoppingCart, Check, Search as SearchIcon, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { getCountryFlag } from "@/utils/countryFlags";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getSearchClient } from "@/lib/algolia";

interface EsimPlan {
  objectID: string;
  id: string;
  title: string;
  description: string;
  country_name: string;
  country_code: string;
  data_amount: string;
  validity_days: number;
  wholesale_price: number;
  currency: string;
  is_active: boolean;
  supplier_name: string;
  admin_only: boolean;
  agent_price?: number;
}

function PlanCard({ plan, agentMarkup }: { plan: EsimPlan; agentMarkup: { type: string; value: number } }) {
  const [addedToCart, setAddedToCart] = useState(false);
  const [dayPassDays, setDayPassDays] = useState(Math.max(plan.validity_days || 1, 1));
  const { toast } = useToast();
  const { addToCart } = useCart();
  const { convertPrice, getCurrencySymbol } = useCurrency();

  // Calculate agent price
  const basePrice = Number(plan.wholesale_price) || 0;
  let agentPrice = basePrice;
  if (agentMarkup.type === 'percent') {
    agentPrice = basePrice * (1 + agentMarkup.value / 100);
  } else {
    agentPrice = basePrice + agentMarkup.value;
  }

  // Detect Day Pass plans
  const isDayPass = (plan: EsimPlan) => {
    const t = (plan.title || '').toLowerCase();
    const d = (plan.description || '').toLowerCase();
    return /\/\s*day\b/.test(t) || t.includes('daily') || /\/\s*day\b/.test(d) || d.includes('daily');
  };

  const handleAddToCart = () => {
    const days = isDayPass(plan) ? dayPassDays : plan.validity_days;
    const price = isDayPass(plan) ? agentPrice * dayPassDays : agentPrice;

    const cartItem = {
      id: plan.id,
      planId: plan.id,
      title: plan.title,
      countryName: plan.country_name,
      countryCode: plan.country_code,
      dataAmount: plan.data_amount,
      validityDays: days,
      agentPrice: price,
      currency: plan.currency,
      supplier_name: plan.supplier_name,
    };

    addToCart(cartItem);
    setAddedToCart(true);
    
    toast({
      title: "Added to cart",
      description: `${plan.title} has been added to your cart.`,
    });

    setTimeout(() => setAddedToCart(false), 2000);
  };

  const flag = getCountryFlag(plan.country_code);
  const isDayPassPlan = isDayPass(plan);
  const displayPrice = isDayPassPlan ? agentPrice * dayPassDays : agentPrice;
  const convertedPrice = convertPrice(displayPrice || 0);

  return (
    <Card className="h-full hover:shadow-lg transition-all duration-200 border border-border/50 hover:border-border group">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {plan.title}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-2 text-muted-foreground">
              <span className="text-lg">{flag}</span>
              <span className="font-medium">{plan.country_name}</span>
              <Badge variant="outline" className="text-xs">
                {plan.supplier_name === 'esim_access' ? 'eSIM Access' : 'Maya'}
              </Badge>
            </CardDescription>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-primary">
              {getCurrencySymbol()}{convertedPrice.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              Total Price
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <Database className="h-5 w-5 mx-auto text-primary" />
            <div className="text-sm font-medium text-foreground">{plan.data_amount}</div>
            <div className="text-xs text-muted-foreground">Data</div>
          </div>
          <div className="space-y-1">
            <Clock className="h-5 w-5 mx-auto text-primary" />
            <div className="text-sm font-medium text-foreground">
              {isDayPassPlan ? (
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    value={dayPassDays}
                    onChange={(e) => setDayPassDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 h-6 text-xs text-center border rounded"
                  />
                  <span className="text-xs">days</span>
                </div>
              ) : (
                `${plan.validity_days} days`
              )}
            </div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </div>
          <div className="space-y-1">
            <Wifi className="h-5 w-5 mx-auto text-primary" />
            <div className="text-sm font-medium text-foreground">4G/5G</div>
            <div className="text-xs text-muted-foreground">Network</div>
          </div>
        </div>

        <Button 
          onClick={handleAddToCart}
          disabled={addedToCart}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-lg transition-all duration-200"
        >
          {addedToCart ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Added!
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add to Cart
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AlgoliaPlansSimple() {
  const [searchQuery, setSearchQuery] = useState("");
  const [plans, setPlans] = useState<EsimPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentMarkup, setAgentMarkup] = useState({ type: 'percent', value: 300 });
  const { toast } = useToast();

  const searchPlans = useCallback(async (query: string = "") => {
    setIsLoading(true);
    setError(null);
    
    try {
      const client = await getSearchClient();
      
      const searchResponse = await client.search({
        requests: [{
          indexName: 'esim_plans',
          query: query,
          hitsPerPage: 50,
          filters: 'is_active:true AND admin_only:false'
        }]
      });
      
      const hits = searchResponse.results[0]?.hits || [];
      setPlans(hits as EsimPlan[]);
      
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
      toast({
        title: "Search Error",
        description: "Failed to search plans. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Load initial plans
    searchPlans();
  }, [searchPlans]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchPlans(searchQuery);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">eSIM Plans Search</h1>
              <p className="text-muted-foreground mt-2">
                Search and browse available eSIM plans
              </p>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              <SearchIcon className="h-4 w-4 mr-1" />
              Direct Search
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="text"
                placeholder="Search plans, countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SearchIcon className="h-4 w-4" />
                )}
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={() => searchPlans(searchQuery)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            {plans.length} plans found
          </p>
          <Button variant="outline" size="sm" onClick={() => searchPlans(searchQuery)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-80 animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                    <div className="h-8 bg-muted rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : plans.length > 0 ? (
            plans.map((plan) => (
              <PlanCard key={plan.objectID} plan={plan} agentMarkup={agentMarkup} />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Plans Found</h3>
              <p className="text-muted-foreground max-w-md">
                {searchQuery ? `No plans found for "${searchQuery}". Try a different search term.` : 'No plans available at the moment.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}