import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Globe, Clock, Database, ArrowUpDown } from "lucide-react";
import Layout from "@/components/Layout";
import { useAgentMarkup } from "@/hooks/useAgentMarkup";
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

export default function Pricing() {
  const [availablePlans, setAvailablePlans] = useState<EsimPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("default");
  const { markup, calculatePrice } = useAgentMarkup();
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
      const { data: plansData, error: plansError } = await supabase
        .from("esim_plans")
        .select("*")
        .eq("is_active", true);

      if (plansError) throw plansError;
      setAvailablePlans(plansData || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch plans data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  const plansWithPricing = availablePlans.map(plan => {
    const retailPrice = calculatePrice(plan.wholesale_price);
    
    return {
      ...plan,
      retail_price: Number(retailPrice.toFixed(2)),
    };
  });

  // Filter plans based on search and filters
  const filteredPlans = useMemo(() => {
    const filtered = plansWithPricing.filter((plan) => {
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
      const asianCountries = ['SG', 'TH', 'MY', 'ID', 'PH', 'KH', 'VN'];
      
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
      
      return matchesSearch && matchesRegion && matchesCountry;
    });
    
    return filtered;
  }, [plansWithPricing, searchQuery, selectedRegion, selectedCountry, popularCountries]);

  // Sort filtered plans
  const sortedPlans = useMemo(() => {
    const sorted = [...filteredPlans];
    
    switch (sortBy) {
      case "price-asc":
        return sorted.sort((a, b) => (Number(a.retail_price) || 0) - (Number(b.retail_price) || 0));
      case "price-desc":
        return sorted.sort((a, b) => (Number(b.retail_price) || 0) - (Number(a.retail_price) || 0));
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="glass-intense p-8 text-center">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            Your eSIM Plan Costs
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Prices you will be charged per plan based on your contract markup
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>{availablePlans.length} plans available</span>
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
        </div>

        {/* Results Section */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedPlans.map((plan) => (
            <Card key={plan.id} className="glass-subtle hover:shadow-lg transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getCountryFlag(plan.country_code)}</span>
                    <div>
                      <CardTitle className="text-lg text-primary">{plan.title}</CardTitle>
                      <CardDescription className="text-sm">{plan.country_name}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Database className="h-4 w-4" />
                      <span className="font-medium">{plan.data_amount}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{plan.validity_days} days</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{plan.currency} {plan.retail_price}</p>
                    <Badge variant="secondary" className="text-xs">Your Price</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sortedPlans.length === 0 && !loading && (
          <div className="text-center py-12">
            <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No plans found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </Layout>
  );
}