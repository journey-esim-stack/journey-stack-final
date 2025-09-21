import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
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
  const [allPlans, setAllPlans] = useState<EsimPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentMarkup, setAgentMarkup] = useState({ type: 'percent', value: 300 });
  
  // Filter states
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [validityFilter, setValidityFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("price-asc");
  
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
          hitsPerPage: 200, // Get more results for filtering
          filters: 'is_active:true AND admin_only:false'
        }]
      });
      
      const hits = searchResponse.results[0]?.hits || [];
      setAllPlans(hits as EsimPlan[]);
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

  // Apply filters and sorting
  const applyFiltersAndSorting = useCallback(() => {
    let filtered = [...allPlans];
    
    // Apply filters
    if (selectedCountry) {
      filtered = filtered.filter(plan => plan.country_name === selectedCountry);
    }
    
    if (selectedSupplier) {
      filtered = filtered.filter(plan => plan.supplier_name === selectedSupplier);
    }
    
    if (validityFilter) {
      const days = parseInt(validityFilter);
      if (days === 1) {
        filtered = filtered.filter(plan => plan.validity_days <= 1);
      } else if (days === 7) {
        filtered = filtered.filter(plan => plan.validity_days > 1 && plan.validity_days <= 7);
      } else if (days === 30) {
        filtered = filtered.filter(plan => plan.validity_days > 7 && plan.validity_days <= 30);
      } else if (days === 90) {
        filtered = filtered.filter(plan => plan.validity_days > 30);
      }
    }
    
    // Apply price filter (calculate agent price for filtering)
    filtered = filtered.filter(plan => {
      const basePrice = Number(plan.wholesale_price) || 0;
      let agentPrice = basePrice;
      if (agentMarkup.type === 'percent') {
        agentPrice = basePrice * (1 + agentMarkup.value / 100);
      } else {
        agentPrice = basePrice + agentMarkup.value;
      }
      return agentPrice >= priceRange[0] && agentPrice <= priceRange[1];
    });
    
    // Apply sorting
    filtered.sort((a, b) => {
      const aBasePrice = Number(a.wholesale_price) || 0;
      const bBasePrice = Number(b.wholesale_price) || 0;
      
      let aAgentPrice = aBasePrice;
      let bAgentPrice = bBasePrice;
      
      if (agentMarkup.type === 'percent') {
        aAgentPrice = aBasePrice * (1 + agentMarkup.value / 100);
        bAgentPrice = bBasePrice * (1 + agentMarkup.value / 100);
      } else {
        aAgentPrice = aBasePrice + agentMarkup.value;
        bAgentPrice = bBasePrice + agentMarkup.value;
      }
      
      switch (sortBy) {
        case 'price-asc':
          return aAgentPrice - bAgentPrice;
        case 'price-desc':
          return bAgentPrice - aAgentPrice;
        case 'data-desc':
          return extractDataValue(b.data_amount) - extractDataValue(a.data_amount);
        case 'data-asc':
          return extractDataValue(a.data_amount) - extractDataValue(b.data_amount);
        case 'validity-asc':
          return a.validity_days - b.validity_days;
        case 'validity-desc':
          return b.validity_days - a.validity_days;
        case 'country':
          return a.country_name.localeCompare(b.country_name);
        default:
          return 0;
      }
    });
    
    setPlans(filtered);
  }, [allPlans, selectedCountry, selectedSupplier, validityFilter, priceRange, sortBy, agentMarkup]);
  
  const extractDataValue = (dataStr: string): number => {
    const match = dataStr.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
    if (!match) return 0;
    
    const [, value, unit] = match;
    const numValue = parseFloat(value);
    
    switch (unit.toUpperCase()) {
      case 'TB': return numValue * 1000000;
      case 'GB': return numValue * 1000;
      case 'MB': return numValue;
      default: return numValue;
    }
  };

  useEffect(() => {
    // Load initial plans
    searchPlans();
  }, [searchPlans]);
  
  useEffect(() => {
    // Apply filters when they change
    applyFiltersAndSorting();
  }, [applyFiltersAndSorting]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchPlans(searchQuery);
  };
  
  // Get unique values for filters
  const uniqueCountries = [...new Set(allPlans.map(plan => plan.country_name))].sort();
  const uniqueSuppliers = [...new Set(allPlans.map(plan => plan.supplier_name))].sort();
  
  const clearFilters = () => {
    setSelectedCountry("");
    setSelectedSupplier("");
    setPriceRange([0, 1000]);
    setValidityFilter("");
    setSortBy("price-asc");
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

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Search</CardTitle>
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
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Filters</CardTitle>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Country</label>
                  <Select value={selectedCountry || "all"} onValueChange={(value) => setSelectedCountry(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All countries</SelectItem>
                      {uniqueCountries.map(country => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Supplier</label>
                  <Select value={selectedSupplier || "all"} onValueChange={(value) => setSelectedSupplier(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All suppliers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All suppliers</SelectItem>
                      {uniqueSuppliers.map(supplier => (
                        <SelectItem key={supplier} value={supplier}>
                          {supplier === 'esim_access' ? 'eSIM Access' : supplier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Duration</label>
                  <Select value={validityFilter || "all"} onValueChange={(value) => setValidityFilter(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any duration</SelectItem>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="7">2-7 days</SelectItem>
                      <SelectItem value="30">8-30 days</SelectItem>
                      <SelectItem value="90">30+ days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Price Range: ${priceRange[0]} - ${priceRange[1]}
                  </label>
                  <Slider
                    value={priceRange}
                    onValueChange={(value) => setPriceRange(value as [number, number])}
                    max={1000}
                    min={0}
                    step={10}
                    className="mt-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Sort by</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price-asc">Price: Low to High</SelectItem>
                      <SelectItem value="price-desc">Price: High to Low</SelectItem>
                      <SelectItem value="data-desc">Data: High to Low</SelectItem>
                      <SelectItem value="data-asc">Data: Low to High</SelectItem>
                      <SelectItem value="validity-asc">Duration: Short to Long</SelectItem>
                      <SelectItem value="validity-desc">Duration: Long to Short</SelectItem>
                      <SelectItem value="country">Country A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-3 space-y-6">

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
                {plans.length} of {allPlans.length} plans found
              </p>
              <Button variant="outline" size="sm" onClick={() => searchPlans(searchQuery)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
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
                    {searchQuery ? `No plans found for "${searchQuery}". Try a different search term.` : 'No plans match the current filters. Try adjusting your search criteria.'}
                  </p>
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}