import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";

interface PricingData {
  id: string;
  plan_id: string;
  retail_price: number;
  esim_plans: {
    title: string;
    country_name: string;
    data_amount: string;
    validity_days: number;
    wholesale_price: number;
    currency: string;
  };
}

interface EsimPlan {
  id: string;
  title: string;
  country_name: string;
  data_amount: string;
  validity_days: number;
  wholesale_price: number;
  currency: string;
}

export default function Pricing() {
  const [pricing, setPricing] = useState<PricingData[]>([]);
  const [availablePlans, setAvailablePlans] = useState<EsimPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAgentData();
  }, []);

  const fetchAgentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Get agent profile
      const { data: profile, error: profileError } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;
      setAgentId(profile.id);

      // Fetch current pricing
      const { data: pricingData, error: pricingError } = await supabase
        .from("agent_pricing")
        .select(`
          id,
          plan_id,
          retail_price,
          esim_plans:plan_id (
            title,
            country_name,
            data_amount,
            validity_days,
            wholesale_price,
            currency
          )
        `)
        .eq("agent_id", profile.id);

      if (pricingError) throw pricingError;
      setPricing(pricingData || []);

      // Fetch available plans
      const { data: plansData, error: plansError } = await supabase
        .from("esim_plans")
        .select("*")
        .eq("is_active", true);

      if (plansError) throw plansError;
      setAvailablePlans(plansData || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch pricing data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePricing = async (planId: string, retailPrice: number) => {
    if (!agentId) return;

    try {
      const { error } = await supabase
        .from("agent_pricing")
        .upsert({
          agent_id: agentId,
          plan_id: planId,
          retail_price: retailPrice,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pricing updated successfully",
      });

      fetchAgentData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update pricing",
        variant: "destructive",
      });
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
    const existingPricing = pricing.find(p => p.plan_id === plan.id);
    return {
      ...plan,
      retail_price: existingPricing?.retail_price || 0,
      pricing_id: existingPricing?.id,
    };
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pricing Management</h1>
          <p className="text-muted-foreground">Set your retail prices for eSIM plans</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plansWithPricing.map((plan) => (
            <Card key={plan.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{plan.title}</CardTitle>
                <CardDescription>{plan.country_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="font-medium">Data: {plan.data_amount}</p>
                    <p className="text-muted-foreground">Validity: {plan.validity_days} days</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">Wholesale: {plan.currency} {plan.wholesale_price}</p>
                    <Badge variant="outline">Cost</Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`price-${plan.id}`}>Your Retail Price</Label>
                  <div className="flex space-x-2">
                    <Input
                      id={`price-${plan.id}`}
                      type="number"
                      step="0.01"
                      min={plan.wholesale_price}
                      defaultValue={plan.retail_price}
                      placeholder="Set retail price"
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value);
                        if (value && value > plan.wholesale_price) {
                          updatePricing(plan.id, value);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const input = document.getElementById(`price-${plan.id}`) as HTMLInputElement;
                        const value = parseFloat(input.value);
                        if (value && value > plan.wholesale_price) {
                          updatePricing(plan.id, value);
                        }
                      }}
                    >
                      Update
                    </Button>
                  </div>
                  {plan.retail_price > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Margin: {plan.currency} {(plan.retail_price - plan.wholesale_price).toFixed(2)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}