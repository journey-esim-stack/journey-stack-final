import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
// Fixed imports - using Router instead of HotspotIcon
import { Search, Globe, Clock, Database, Wifi, Router, ShoppingCart, Check, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import { getCountryFlag, getRegion, getAllRegions } from "@/utils/countryFlags";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import RegionalPlanDropdown from "@/components/RegionalPlanDropdown";
import { SkeletonCard } from "@/components/ui/skeleton-card";


interface EsimPlan {
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
  agent_price?: number; // Calculated agent price based on markup
}

// Plans page component - updated to fix import issue
export default function Plans() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set());
  const [dayPassDays, setDayPassDays] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<string>("default");
  const [currentPage, setCurrentPage] = useState(1);
  const plansPerPage = 24;
  
  const { toast } = useToast();
  const { addToCart } = useCart();
  const { convertPrice, getCurrencySymbol, selectedCurrency } = useCurrency();
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
  }, []);
  
  // Debounce search query for better performance
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // Popular countries for quick filtering
  const popularCountries = [
    { name: "UAE (Dubai)", code: "AE", flag: "🇦🇪" },
    { name: "Singapore", code: "SG", flag: "🇸🇬" },
    { name: "UK", code: "GB", flag: "🇬🇧" },
    { name: "USA", code: "US", flag: "🇺🇸" },
    { name: "Italy", code: "IT", flag: "🇮🇹" },
    { name: "Thailand", code: "TH", flag: "🇹🇭" },
    { name: "Indonesia", code: "ID", flag: "🇮🇩" },
    { name: "Spain", code: "ES", flag: "🇪🇸" },
  ];

  // Get unique regions from plans
   const regions = getAllRegions();
   
   // Detect Day Pass (Unlimited FUP) plans based on title/description
   const isDayPass = (p: EsimPlan) => {
     const t = (p.title || '').toLowerCase();
     const d = (p.description || '').toLowerCase();
     return /\/\s*day\b/.test(t) || t.includes('daily') || /\/\s*day\b/.test(d) || d.includes('daily');
   };

  // Fetch plans with React Query for better caching and performance
  const fetchPlans = async (): Promise<EsimPlan[]> => {
    // Check authentication first
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Fetch agent markup settings, country activation, and region activation in parallel
    const [agentProfileResponse, countryActivationResponse, regionActivationResponse] = await Promise.all([
      supabase
        .from("agent_profiles")
        .select("markup_type, markup_value")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "country_activation")
        .single(),
      supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "region_activation")
        .single()
    ]);

    const agentProfile = agentProfileResponse.data;
    const countryActivation = countryActivationResponse.data ? 
      JSON.parse(countryActivationResponse.data.setting_value) : {};
    const regionActivation = regionActivationResponse.data ? 
      JSON.parse(regionActivationResponse.data.setting_value) : {};

    // Fetch all plans in batches to overcome 1000 row limit
    let allPlans: EsimPlan[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("esim_plans")
        .select("*")
        .eq("is_active", true)
        .eq("admin_only", false) // Exclude admin-only plans
        .range(from, from + batchSize - 1)
        .order("country_name", { ascending: true });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allPlans = [...allPlans, ...data];
        
        if (data.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      } else {
        hasMore = false;
      }
    }

    // Filter plans based on supplier activation settings
    let filteredPlans = allPlans.filter(plan => {
      // Always show eSIM Access plans
      if (plan.supplier_name === 'esim_access') {
        return true;
      }
      
      // For Maya plans, check both country and region activation
      if (plan.supplier_name === 'maya') {
        // Check country-level activation
        const countrySuppliers = countryActivation[plan.country_code];
        if (countrySuppliers && countrySuppliers.includes('maya')) {
          return true;
        }
        
        // Check region-level activation for regional plans
        if (plan.country_code === 'RG') {
          // Map plan regions to our region codes
          const planTitle = plan.title?.toLowerCase() || '';
          const planDescription = plan.description?.toLowerCase() || '';
          
          const regionMappings = {
            'europe': ['europe', 'european'],
            'apac': ['asia', 'pacific', 'apac'],
            'latam': ['latin', 'america', 'latam'],
            'caribbean': ['caribbean'],
            'mena': ['middle east', 'north africa', 'mena'],
            'balkans': ['balkans'],
            'caucasus': ['caucasus']
          };
          
          for (const [regionCode, keywords] of Object.entries(regionMappings)) {
            if (regionActivation[regionCode] && 
                keywords.some(keyword => planTitle.includes(keyword) || planDescription.includes(keyword))) {
              return true;
            }
          }
        }
        
        return false;
      }
      
      // For other suppliers, show all plans (fallback)
      return true;
    });
    
    // Calculate agent prices for each plan using the fetched markup
    const currentMarkup = agentProfile ? {
      type: agentProfile.markup_type || 'percent',
      value: agentProfile.markup_value !== null && agentProfile.markup_value !== undefined 
        ? Number(agentProfile.markup_value) 
        : 300
    } : { type: 'percent', value: 300 };
    
    const plansWithAgentPrices = filteredPlans.map(plan => {
      const basePrice = Number(plan.wholesale_price) || 0;
      let agentPrice = basePrice;
      
      if (currentMarkup.type === 'percent') {
        agentPrice = basePrice * (1 + currentMarkup.value / 100);
      } else {
        agentPrice = basePrice + currentMarkup.value;
      }
      
      return {
        ...plan,
        agent_price: agentPrice
      };
    });
    
    return plansWithAgentPrices;
  };

  const { data: plans = [], isLoading, error } = useQuery<EsimPlan[]>({
    queryKey: ['esim-plans', userId],
    queryFn: fetchPlans,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Realtime: refetch when my agent profile markup updates
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('agent_markup_changes_plans')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agent_profiles' },
        (payload) => {
          if (payload.new?.user_id === userId) {
            queryClient.invalidateQueries({ queryKey: ['esim-plans', userId] });
            toast({ title: 'Pricing updated', description: 'Your plan prices have been recalculated.' });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  if (error) {
    toast({
      title: "Error",
      description: `Failed to fetch eSIM plans: ${(error as Error).message}`,
      variant: "destructive",
    });
  }

// Helper function to check if a regional plan covers a specific country
  const doesRegionalPlanCoverCountry = (plan: any, countryCode: string): boolean => {
    if (plan.country_code !== 'RG') return false;
    
    const title = plan.title?.toLowerCase() || '';
    const description = plan.description?.toLowerCase() || '';
    
  // Define comprehensive country mappings for regional plans
    const regionalMappings = {
      // Asian countries and Central Asia  
      'SG': ['asia', 'singapore', 'central'], 'TH': ['asia', 'thailand'], 'MY': ['asia', 'malaysia'],
      'ID': ['asia', 'indonesia'], 'PH': ['asia', 'philippines'], 'KH': ['asia', 'cambodia'],
      'VN': ['asia', 'vietnam'], 'MM': ['asia', 'myanmar'], 'LA': ['asia', 'laos'],
      'BN': ['asia', 'brunei'], 'JP': ['asia', 'japan'], 'KR': ['asia', 'korea'],
      'HK': ['asia', 'hong kong'], 'MO': ['asia', 'macau'], 'TW': ['asia', 'taiwan'],
      'IN': ['asia', 'india'], 'LK': ['asia', 'lanka'], 'BD': ['asia', 'bangladesh'],
      'NP': ['asia', 'nepal'], 'PK': ['asia', 'pakistan'], 'AF': ['asia', 'afghanistan', 'central'],
      'KZ': ['asia', 'kazakhstan', 'central'], 'UZ': ['asia', 'uzbekistan', 'central'],
      'TM': ['asia', 'turkmenistan', 'central'], 'KG': ['asia', 'kyrgyzstan', 'central'],
      'TJ': ['asia', 'tajikistan', 'central'], 'MN': ['asia', 'mongolia', 'central'],
      'CN': ['asia', 'china'],
      
      // European countries
      'GB': ['europe', 'united kingdom', 'britain'], 'DE': ['europe', 'germany'],
      'FR': ['europe', 'france'], 'IT': ['europe', 'italy'], 'ES': ['europe', 'spain'],
      'NL': ['europe', 'netherlands'], 'BE': ['europe', 'belgium'], 'AT': ['europe', 'austria'],
      'CH': ['europe', 'switzerland'], 'PL': ['europe', 'poland'], 'CZ': ['europe', 'czech'],
      'PT': ['europe', 'portugal'], 'GR': ['europe', 'greece'], 'DK': ['europe', 'denmark'],
      'SE': ['europe', 'sweden'], 'NO': ['europe', 'norway'], 'FI': ['europe', 'finland'],
      'IE': ['europe', 'ireland'], 'RU': ['europe', 'russia'], 'TR': ['europe', 'turkey', 'middle east'],
      'UA': ['europe', 'ukraine'], 'HU': ['europe', 'hungary'], 'RO': ['europe', 'romania'],
      'BG': ['europe', 'bulgaria'], 'HR': ['europe', 'croatia'], 'SK': ['europe', 'slovakia'],
      'SI': ['europe', 'slovenia'], 'LT': ['europe', 'lithuania'], 'LV': ['europe', 'latvia'],
      'EE': ['europe', 'estonia'], 'LU': ['europe', 'luxembourg'], 'MT': ['europe', 'malta'],
      'CY': ['europe', 'cyprus'], 'IS': ['europe', 'iceland'],
      
      // North American countries  
      'US': ['north america', 'united states', 'usa'], 'CA': ['north america', 'canada'],
      'MX': ['north america', 'mexico'],
      
      // South American countries
      'AR': ['south america', 'argentina'], 'BO': ['south america', 'bolivia'], 
      'BR': ['south america', 'brazil'], 'CL': ['south america', 'chile'], 
      'CO': ['south america', 'colombia'], 'CR': ['south america', 'costa rica'],
      'EC': ['south america', 'ecuador'], 'SV': ['south america', 'el salvador'],
      'GP': ['south america', 'french west indies'], 'GT': ['south america', 'guatemala'],
      'HN': ['south america', 'honduras'], 'NI': ['south america', 'nicaragua'],
      'PA': ['south america', 'panama'], 'PY': ['south america', 'paraguay'],
      'PE': ['south america', 'peru'], 'PR': ['south america', 'puerto rico'],
      'UY': ['south america', 'uruguay'],
      
      // Gulf and Middle East countries
      'AE': ['middle east', 'emirates', 'gulf', 'arab', 'north africa'], 'SA': ['middle east', 'saudi', 'gulf', 'arab'],
      'QA': ['middle east', 'qatar', 'gulf', 'arab'], 'KW': ['middle east', 'kuwait', 'gulf', 'arab'],
      'BH': ['middle east', 'bahrain', 'gulf', 'arab'], 'OM': ['middle east', 'oman', 'gulf', 'arab'],
      'IQ': ['middle east', 'iraq', 'gulf'], 'IL': ['middle east', 'israel'], 'JO': ['middle east', 'jordan'], 
      'LB': ['middle east', 'lebanon'], 'SY': ['middle east', 'syria'], 'IR': ['middle east', 'iran'],
      'AM': ['middle east', 'armenia'], 'AZ': ['middle east', 'azerbaijan'],
      
      // North Africa countries (also part of Middle East & North Africa region)
      'EG': ['middle east', 'egypt', 'north africa', 'africa'], 'MA': ['north africa', 'morocco', 'africa'],
      'TN': ['north africa', 'tunisia', 'africa'],
      
      // African countries  
      'ZA': ['africa', 'south africa'], 'NG': ['africa', 'nigeria'], 'KE': ['africa', 'kenya'], 
      'GH': ['africa', 'ghana'], 'ET': ['africa', 'ethiopia'],
      'TZ': ['africa', 'tanzania'], 'UG': ['africa', 'uganda'], 'ZW': ['africa', 'zimbabwe'],
      
      // Oceanian countries
      'AU': ['oceania', 'australia'], 'NZ': ['oceania', 'new zealand'], 'FJ': ['oceania', 'fiji']
    };
    
    const keywords = regionalMappings[countryCode as keyof typeof regionalMappings] || [];
    return keywords.some(keyword => title.includes(keyword) || description.includes(keyword));
  };

// Filter plans based on search, region, and country using debounced search
  const filteredPlans = useMemo(() => {
    const filtered = plans.filter((plan) => {
      const searchLower = debouncedSearchQuery?.toLowerCase() || "";
      
      // Enhanced search matching that includes regional plan coverage
      const matchesSearch = !debouncedSearchQuery || (
        plan.title?.toLowerCase().includes(searchLower) ||
        plan.country_name?.toLowerCase().includes(searchLower) ||
        plan.description?.toLowerCase().includes(searchLower) ||
        plan.data_amount?.toLowerCase().includes(searchLower) ||
        // Check if this is a regional plan that covers countries mentioned in search
        (plan.country_code === 'RG' && (
          plan.title?.toLowerCase().includes(searchLower) ||
          plan.description?.toLowerCase().includes(searchLower)
        ))
      );
      
      const planRegion = getRegion(plan.country_code);
      const matchesRegion = 
        selectedRegion === "all" || 
        planRegion === selectedRegion;

      // Enhanced country matching that includes regional plan coverage
      const matchesCountry = 
        selectedCountry === "all" || 
        plan.country_code === selectedCountry ||
        // Check if this regional plan covers the selected country
        doesRegionalPlanCoverCountry(plan, selectedCountry);
      
      return matchesSearch && matchesRegion && matchesCountry;
    });
    
    return filtered;
  }, [plans, debouncedSearchQuery, selectedRegion, selectedCountry]);

  // Sort filtered plans
  const sortedPlans = useMemo(() => {
    const sorted = [...filteredPlans];
    
    switch (sortBy) {
      case "price-asc":
        return sorted.sort((a, b) => (Number(a.agent_price) || 0) - (Number(b.agent_price) || 0));
      case "price-desc":
        return sorted.sort((a, b) => (Number(b.agent_price) || 0) - (Number(a.agent_price) || 0));
      case "duration-asc":
        return sorted.sort((a, b) => (a.validity_days || 0) - (b.validity_days || 0));
      case "duration-desc":
        return sorted.sort((a, b) => (b.validity_days || 0) - (a.validity_days || 0));
      case "data-asc":
        return sorted.sort((a, b) => {
          const aData = parseFloat(a.data_amount.replace(/[^0-9.]/g, '')) || 0;
          const bData = parseFloat(b.data_amount.replace(/[^0-9.]/g, '')) || 0;
          return aData - bData;
        });
      case "data-desc":
        return sorted.sort((a, b) => {
          const aData = parseFloat(a.data_amount.replace(/[^0-9.]/g, '')) || 0;
          const bData = parseFloat(b.data_amount.replace(/[^0-9.]/g, '')) || 0;
          return bData - aData;
        });
      default:
        return sorted;
    }
  }, [filteredPlans, sortBy]);

  // Get paginated plans
  const paginatedPlans = useMemo(() => {
    const startIndex = (currentPage - 1) * plansPerPage;
    const endIndex = startIndex + plansPerPage;
    return sortedPlans.slice(startIndex, endIndex);
  }, [sortedPlans, currentPage, plansPerPage]);

  const totalPages = Math.ceil(sortedPlans.length / plansPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedRegion, selectedCountry, sortBy]);

  const handleAddToCart = (plan: EsimPlan) => {
    if (plan.agent_price == null) return;
    
    const days = isDayPass(plan) 
      ? (dayPassDays[plan.id] ?? Math.max(plan.validity_days || 1, 1)) 
      : plan.validity_days;

    const price = isDayPass(plan)
      ? convertPrice(Number(plan.agent_price)) * days
      : convertPrice(Number(plan.agent_price));
    
    addToCart({
      id: plan.id,
      planId: plan.id,
      title: plan.title,
      countryName: plan.country_name,
      countryCode: plan.country_code,
      dataAmount: plan.data_amount,
      validityDays: days,
      agentPrice: price,
      currency: selectedCurrency
    });

    setAddedToCart(prev => new Set(prev).add(plan.id));
    
    toast({
      title: "Added to Cart",
      description: `${plan.title} has been added to your cart`,
    });

    // Remove the "added" state after 2 seconds
    setTimeout(() => {
      setAddedToCart(prev => {
        const newSet = new Set(prev);
        newSet.delete(plan.id);
        return newSet;
      });
    }, 2000);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-8 animate-fade-in">
          <div className="glass-intense p-8 text-center">
            <h1 className="text-4xl font-bold mb-4 text-black">
              Explore premium eSIM Plans
            </h1>
            <p className="text-muted-foreground text-lg mb-6">
              Loading curated data plans...
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="glass-intense p-8 text-left">
          <h1 className="text-4xl font-bold mb-4 text-black">
            Explore premium eSIM Plans
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Browse curated data plans for your customers. Sell better eSIMs, faster with smart filtering, local pricing, instant downloads.
          </p>
          <div className="flex items-center justify-start gap-2 mt-4 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>{plans.length} plans available</span>
            <span>•</span>
            <Database className="h-4 w-4" />
            <span>{regions.length} regions covered</span>
          </div>
        </div>

        {/* Search and Filter Section */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  placeholder="Search by country, plan name, or data amount..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filter by region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="h-4 w-4" />
                      Default
                    </div>
                  </SelectItem>
                  <SelectItem value="price-asc">Price: Low to High</SelectItem>
                  <SelectItem value="price-desc">Price: High to Low</SelectItem>
                  <SelectItem value="duration-asc">Duration: Short to Long</SelectItem>
                  <SelectItem value="duration-desc">Duration: Long to Short</SelectItem>
                  <SelectItem value="data-asc">Data: Low to High</SelectItem>
                  <SelectItem value="data-desc">Data: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Popular Countries Tabs */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Popular Countries</h3>
              <Tabs value={selectedCountry} onValueChange={setSelectedCountry} className="w-full">
                <TabsList className="h-auto p-1 glass-intense border-0 flex-wrap justify-start">
                  <TabsTrigger 
                    value="all" 
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-2 text-sm"
                  >
                    All Countries
                  </TabsTrigger>
                  {popularCountries.map((country) => (
                    <TabsTrigger 
                      key={country.code} 
                      value={country.code}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-2 text-sm flex items-center gap-2"
                    >
                      <span>{country.flag}</span>
                      <span>{country.name}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            
            {(debouncedSearchQuery || selectedRegion !== "all" || selectedCountry !== "all") ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span>Showing {sortedPlans.length} of {plans?.length || 0} plans</span>
                {debouncedSearchQuery && (
                  <Badge variant="secondary" className="glass-intense border-0">
                    Search: {searchQuery}
                  </Badge>
                )}
                {selectedRegion !== "all" && (
                  <Badge variant="secondary" className="glass-intense border-0">
                    Region: {selectedRegion}
                  </Badge>
                )}
                {selectedCountry !== "all" && (
                  <Badge variant="secondary" className="glass-intense border-0">
                    Country: {popularCountries.find(c => c.code === selectedCountry)?.name || selectedCountry}
                  </Badge>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {paginatedPlans.map((plan, index) => (
            <Card 
              key={plan.id} 
              className="glass-intense hover:scale-105 transition-all duration-300 animate-scale-in border-0"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getCountryFlag(plan.country_code)}</span>
                    <div className="flex-1">
                      <CardTitle className="text-lg leading-tight">{plan.title}</CardTitle>
                      <CardDescription className="text-sm font-medium flex flex-col gap-1">
                        <span>{plan.country_name}</span>
                        {plan.country_code === 'RG' && (
                          <RegionalPlanDropdown planTitle={plan.title} countryCode={plan.country_code} />
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="glass-intense text-xs border-2 border-primary/60">
                    {plan.country_code}
                  </Badge>
                </div>
              </CardHeader>
              
               <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-intense p-3 rounded-xl text-center">
                    <Database className="h-4 w-4 mx-auto mb-1 text-primary" />
                    <p className="font-semibold text-sm">{plan.data_amount}</p>
                    <p className="text-xs text-muted-foreground">Data</p>
                  </div>
                  <div className="glass-intense p-3 rounded-xl text-center">
                    <Clock className="h-4 w-4 mx-auto mb-1 text-primary" />
                    <p className="font-semibold text-sm">{plan.validity_days} days</p>
                    <p className="text-xs text-muted-foreground">Validity</p>
                  </div>
                </div>

                {/* Network Features */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2">
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-medium">5G Premium Network</span>
                  </div>
                  <div className="flex items-center gap-2 p-2">
                    <Router className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium">Hotspot Sharing</span>
                  </div>
                </div>
                
                <div className="glass-intense p-4 rounded-xl text-center space-y-2">
                  {isDayPass(plan) && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Number of Days</span>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={dayPassDays[plan.id] ?? Math.max(plan.validity_days || 1, 1)}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(365, Number(e.target.value) || 1));
                          setDayPassDays(prev => ({ ...prev, [plan.id]: v }));
                        }}
                        className="w-20 text-center glass-intense"
                        aria-label="Number of days"
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mb-1">Agent Price</p>
                  <p className="text-2xl font-bold text-primary">
                    {getCurrencySymbol()}{(
                      isDayPass(plan)
                        ? convertPrice(Number(plan.agent_price ?? 0)) * (dayPassDays[plan.id] ?? Math.max(plan.validity_days || 1, 1))
                        : convertPrice(Number(plan.agent_price ?? plan.wholesale_price ?? 0))
                    ).toFixed(2)} {selectedCurrency}
                  </p>
                  {isDayPass(plan) && (
                    <p className="text-xs text-muted-foreground">
                      {getCurrencySymbol()}{convertPrice(Number(plan.agent_price ?? 0)).toFixed(2)} {selectedCurrency} per day × {(dayPassDays[plan.id] ?? Math.max(plan.validity_days || 1, 1))} days
                    </p>
                  )}
                </div>

                {/* Add to Cart Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleAddToCart(plan)}
                      className="flex-1 transition-all duration-200 hover:scale-105 active:scale-95"
                      variant={addedToCart.has(plan.id) ? "outline" : "default"}
                      disabled={addedToCart.has(plan.id)}
                    >
                      {addedToCart.has(plan.id) ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Added to Cart
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {isDayPass(plan) ? 'Add with Days' : 'Add to Cart'}
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {isDayPass(plan) ? 'Days can be adjusted above' : 'Quantity can be adjusted in cart'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="glass-intense border-0"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Page {currentPage} of {totalPages}</span>
              <span>•</span>
              <span>{sortedPlans.length} plans</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="glass-intense border-0"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Empty State */}
        {filteredPlans.length === 0 && !isLoading && (
          <Card className="glass-intense border-0 bg-transparent">
            <CardContent className="text-center py-16">
              <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No plans found</h3>
              <p className="text-muted-foreground">
                {debouncedSearchQuery || selectedRegion !== "all" 
                  ? "Try adjusting your search or filter criteria"
                  : "No eSIM plans are currently available"}
              </p>
            </CardContent>
          </Card>
        )}

      </div>
    </Layout>
  );
}