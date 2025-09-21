import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/Layout";

import { SkeletonCard } from "@/components/ui/skeleton-card";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Search, Globe, Clock, Database, Wifi, Router, ShoppingCart, Check, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getCountryFlag, getRegion, getAllRegions } from "@/utils/countryFlags";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import RegionalPlanDropdown from "@/components/RegionalPlanDropdown";

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
  agent_price?: number;
}

export default function Plans() {
  // Legacy search state
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
  
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

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

  const regions = getAllRegions();
   
  const isDayPass = (p: EsimPlan) => {
    const t = (p.title || '').toLowerCase();
    const d = (p.description || '').toLowerCase();
    return /\/\s*day\b/.test(t) || t.includes('daily') || /\/\s*day\b/.test(d) || d.includes('daily');
  };

  const fetchPlans = async (): Promise<EsimPlan[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("User not authenticated");
    }

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

    let allPlans: EsimPlan[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("esim_plans")
        .select("*")
        .eq("is_active", true)
        .eq("admin_only", false)
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

    let filteredPlans = allPlans.filter(plan => {
      if (plan.supplier_name === 'esim_access') {
        return true;
      }
      
      if (plan.supplier_name === 'maya') {
        const countrySuppliers = countryActivation[plan.country_code];
        if (countrySuppliers && countrySuppliers.includes('maya')) {
          return true;
        }
        
        if (plan.country_code === 'RG') {
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
      
      return true;
    });
    
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
      } as EsimPlan & { agent_price: number };
    });

    return plansWithAgentPrices;
  };

  const { data: plans = [], isLoading, error } = useQuery<EsimPlan[]>({
    queryKey: ['esim-plans', userId],
    queryFn: fetchPlans,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

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

  const doesRegionalPlanCoverCountry = (plan: any, countryCode: string): boolean => {
    if (plan.country_code !== 'RG') return false;
    
    const title = plan.title?.toLowerCase() || '';
    const description = plan.description?.toLowerCase() || '';
    
    const regionalMappings = {
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
      'US': ['north america', 'united states', 'usa'], 'CA': ['north america', 'canada'],
      'MX': ['north america', 'mexico'],
      'AR': ['south america', 'argentina'], 'BO': ['south america', 'bolivia'], 
      'BR': ['south america', 'brazil'], 'CL': ['south america', 'chile'], 
      'CO': ['south america', 'colombia'], 'CR': ['south america', 'costa rica'],
      'EC': ['south america', 'ecuador'], 'SV': ['south america', 'el salvador'],
      'GP': ['south america', 'french west indies'], 'GT': ['south america', 'guatemala'],
      'HN': ['south america', 'honduras'], 'NI': ['south america', 'nicaragua'],
      'PA': ['south america', 'panama'], 'PY': ['south america', 'paraguay'],
      'PE': ['south america', 'peru'], 'PR': ['south america', 'puerto rico'],
      'UY': ['south america', 'uruguay'],
      'AE': ['middle east', 'emirates', 'gulf', 'arab', 'north africa'], 'SA': ['middle east', 'saudi', 'gulf', 'arab'],
      'QA': ['middle east', 'qatar', 'gulf', 'arab'], 'KW': ['middle east', 'kuwait', 'gulf', 'arab'],
      'BH': ['middle east', 'bahrain', 'gulf', 'arab'], 'OM': ['middle east', 'oman', 'gulf', 'arab'],
      'IQ': ['middle east', 'iraq', 'gulf'], 'IL': ['middle east', 'israel'], 'JO': ['middle east', 'jordan'], 
      'LB': ['middle east', 'lebanon'], 'SY': ['middle east', 'syria'], 'IR': ['middle east', 'iran'],
      'AM': ['middle east', 'armenia'], 'AZ': ['middle east', 'azerbaijan'],
      'EG': ['middle east', 'egypt', 'north africa', 'africa'], 'MA': ['north africa', 'morocco', 'africa'],
      'TN': ['north africa', 'tunisia', 'africa'],
      'ZA': ['africa', 'south africa'], 'NG': ['africa', 'nigeria'], 'KE': ['africa', 'kenya'], 
      'GH': ['africa', 'ghana'], 'ET': ['africa', 'ethiopia'],
      'TZ': ['africa', 'tanzania'], 'UG': ['africa', 'uganda'], 'ZW': ['africa', 'zimbabwe'],
      'AU': ['oceania', 'australia'], 'NZ': ['oceania', 'new zealand'], 'FJ': ['oceania', 'fiji']
    };
    
    const keywords = regionalMappings[countryCode as keyof typeof regionalMappings] || [];
    return keywords.some(keyword => title.includes(keyword) || description.includes(keyword));
  };

  const filteredPlans = useMemo(() => {
    const filtered = plans.filter((plan) => {
      const searchLower = debouncedSearchQuery?.toLowerCase() || "";
      
      const matchesSearch = !debouncedSearchQuery || (
        plan.title?.toLowerCase().includes(searchLower) ||
        plan.country_name?.toLowerCase().includes(searchLower) ||
        plan.description?.toLowerCase().includes(searchLower) ||
        plan.data_amount?.toLowerCase().includes(searchLower) ||
        (plan.country_code === 'RG' && (
          plan.title?.toLowerCase().includes(searchLower) ||
          plan.description?.toLowerCase().includes(searchLower)
        ))
      );
      
      const planRegion = getRegion(plan.country_code);
      const matchesRegion = 
        selectedRegion === "all" || 
        planRegion === selectedRegion;

      const matchesCountry = 
        selectedCountry === "all" || 
        plan.country_code === selectedCountry ||
        doesRegionalPlanCoverCountry(plan, selectedCountry);
      
      return matchesSearch && matchesRegion && matchesCountry;
    });
    
    return filtered;
  }, [plans, debouncedSearchQuery, selectedRegion, selectedCountry]);

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

  const paginatedPlans = useMemo(() => {
    const startIndex = (currentPage - 1) * plansPerPage;
    const endIndex = startIndex + plansPerPage;
    return sortedPlans.slice(startIndex, endIndex);
  }, [sortedPlans, currentPage, plansPerPage]);

  const totalPages = Math.ceil(sortedPlans.length / plansPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedRegion, selectedCountry, sortBy]);

  const handleAddToCart = (plan: EsimPlan) => {
    const days = isDayPass(plan) ? dayPassDays[plan.id] || 1 : 1;
    const finalPrice = isDayPass(plan) ? 
      (Number(plan.agent_price) || 0) * days : 
      Number(plan.agent_price) || 0;

    addToCart({
      id: plan.id,
      planId: plan.id,
      title: plan.title,
      countryName: plan.country_name,
      countryCode: plan.country_code,
      dataAmount: plan.data_amount,
      validityDays: plan.validity_days,
      agentPrice: finalPrice,
      currency: selectedCurrency,
      supplier_name: plan.supplier_name
    });

    setAddedToCart(prev => new Set([...prev, plan.id]));
    
    setTimeout(() => {
      setAddedToCart(prev => {
        const newSet = new Set(prev);
        newSet.delete(plan.id);
        return newSet;
      });
    }, 2000);

    toast({
      title: "Added to cart",
      description: `${plan.title} has been added to your cart.`,
    });
  };


  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            eSIM Plans
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Search and browse thousands of eSIM plans with instant results and smart filtering
          </p>
        </div>


        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <>
            <Card className="p-6 mb-6">
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search plans, countries, or data amounts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
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
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        Default
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

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Popular Countries</h3>
                  <Tabs value={selectedCountry} onValueChange={setSelectedCountry}>
                    <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-2 h-auto p-1">
                      <TabsTrigger 
                        value="all" 
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        All
                      </TabsTrigger>
                      {popularCountries.map((country) => (
                        <TabsTrigger 
                          key={country.code} 
                          value={country.code}
                          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
                        >
                          {country.flag} {country.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {debouncedSearchQuery || selectedRegion !== "all" || selectedCountry !== "all" ? (
                  <div className="flex flex-wrap gap-2">
                    {debouncedSearchQuery && (
                      <Badge variant="secondary" className="gap-2">
                        Search: {searchQuery}
                      </Badge>
                    )}
                    {selectedRegion !== "all" && (
                      <Badge variant="secondary" className="gap-2">
                        Region: {selectedRegion}
                      </Badge>
                    )}
                    {selectedCountry !== "all" && (
                      <Badge variant="secondary" className="gap-2">
                        Country: {popularCountries.find(c => c.code === selectedCountry)?.name || selectedCountry}
                      </Badge>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedPlans.map((plan) => (
                <Card key={plan.id} className="flex flex-col h-full hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">
                        {getCountryFlag(plan.country_code)}
                      </span>
                    </div>
                    <CardTitle className="text-lg line-clamp-2">{plan.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {plan.country_code === 'RG' ? (
                        <RegionalPlanDropdown 
                          planTitle={plan.title}
                          countryCode={plan.country_code}
                          supplierName={plan.supplier_name}
                        />
                      ) : (
                        plan.country_name
                      )}
                    </CardDescription>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {plan.supplier_name}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col justify-between">
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{plan.data_amount}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {plan.validity_days} {plan.validity_days === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">4G/5G</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Router className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Hotspot</span>
                      </div>
                    </div>
                    
                    {isDayPass(plan) && (
                      <div className="mb-4">
                        <label className="text-sm font-medium mb-2 block">Days:</label>
                        <Input
                          type="number"
                          min="1"
                          max="30"
                          value={dayPassDays[plan.id] || 1}
                          onChange={(e) => setDayPassDays(prev => ({
                            ...prev,
                            [plan.id]: parseInt(e.target.value) || 1
                          }))}
                          className="w-full"
                        />
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div className="text-right">
                        <span className="text-2xl font-bold">
                          {getCurrencySymbol()}{isDayPass(plan) ? 
                            convertPrice(Number(plan.agent_price) * (dayPassDays[plan.id] || 1)).toFixed(2) : 
                            convertPrice(Number(plan.agent_price)).toFixed(2)
                          }
                        </span>
                        <span className="text-sm text-muted-foreground ml-1">{selectedCurrency}</span>
                      </div>
                      
                      {isDayPass(plan) && (
                        <div className="text-right text-sm text-muted-foreground">
                          {getCurrencySymbol()}{convertPrice(Number(plan.agent_price)).toFixed(2)} per day
                        </div>
                      )}
                      
                      <Button 
                        onClick={() => handleAddToCart(plan)}
                        className="w-full"
                        disabled={addedToCart.has(plan.id)}
                      >
                        {addedToCart.has(plan.id) ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Added
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add to Cart
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <span className="text-sm text-muted-foreground px-4">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {sortedPlans.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No plans found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search criteria or filters to find more plans.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}