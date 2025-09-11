import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { useAgentMarkup } from "@/hooks/useAgentMarkup";

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
  const [availablePlans, setAvailablePlans] = useState<EsimPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const { markup, calculatePrice } = useAgentMarkup();
  const { toast } = useToast();

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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Your eSIM Plan Costs</h1>
          <p className="text-muted-foreground">Prices you will be charged per plan based on your contract markup</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plansWithPricing.map((plan) => (
            <Card key={plan.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{plan.title}</CardTitle>
                <CardDescription>{plan.country_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="font-medium">Data: {plan.data_amount}</p>
                      <p className="text-muted-foreground">Validity: {plan.validity_days} days</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{plan.currency} {plan.retail_price}</p>
                      <Badge variant="secondary">Your Price</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}