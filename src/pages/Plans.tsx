import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const { toast } = useToast();

  // Get unique regions from plans
  const regions = getAllRegions();

  useEffect(() => {
    fetchPlans();
  }, []);

const fetchPlans = async () => {
    try {
      // Add pagination and better error handling
      const { data, error } = await supabase
        .from("esim_plans")
        .select("*")
        .eq("is_active", true)
        .order("country_name", { ascending: true })
        .limit(1000); // Limit to first 1000 for better performance

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log("Fetched plans:", data?.length || 0);
      setPlans(data || []);
    } catch (error) {
      console.error("Fetch error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch eSIM plans. Please check your permissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter plans based on search and region
  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const matchesSearch = 
        plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.country_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.data_amount.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRegion = 
        selectedRegion === "all" || 
        getRegion(plan.country_code) === selectedRegion;
      
      return matchesSearch && matchesRegion;
    });
  }, [plans, searchQuery, selectedRegion]);

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
          
          {searchQuery || selectedRegion !== "all" ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
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