import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Globe, Clock, Database } from "lucide-react";
import Layout from "@/components/Layout";
import { getCountryFlag, getRegion, getAllRegions } from "@/utils/countryFlags";

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
}

export default function Plans() {
  const [plans, setPlans] = useState<EsimPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const { toast } = useToast();

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
      
      setPlans(allPlans);
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
      const matchesSearch = !searchQuery || (
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
              <span>Showing {filteredPlans.length} of {plans.length} plans</span>
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
          {filteredPlans.map((plan, index) => (
            <Card 
              key={plan.id} 
              className="glass-intense hover:scale-105 transition-all duration-300 animate-scale-in border-0 bg-transparent"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getCountryFlag(plan.country_code)}</span>
                    <div>
                      <CardTitle className="text-lg leading-tight">{plan.title}</CardTitle>
                      <CardDescription className="text-sm font-medium">
                        {plan.country_name}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="glass-intense text-xs border-0">
                    {plan.country_code}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {plan.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {plan.description}
                  </p>
                )}
                
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
                
                <div className="glass-intense p-4 rounded-xl text-center">
                  <p className="text-xs text-muted-foreground mb-1">Wholesale Price</p>
                  <p className="text-2xl font-bold text-primary">
                    {plan.currency} {plan.wholesale_price}
                  </p>
                </div>

                <div className="pt-2 border-t border-glass-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Region: {getRegion(plan.country_code)}
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