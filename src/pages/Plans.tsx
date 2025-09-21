import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Search, ShoppingCart, Check } from "lucide-react";
import { getCountryFlag, getRegion, getAllRegions } from "@/utils/countryFlags";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>("default");
  
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
  const regions = getAllRegions();

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

  const filteredPlans = useMemo(() => {
    const filtered = plans.filter((plan) => {
      const searchLower = debouncedSearchQuery?.toLowerCase() || "";
      
      const matchesSearch = !debouncedSearchQuery || (
        plan.title?.toLowerCase().includes(searchLower) ||
        plan.country_name?.toLowerCase().includes(searchLower) ||
        plan.description?.toLowerCase().includes(searchLower) ||
        plan.data_amount?.toLowerCase().includes(searchLower)
      );
      
      const planRegion = getRegion(plan.country_code);
      const matchesRegion = 
        selectedRegion === "all" || 
        planRegion === selectedRegion;

      const matchesCountry = 
        selectedCountry === "all" || 
        plan.country_code === selectedCountry;
      
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
      default:
        return sorted;
    }
  }, [filteredPlans, sortBy]);

  const handleAddToCart = (plan: EsimPlan) => {
    addToCart({
      id: plan.id,
      planId: plan.id,
      title: plan.title,
      countryName: plan.country_name,
      countryCode: plan.country_code,
      dataAmount: plan.data_amount,
      validityDays: plan.validity_days,
      agentPrice: Number(plan.agent_price) || 0,
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

  const getCountryOptions = () => {
    const countrySet = new Set();
    plans.forEach(plan => {
      if (plan.country_code !== 'RG') {
        countrySet.add(plan.country_code);
      }
    });
    return Array.from(countrySet).map(code => ({
      code: code as string,
      name: plans.find(p => p.country_code === code)?.country_name || code
    }));
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">eSIM Plans</h1>
          <p className="text-muted-foreground">Browse and search available eSIM plans</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search plans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger>
                <SelectValue placeholder="All Regions" />
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

            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger>
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="duration-asc">Duration: Short to Long</SelectItem>
                <SelectItem value="duration-desc">Duration: Long to Short</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {sortedPlans.length} plans
          </p>
        </div>

        {/* Plans Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading plans...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Country
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Validity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedPlans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{getCountryFlag(plan.country_code)}</span>
                          <span className="text-sm font-medium text-gray-900">{plan.country_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{plan.title}</div>
                        <div className="text-sm text-gray-500">{plan.supplier_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{plan.data_amount}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {plan.validity_days} {plan.validity_days === 1 ? 'day' : 'days'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {getCurrencySymbol()}{convertPrice(Number(plan.agent_price)).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          onClick={() => handleAddToCart(plan)}
                          size="sm"
                          disabled={addedToCart.has(plan.id)}
                          className="w-full sm:w-auto"
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {sortedPlans.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No plans found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}