import { useState, useEffect } from "react";
import { InstantSearch, SearchBox, Hits, RefinementList, Stats, Pagination, Configure, useSearchBox, useHits } from 'react-instantsearch';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Globe, Clock, Database, Wifi, ShoppingCart, Check, Search as SearchIcon, AlertCircle } from "lucide-react";
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

function NoResultsMessage() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">No Plans Found</h3>
      <p className="text-muted-foreground max-w-md">
        The Algolia search index may not be set up yet or may be empty. 
        Please run the Algolia setup first to sync your eSIM plans.
      </p>
      <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/algolia-setup'}>
        <Database className="h-4 w-4 mr-2" />
        Setup Algolia
      </Button>
    </div>
  );
}

function CustomSearchBox() {
  const { query, refine } = useSearchBox();
  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => refine(e.currentTarget.value)}
        placeholder="Search plans, countries..."
        className="w-full px-3 py-2 border border-input bg-background text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />
    </div>
  );
}

function SearchResults({ agentMarkup }: { agentMarkup: { type: string; value: number } }) {
  const { hits } = useHits();
  
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

  const transformedHits = transformHits(hits);

  if (transformedHits.length === 0) {
    return <NoResultsMessage />;
  }

  return (
    <>
      {transformedHits.map((hit) => (
        <PlanHit key={hit.objectID} hit={hit} />
      ))}
    </>
  );
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
  const [searchClient, setSearchClient] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [algoliaError, setAlgoliaError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initializeAlgolia = async () => {
      try {
        // Get user data first
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }
        
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

        // Fetch Algolia credentials from Edge Function
        const { data: creds, error: credsError } = await supabase.functions.invoke('get-algolia-credentials');
        if (credsError || !creds?.appId || !creds?.apiKey) {
          throw new Error('Failed to load Algolia credentials');
        }

        const client = algoliasearch(
          creds.appId,
          creds.apiKey
        );
        
        console.log('Algolia client initialized with secured key');
        setSearchClient(client);
        
      } catch (error) {
        console.error('Failed to initialize Algolia:', error);
        setAlgoliaError('Failed to initialize search. The Algolia index may not be configured yet.');
        toast({
          title: "Search Unavailable",
          description: "Please set up Algolia integration first.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeAlgolia();
  }, []);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (algoliaError || !searchClient) {
    return (
      <Layout>
        <div className="space-y-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Algolia eSIM Plans</h1>
                <p className="text-muted-foreground mt-2">
                  Advanced search powered by Algolia
                </p>
              </div>
              <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                <AlertCircle className="h-4 w-4 mr-1" />
                Setup Required
              </Badge>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                Algolia Setup Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                The Algolia search integration needs to be configured before you can use this page. 
                Please run the Algolia setup to sync your eSIM plans to the search index.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => window.location.href = '/algolia-setup'}>
                  <Database className="h-4 w-4 mr-2" />
                  Setup Algolia Integration
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/plans'}>
                  <SearchIcon className="h-4 w-4 mr-2" />
                  Use Legacy Plans Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

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
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <SearchIcon className="h-4 w-4 mr-1" />
                Algolia Search
              </Badge>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/plans'}>
                Legacy Plans
              </Button>
            </div>
          </div>
        </div>

        <InstantSearch searchClient={searchClient} indexName="esim_plans">
          <Configure 
            hitsPerPage={24}
            filters="is_active:true"
          />
          
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Search</CardTitle>
                </CardHeader>
                <CardContent>
                  <CustomSearchBox />
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

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <SearchResults agentMarkup={agentMarkup} />
              </div>

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