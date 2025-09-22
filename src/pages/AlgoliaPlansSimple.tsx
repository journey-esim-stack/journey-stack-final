import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { getSearchClient, ESIM_PLANS_INDEX } from "@/lib/algolia";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAgentMarkup } from "@/hooks/useAgentMarkup";
import { useCart } from "@/contexts/CartContext";
import { Globe, Clock, Database, Wifi, ShoppingCart, Check, Search as SearchIcon, AlertCircle, RefreshCw, Loader2, Plus, Search, Filter, MapPin, Zap } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { resolveCountryName, getCountryVariations } from "@/utils/countryMapping";
import Layout from "@/components/Layout";
import RegionalPlanDropdown from "@/components/RegionalPlanDropdown";
import { getCountryFlag } from "@/utils/countryFlags";
import { useCurrency } from "@/contexts/CurrencyContext";
import { detectRegionalPlan, getAllRegionTypes, planMatchesRegion, getRegionDisplayName, type RegionType } from "@/utils/regionalMapping";

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
              {plan.country_code === 'RG' && (
                <RegionalPlanDropdown 
                  planTitle={plan.title} 
                  countryCode={plan.country_code}
                  supplierName={plan.supplier_name}
                  countryName={plan.country_name}
                />
              )}
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
  const [selectedRegionType, setSelectedRegionType] = useState<string>(""); // New filter for multi-country
  const [regionTypeFilter, setRegionTypeFilter] = useState<RegionType | "">("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [validityFilter, setValidityFilter] = useState<string>("");
  const [dataFilter, setDataFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("price-asc");
  
  const { toast } = useToast();
  const { addToCart } = useCart();
  const { selectedCurrency, convertPrice } = useCurrency();
  const { searchHistory, addToHistory } = useSearchHistory();

  // In preview environments, Algolia adds a query param that causes 400s.
  // Force direct Supabase search to guarantee a working page.
  const FORCE_FALLBACK = typeof window !== 'undefined' && window.location.hostname.includes('lovable.app');

  // Synonyms mapping for client-side assistance (Algolia expects boolean `synonyms` param; custom lists are index-level only)
  const synonymsMap: Record<string, string[]> = {
    uae: ["dubai", "united arab emirates"],
    dubai: ["uae", "united arab emirates"],
    uk: ["united kingdom", "britain", "england"],
    usa: ["united states", "america", "us"],
    america: ["united states", "usa", "us"],
    singapore: ["singpore"],
    singpore: ["singapore"],
  };

  const buildOptionalWords = (q: string) => {
    const tokens = q.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const set = new Set<string>();
    tokens.forEach((t) => synonymsMap[t]?.forEach((s) => set.add(s)));
    return Array.from(set);
  };

  const searchPlans = useCallback(async (query: string = "") => {
    console.log('searchPlans called with query:', query);
    setIsLoading(true);
    setError(null);
    
    try {
      if (FORCE_FALLBACK) {
        const pageSize = 1000;
        let from = 0; let to = pageSize - 1; let supaHits: any[] = [];
        while (true) {
          const { data, error } = await supabase
            .from('esim_plans')
            .select('*')
            .eq('is_active', true)
            .eq('admin_only', false)
            .range(from, to);
          if (error) throw error;
          if (!data || data.length === 0) break;
          supaHits.push(...data);
          if (data.length < pageSize) break;
          from += pageSize; to += pageSize;
        }
        setAllPlans(supaHits as unknown as EsimPlan[]);
        setPlans(supaHits as unknown as EsimPlan[]);
        return;
      }

      const client = await getSearchClient();

      const optionalWords = buildOptionalWords(query);

      // Build URLSearchParams string because Algolia /queries expects params as a URL-encoded string
      const baseParams = new URLSearchParams();
      baseParams.set('query', query);
      baseParams.set('hitsPerPage', '1000');
      baseParams.set('page', '0');
      baseParams.set('filters', 'is_active:true AND admin_only:false');
      baseParams.set('typoTolerance', 'true');
      baseParams.set('ignorePlurals', 'true');
      baseParams.set('removeStopWords', 'true');
      baseParams.set('queryLanguages', 'en');
      if (optionalWords.length) baseParams.set('optionalWords', optionalWords.join(','));

      const initial = await (client as any).search({
        requests: [
          {
            indexName: 'esim_plans',
            params: baseParams.toString(),
          },
        ],
      });
      
      const first = (initial as any)?.results?.[0] || {};
      const allHits: any[] = Array.isArray(first.hits) ? [...first.hits] : [];
      const nbPages = first.nbPages ?? 1;
      let page = 1;
      while (page < nbPages && allHits.length < 5000) {
        const pageParams = new URLSearchParams(baseParams);
        pageParams.set('page', String(page));
        const nextResp = await (client as any).search({
          requests: [
            {
              indexName: 'esim_plans',
              params: pageParams.toString(),
            },
          ],
        });
        const next = (nextResp as any)?.results?.[0] || {};
        if (Array.isArray(next.hits)) allHits.push(...next.hits);
        page++;
      }
      // If Algolia pagination limit (paginationLimitedTo) truncated results, fall back to Supabase for full list
      const nbHits = (first as any)?.nbHits ?? allHits.length;
      if (nbHits > allHits.length) {
        try {
          const pageSize = 1000;
          let from = 0; let to = pageSize - 1; let supaHits: any[] = [];
          while (true) {
            const { data, error } = await supabase
              .from('esim_plans')
              .select('*')
              .eq('is_active', true)
              .eq('admin_only', false)
              .range(from, to);
            if (error) throw error;
            if (!data || data.length === 0) break;
            supaHits.push(...data);
            if (data.length < pageSize) break;
            from += pageSize; to += pageSize;
          }
          setAllPlans(supaHits as unknown as EsimPlan[]);
          setPlans(supaHits as unknown as EsimPlan[]);
          return;
        } catch {}
      }

      setAllPlans(allHits as EsimPlan[]);
      setPlans(allHits as EsimPlan[]);
    } catch (err: any) {
      console.error('Search error:', err);

      // Fallback to Supabase query if Algolia fails
      try {
        const pageSize = 1000;
        let from = 0; let to = pageSize - 1; let supaHits: any[] = [];
        while (true) {
          const { data, error } = await supabase
            .from('esim_plans')
            .select('*')
            .eq('is_active', true)
            .eq('admin_only', false)
            .range(from, to);
          if (error) throw error;
          if (!data || data.length === 0) break;
          supaHits.push(...data);
          if (data.length < pageSize) break;
          from += pageSize; to += pageSize;
        }

        setAllPlans(supaHits as unknown as EsimPlan[]);
        setPlans(supaHits as unknown as EsimPlan[]);
        toast({ title: 'Algolia unavailable, using fallback', description: `Loaded ${supaHits.length} plans from Supabase.` });
      } catch (fallbackErr: any) {
        setError(err.message || 'Search failed');
        toast({
          title: 'Search Error',
          description: 'Failed to load plans from Algolia and fallback. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Apply filters and sorting
  const applyFiltersAndSorting = useCallback(() => {
    let filtered = [...allPlans];
    
    // Apply text search first with enhanced country matching
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(plan => {
        // Basic text matching
        const basicMatch = plan.title?.toLowerCase().includes(query) ||
          plan.country_name?.toLowerCase().includes(query) ||
          plan.description?.toLowerCase().includes(query);
        
        if (basicMatch) return true;
        
        // Enhanced country matching using variations
        if (plan.country_name) {
          const countryVariations = getCountryVariations(plan.country_name);
          return countryVariations.some(variation => 
            variation.toLowerCase().includes(query) ||
            query.includes(variation.toLowerCase())
          );
        }
        
        return false;
      });
    }
    
    // Apply filters
    if (selectedCountry) {
      filtered = filtered.filter(plan => plan.country_name === selectedCountry);
    }
    
    // Apply regional type filter (new system)
    if (regionTypeFilter) {
      filtered = filtered.filter(plan => planMatchesRegion(plan, regionTypeFilter));
    }
    
    // Apply legacy region filter (keep for compatibility)
    if (selectedRegionType) {
      const regionMap = {
        "europe": ["europe"],
        "apac": ["apac"],
        "latam": ["latam"],
        "mena": ["mena"],
        "balkans": ["balkans"],
        "caribbean": ["caribbean"],
        "caucasus": ["caucasus"],
        "regional": ["regional"]
      };
      
      const keywords = regionMap[selectedRegionType as keyof typeof regionMap] || [];
      filtered = filtered.filter(plan => 
        keywords.some(keyword => 
          plan.country_name?.toLowerCase().includes(keyword)
        )
      );
    }
    
    if (dataFilter) {
      const dataValue = parseFloat(dataFilter);
      filtered = filtered.filter(plan => {
        const planDataValue = extractDataValue(plan.data_amount);
        if (dataFilter === "1") return planDataValue <= 1000; // ≤1GB
        if (dataFilter === "5") return planDataValue > 1000 && planDataValue <= 5000; // 1-5GB
        if (dataFilter === "10") return planDataValue > 5000 && planDataValue <= 10000; // 5-10GB
        if (dataFilter === "unlimited") return plan.data_amount.toLowerCase().includes('unlimited');
        return planDataValue > 10000; // >10GB
      });
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
  }, [allPlans, selectedCountry, selectedRegionType, validityFilter, dataFilter, priceRange, sortBy, agentMarkup, searchQuery]);
  
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
    console.log('Initial plans loading effect triggered');
    searchPlans();
  }, [searchPlans]);
  
  useEffect(() => {
    // Apply filters when they change
    applyFiltersAndSorting();
  }, [applyFiltersAndSorting]);

  // Real-time search as user types - only search if we need fresh data
  useEffect(() => {
    if (searchQuery.trim() && allPlans.length === 0) {
      const timeoutId = setTimeout(() => {
        searchPlans(searchQuery);
      }, 150); // Faster debounce for better performance
      
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, searchPlans, allPlans.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchPlans(searchQuery);
  };

  const handleCountryPillClick = (country: string) => {
    if (country === "All Countries") {
      setSelectedCountry("");
      setSelectedRegionType("");
      setSearchQuery("");
    } else {
      // Clear other filters when selecting a specific country
      setSelectedRegionType("");
      const resolvedCountry = resolveCountryName(country);
      setSelectedCountry(resolvedCountry);
      setSearchQuery(country);
      addToHistory(country); // Add to search history
    }
  };

  const handleSearchSubmit = (query: string) => {
    console.log('Search submitted:', query);
    if (query.trim()) {
      addToHistory(query);
      setSearchQuery(query);
      searchPlans(query);
    }
  };
  
  // Get unique values for filters
  const uniqueCountries = [...new Set(allPlans.map(plan => plan.country_name))].sort();
  
  const clearFilters = () => {
    setSelectedCountry("");
    setSelectedRegionType("");
    setRegionTypeFilter("");
    setPriceRange([0, 1000]);
    setValidityFilter("");
    setDataFilter("");
    setSortBy("price-asc");
  };

  // Function to detect multi-country/regional plans
  const isMultiCountryPlan = (plan: EsimPlan) => {
    const title = plan.title?.toLowerCase() || '';
    const description = plan.description?.toLowerCase() || '';
    const countryName = plan.country_name?.toLowerCase() || '';
    
    const multiCountryKeywords = [
      'europe', 'asia', 'africa', 'americas', 'global', 'worldwide', 'international',
      'regional', 'multi', 'multiple', 'roaming', 'travel', 'countries', 'region'
    ];
    
    return multiCountryKeywords.some(keyword => 
      title.includes(keyword) || description.includes(keyword) || countryName.includes(keyword)
    );
  };

  // Get available regions from the data
  const getAvailableRegions = () => {
    const regions = [
      { value: "europe", label: "🇪🇺 Europe", keywords: ["europe"] },
      { value: "apac", label: "🌏 Asia Pacific (APAC)", keywords: ["apac"] },
      { value: "latam", label: "🌎 Latin America", keywords: ["latam"] },
      { value: "mena", label: "🌍 Middle East & North Africa", keywords: ["mena"] },
      { value: "balkans", label: "🏔️ Balkans", keywords: ["balkans"] },
      { value: "caribbean", label: "🏝️ Caribbean", keywords: ["caribbean"] },
      { value: "caucasus", label: "⛰️ Caucasus", keywords: ["caucasus"] },
      { value: "regional", label: "🌐 Regional", keywords: ["regional"] }
    ];

    return regions.filter(region => 
      allPlans.some(plan => 
        region.keywords.some(keyword => 
          plan.country_name?.toLowerCase().includes(keyword)
        )
      )
    );
  };

  const popularCountries = [
    { name: "All Countries", flag: "🌍" },
    { name: "UAE", flag: "🇦🇪", alt: "Dubai" },
    { name: "Singapore", flag: "🇸🇬" },
    { name: "United Kingdom", flag: "🇬🇧", display: "UK" },
    { name: "United States", flag: "🇺🇸", display: "USA" },
    { name: "Italy", flag: "🇮🇹" },
    { name: "Thailand", flag: "🇹🇭" },
    { name: "Indonesia", flag: "🇮🇩" },
    { name: "Spain", flag: "🇪🇸" },
  ];

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

        {/* Enhanced Search Section */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                 <SearchAutocomplete 
                   value={searchQuery}
                   onChange={setSearchQuery}
                   onSearch={handleSearchSubmit}
                   placeholder="Search plans, countries... (e.g., UAE, Dubai, Singapore, UK)"
                 />
                
                {/* Popular Countries Pills */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Popular Countries</h3>
                  <div className="flex flex-wrap gap-2">
                    {popularCountries.map((country) => (
                      <Button
                        key={country.name}
                        variant={selectedCountry === country.name || (country.name === "All Countries" && !selectedCountry && !selectedRegionType && !searchQuery.trim()) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleCountryPillClick(country.name)}
                        className="h-8 px-3 rounded-full"
                      >
                        <span className="mr-1.5">{country.flag}</span>
                        {country.display || country.name}
                        {country.alt && ` (${country.alt})`}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1 space-y-4">

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
                  <Select value={selectedCountry || "all"} onValueChange={(value) => {
                    const newCountry = value === "all" ? "" : value;
                    setSelectedCountry(newCountry);
                    // Clear region filter when selecting a country
                    if (newCountry) setSelectedRegionType("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All countries</SelectItem>
                      {uniqueCountries.filter(country => !isMultiCountryPlan({country_name: country} as EsimPlan)).map(country => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Region Type</label>
                  <Select value={regionTypeFilter || "all"} onValueChange={(value) => {
                    const newRegion = value === "all" ? "" : value;
                    setRegionTypeFilter(newRegion as RegionType | "");
                    // Clear country filter when selecting a region
                    if (newRegion) setSelectedCountry("");
                  }}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="All regions" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="all">All regions</SelectItem>
                      {getAllRegionTypes().map(region => (
                        <SelectItem key={region} value={region}>{getRegionDisplayName(region)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Data Amount</label>
                  <Select value={dataFilter || "all"} onValueChange={(value) => setDataFilter(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any data amount" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any data amount</SelectItem>
                      <SelectItem value="1">≤ 1GB</SelectItem>
                      <SelectItem value="5">1-5GB</SelectItem>
                      <SelectItem value="10">5-10GB</SelectItem>
                      <SelectItem value="more">10GB+</SelectItem>
                      <SelectItem value="unlimited">Unlimited</SelectItem>
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