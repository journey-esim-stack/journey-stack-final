import { useState, useEffect } from "react";
import { InstantSearch, SearchBox, Hits, RefinementList, Stats, Pagination, Configure } from 'react-instantsearch';
import { searchClient, ESIM_PLANS_INDEX } from "@/lib/algolia";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Globe, Clock, Database, Wifi, ShoppingCart, Check, Search as SearchIcon } from "lucide-react";
import Layout from "@/components/Layout";
import { getCountryFlag } from "@/utils/countryFlags";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";

interface EsimPlan {
  objectID: string;
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

function PlanHit({ hit }: { hit: EsimPlan }) {
  const [addedToCart, setAddedToCart] = useState(false);
  const [dayPassDays, setDayPassDays] = useState(Math.max(hit.validity_days || 1, 1));
  const { toast } = useToast();
  const { addToCart } = useCart();
  const { convertPrice, getCurrencySymbol } = useCurrency();

  // Detect Day Pass (Unlimited FUP) plans
  const isDayPass = (plan: EsimPlan) => {
    const t = (plan.title || '').toLowerCase();
    const d = (plan.description || '').toLowerCase();
    return /\/\s*day\b/.test(t) || t.includes('daily') || /\/\s*day\b/.test(d) || d.includes('daily');
  };

  const handleAddToCart = () => {
    if (hit.agent_price == null) return;
    
    const days = isDayPass(hit) ? dayPassDays : hit.validity_days;
    const price = isDayPass(hit) ? hit.agent_price * dayPassDays : hit.agent_price;

    const cartItem = {
      id: hit.id,
      planId: hit.id,
      title: hit.title,
      countryName: hit.country_name,
      countryCode: hit.country_code,
      dataAmount: hit.data_amount,
      validityDays: days,
      agentPrice: price,
      currency: hit.currency,
      supplier_name: hit.supplier_name,
    };

    addToCart(cartItem);
    setAddedToCart(true);
    
    toast({
      title: "Added to cart",
      description: `${hit.title} has been added to your cart.`,
    });

    setTimeout(() => setAddedToCart(false), 2000);
  };

  const flag = getCountryFlag(hit.country_code);
  const isDayPassPlan = isDayPass(hit);
  const displayPrice = isDayPassPlan ? hit.agent_price * dayPassDays : hit.agent_price;
  const convertedPrice = convertPrice(displayPrice || 0);

  return (
    <Card className="h-full hover:shadow-lg transition-all duration-200 border border-border/50 hover:border-border group">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {hit.title}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-2 text-muted-foreground">
              <span className="text-lg">{flag}</span>
              <span className="font-medium">{hit.country_name}</span>
              <Badge variant="outline" className="text-xs">
                {hit.supplier_name === 'esim_access' ? 'eSIM Access' : 'Maya'}
              </Badge>
            </CardDescription>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-primary">
              {getCurrencySymbol()}{convertedPrice.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              Total Price
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <Database className="h-5 w-5 mx-auto text-primary" />
            <div className="text-sm font-medium text-foreground">{hit.data_amount}</div>
            <div className="text-xs text-muted-foreground">Data</div>
          </div>
          <div className="space-y-1">
            <Clock className="h-5 w-5 mx-auto text-primary" />
            <div className="text-sm font-medium text-foreground">
              {isDayPassPlan ? (
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    value={dayPassDays}
                    onChange={(e) => setDayPassDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 h-6 text-xs text-center border rounded"
                  />
                  <span className="text-xs">days</span>
                </div>
              ) : (
                `${hit.validity_days} days`
              )}
            </div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </div>
          <div className="space-y-1">
            <Wifi className="h-5 w-5 mx-auto text-primary" />
            <div className="text-sm font-medium text-foreground">4G/5G</div>
            <div className="text-xs text-muted-foreground">Network</div>
          </div>
        </div>

        <Button 
          onClick={handleAddToCart}
          disabled={addedToCart || hit.agent_price == null}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-lg transition-all duration-200"
        >
          {addedToCart ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Added!
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add to Cart
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AlgoliaPlans() {
  const [userId, setUserId] = useState<string | null>(null);
  const [agentMarkup, setAgentMarkup] = useState({ type: 'percent', value: 300 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        // Fetch agent markup
        const { data: agentProfile } = await supabase
          .from("agent_profiles")
          .select("markup_type, markup_value")
          .eq("user_id", user.id)
          .single();

        if (agentProfile) {
          setAgentMarkup({
            type: agentProfile.markup_type || 'percent',
            value: agentProfile.markup_value !== null && agentProfile.markup_value !== undefined 
              ? Number(agentProfile.markup_value) 
              : 300
          });
        }
      }
    })();
  }, []);

  const transformHits = (hits: any[]) => {
    return hits.map(hit => {
      const basePrice = Number(hit.wholesale_price) || 0;
      let agentPrice = basePrice;
      
      if (agentMarkup.type === 'percent') {
        agentPrice = basePrice * (1 + agentMarkup.value / 100);
      } else {
        agentPrice = basePrice + agentMarkup.value;
      }
      
      return {
        ...hit,
        agent_price: agentPrice
      };
    });
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Algolia eSIM Plans</h1>
              <p className="text-muted-foreground mt-2">
                Advanced search powered by Algolia - Test implementation
              </p>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              <SearchIcon className="h-4 w-4 mr-1" />
              Algolia Search
            </Badge>
          </div>
        </div>

        <InstantSearch searchClient={searchClient} indexName={ESIM_PLANS_INDEX}>
          <Configure 
            hitsPerPage={24}
            filters="is_active:true AND admin_only:false"
          />
          
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Search</CardTitle>
                </CardHeader>
                <CardContent>
                  <SearchBox 
                    placeholder="Search plans, countries..."
                    classNames={{
                      root: 'relative',
                      form: 'relative',
                      input: 'w-full px-3 py-2 border border-input bg-background text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
                      submit: 'absolute right-2 top-1/2 transform -translate-y-1/2',
                      reset: 'absolute right-8 top-1/2 transform -translate-y-1/2'
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Countries</CardTitle>
                </CardHeader>
                <CardContent>
                  <RefinementList 
                    attribute="country_name"
                    limit={10}
                    showMore={true}
                    classNames={{
                      root: 'space-y-2',
                      list: 'space-y-2',
                      item: 'flex items-center space-x-2',
                      label: 'flex items-center space-x-2 cursor-pointer text-sm',
                      checkbox: 'rounded border-input',
                      labelText: 'flex-1',
                      count: 'bg-muted text-muted-foreground px-2 py-1 rounded text-xs'
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Supplier</CardTitle>
                </CardHeader>
                <CardContent>
                  <RefinementList 
                    attribute="supplier_name"
                    classNames={{
                      root: 'space-y-2',
                      list: 'space-y-2',
                      item: 'flex items-center space-x-2',
                      label: 'flex items-center space-x-2 cursor-pointer text-sm',
                      checkbox: 'rounded border-input',
                      labelText: 'flex-1',
                      count: 'bg-muted text-muted-foreground px-2 py-1 rounded text-xs'
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Results */}
            <div className="lg:col-span-3 space-y-6">
              <div className="flex items-center justify-between">
                <Stats 
                  classNames={{
                    root: 'text-sm text-muted-foreground'
                  }}
                />
              </div>

              <Hits 
                hitComponent={({ hit }) => <PlanHit hit={transformHits([hit])[0]} />}
                classNames={{
                  root: '',
                  list: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6',
                  item: ''
                }}
              />

              <div className="flex justify-center">
                <Pagination 
                  classNames={{
                    root: 'flex items-center space-x-2',
                    list: 'flex items-center space-x-1',
                    item: '',
                    link: 'px-3 py-2 text-sm rounded-md border border-input hover:bg-accent',
                    selectedItem: '',
                    disabledItem: 'opacity-50',
                    firstPageItem: '',
                    lastPageItem: '',
                    previousPageItem: '',
                    nextPageItem: ''
                  }}
                />
              </div>
            </div>
          </div>
        </InstantSearch>
      </div>
    </Layout>
  );
}