import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";

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
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("esim_plans")
        .select("*")
        .eq("is_active", true)
        .order("country_name", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch eSIM plans",
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Available eSIM Plans</h1>
          <p className="text-muted-foreground">Browse and manage available eSIM plans for your customers</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.title}</CardTitle>
                  <Badge variant="secondary">{plan.country_code}</Badge>
                </div>
                <CardDescription>{plan.country_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {plan.description}
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{plan.data_amount}</p>
                    <p className="text-sm text-muted-foreground">{plan.validity_days} days</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {plan.currency} {plan.wholesale_price}
                    </p>
                    <p className="text-sm text-muted-foreground">Wholesale</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {plans.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No eSIM plans available</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}