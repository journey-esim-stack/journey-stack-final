import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
// Fixed imports - using Router instead of HotspotIcon
import { Search, Globe, Clock, Database, Wifi, Router, ShoppingCart, Check, ArrowUpDown } from "lucide-react";
import Layout from "@/components/Layout";
import { getCountryFlag, getRegion, getAllRegions } from "@/utils/countryFlags";
import { useCart } from "@/contexts/CartContext";
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
  agent_price?: number; // Calculated agent price based on markup
}

// Plans page component - updated to fix import issue
export default function Plans() {
  const [plans, setPlans] = useState<EsimPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [agentMarkup, setAgentMarkup] = useState<{ type: string; value: number }>({ type: 'percent', value: 40 });
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set());
  const [dayPassDays, setDayPassDays] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<string>("default");
  const { toast } = useToast();
  const { addToCart } = useCart();

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

  useEffect(() => {
    fetchPlans();
  }, []);

const fetchPlans = async () => {
    try {
      console.log("Starting to fetch plans...");
      
      // Check authentication first
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Current user:", user?.id || "Not authenticated");
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Fetch agent markup settings
      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("markup_type, markup_value")
        .eq("user_id", user.id)
        .single();

      if (agentProfile) {
        setAgentMarkup({
          type: agentProfile.markup_type || 'percent',
          value: Number(agentProfile.markup_value) || 40
        });
      }

      // Fetch all plans in batches to overcome 1000 row limit
      let allPlans: EsimPlan[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        console.log(`Fetching batch ${from} to ${from + batchSize - 1}`);
        
        const { data, error, count } = await supabase
          .from("esim_plans")
          .select("*", { count: 'exact' })
          .eq("is_active", true)
          .range(from, from + batchSize - 1)
          .order("country_name", { ascending: true });

        if (error) {
          console.error("Detailed Supabase error:", JSON.stringify(error, null, 2));
          throw error;
        }

        if (data && data.length > 0) {
          allPlans = [...allPlans, ...data];
          console.log(`Batch fetched: ${data.length} plans. Total so far: ${allPlans.length}`);
          
          // Check if we got fewer than batchSize, meaning we're done
          if (data.length < batchSize) {
            hasMore = false;
          } else {
            from += batchSize;
          }
        } else {
          hasMore = false;
        }
      }

      console.log("Final total plans fetched:", allPlans.length);
      console.log("Sample countries:", allPlans.slice(0, 5)?.map(p => p.country_name) || []);
      console.log("Sample country codes:", allPlans.slice(0, 5)?.map(p => p.country_code) || []);
      console.log("Looking for Singapore plans:", allPlans?.filter(p => p.country_name?.toLowerCase().includes('singapore') || p.country_code?.toLowerCase().includes('sg')) || []);
      
      // Calculate agent prices for each plan using the fetched markup
      const currentMarkup = agentProfile ? {
        type: agentProfile.markup_type || 'percent',
        value: Number(agentProfile.markup_value) || 40
      } : { type: 'percent', value: 40 };

      console.log("Using markup for calculations:", currentMarkup);
      
      const plansWithAgentPrices = allPlans.map(plan => {
        const basePrice = Number(plan.wholesale_price) || 0;
        let agentPrice = basePrice;
        
        if (currentMarkup.type === 'percent') {
          agentPrice = basePrice * (1 + currentMarkup.value / 100);
        } else {
          agentPrice = basePrice + currentMarkup.value;
        }
        
        console.log(`Plan: ${plan.title}, Base: $${basePrice}, Markup: ${currentMarkup.value}% (${currentMarkup.type}), Agent Price: $${agentPrice.toFixed(2)}`);
        
        return {
          ...plan,
          agent_price: agentPrice
        };
      });
      
      setPlans(plansWithAgentPrices);
    } catch (error) {
      console.error("Fetch error:", error);
      toast({
        title: "Error",
        description: `Failed to fetch eSIM plans: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

// Filter plans based on search, region, and country
  const filteredPlans = useMemo(() => {
    console.log("Filtering plans. Total plans:", plans.length, "Search:", searchQuery, "Region:", selectedRegion, "Country:", selectedCountry);
    
    if (plans.length > 0) {
      console.log("Sample plan structure:", plans[0]);
    }
    
    const filtered = plans.filter((plan) => {
      // Debug each plan's search matching
      if (searchQuery && searchQuery.toLowerCase() === "singapore") {
        console.log("Checking plan:", {
          title: plan.title,
          country_name: plan.country_name,
          country_code: plan.country_code,
          description: plan.description,
          data_amount: plan.data_amount
        });
      }
      
      const searchLower = searchQuery?.toLowerCase() || "";
      
      // Check if search matches Asian countries and this is an Asian regional plan
      const asianCountryNames = ['singapore', 'thailand', 'malaysia', 'indonesia', 'philippines', 'cambodia', 'vietnam'];
      const isSearchingForAsianCountry = asianCountryNames.some(country => searchLower.includes(country));
      const isAsianRegionalPlan = plan.country_code === 'RG' && (
        plan.title?.toLowerCase().includes('asia') || 
        plan.description?.toLowerCase().includes('asia')
      );
      
      const matchesSearch = !searchQuery || (
        plan.title?.toLowerCase().includes(searchLower) ||
        plan.country_name?.toLowerCase().includes(searchLower) ||
        plan.description?.toLowerCase().includes(searchLower) ||
        plan.data_amount?.toLowerCase().includes(searchLower) ||
        // Include Asian regional plans when searching for Asian countries
        (isSearchingForAsianCountry && isAsianRegionalPlan) ||
        // Include regional/multi-country plans that mention the search term in title or description
        (plan.country_code === 'RG' && (
          plan.title?.toLowerCase().includes(searchLower) ||
          plan.description?.toLowerCase().includes(searchLower)
        ))
      );
      
      const planRegion = getRegion(plan.country_code);
      const matchesRegion = 
        selectedRegion === "all" || 
        planRegion === selectedRegion;

      // Countries covered by Asian regional plans
      const asianCountries = ['SG', 'TH', 'MY', 'ID', 'PH', 'KH', 'VN']; // Singapore, Thailand, Malaysia, Indonesia, Philippines, Cambodia, Vietnam
      
      const matchesCountry = 
        selectedCountry === "all" || 
        plan.country_code === selectedCountry ||
        // Check if this is an Asian regional plan and selected country is in Asia
        (isAsianRegionalPlan && asianCountries.includes(selectedCountry)) ||
        // Also check regional plans for country mentions in title
        (plan.country_code === 'RG' && (
          plan.title?.toLowerCase().includes(popularCountries.find(c => c.code === selectedCountry)?.name.toLowerCase() || selectedCountry.toLowerCase()) ||
          plan.description?.toLowerCase().includes(popularCountries.find(c => c.code === selectedCountry)?.name.toLowerCase() || selectedCountry.toLowerCase())
        ));
      
      const result = matchesSearch && matchesRegion && matchesCountry;
      
      // Debug specific plans
      if (searchQuery && searchQuery.toLowerCase() === "singapore") {
        console.log(`Plan ${plan.country_name}: matchesSearch=${matchesSearch}, matchesRegion=${matchesRegion}, matchesCountry=${matchesCountry}, result=${result}`);
      }
      
      return result;
    });
    
    console.log("Filtered results:", filtered.length);
    console.log("Sample filtered countries:", filtered.slice(0, 5).map(p => p.country_name));
    
    return filtered;
  }, [plans, searchQuery, selectedRegion, selectedCountry]);

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

  const handleAddToCart = (plan: EsimPlan) => {
    if (plan.agent_price == null) return;
    
    const days = isDayPass(plan) 
      ? (dayPassDays[plan.id] ?? Math.max(plan.validity_days || 1, 1)) 
      : plan.validity_days;

    const price = isDayPass(plan)
      ? Number(plan.agent_price) * days
      : Number(plan.agent_price);
    
    addToCart({
      id: plan.id,
      planId: plan.id,
      title: plan.title,
      countryName: plan.country_name,
      countryCode: plan.country_code,
      dataAmount: plan.data_amount,
      validityDays: days,
      agentPrice: price,
      currency: plan.currency
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="glass-intense p-8 text-center">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            Available eSIM Plans
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Browse and manage premium eSIM plans for your customers worldwide
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>{plans.length} plans available</span>
            <span>•</span>
            <Database className="h-4 w-4" />
            <span>{regions.length} regions covered</span>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="glass-intense p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary" />
              <Input
                placeholder="Search by country, plan name, or data amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 glass-intense border-0"
              />
            </div>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-full md:w-[200px] glass-intense border-0">
                <SelectValue placeholder="Filter by region" />
              </SelectTrigger>
              <SelectContent className="glass-intense border-0">
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-[200px] glass-intense border-0">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent className="glass-intense border-0">
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
          
          {(searchQuery || selectedRegion !== "all" || selectedCountry !== "all") ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>Showing {sortedPlans.length} of {plans.length} plans</span>
              {searchQuery && (
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
        </div>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedPlans.map((plan, index) => (
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
                  <div className="flex items-center gap-2 p-2 glass-subtle rounded-lg">
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-medium">5G Premium Network</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 glass-subtle rounded-lg">
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
                    {plan.currency} {(
                      isDayPass(plan)
                        ? Number(plan.agent_price ?? 0) * (dayPassDays[plan.id] ?? Math.max(plan.validity_days || 1, 1))
                        : Number(plan.agent_price ?? plan.wholesale_price ?? 0)
                    ).toFixed(2)}
                  </p>
                  {isDayPass(plan) && (
                    <p className="text-xs text-muted-foreground">
                      {plan.currency} {Number(plan.agent_price ?? 0).toFixed(2)} per day × {(dayPassDays[plan.id] ?? Math.max(plan.validity_days || 1, 1))} days
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

        {/* Empty State */}
        {filteredPlans.length === 0 && !loading && (
          <Card className="glass-intense border-0 bg-transparent">
            <CardContent className="text-center py-16">
              <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No plans found</h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedRegion !== "all" 
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