import React from 'react';
import { InstantSearch, SearchBox, Hits, RefinementList, Configure, Stats } from 'react-instantsearch';
import { searchClient } from '@/lib/algolia';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { Globe, Database, Calendar } from 'lucide-react';

interface ESimPlanHit {
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
}

const PlanHit = ({ hit }: { hit: ESimPlanHit }) => {
  const { selectedCurrency, convertPrice, getCurrencySymbol } = useCurrency();
  const { addToCart } = useCart();

  const displayPrice = convertPrice(hit.wholesale_price);

  const handleAddToCart = () => {
    addToCart({
      id: hit.id,
      planId: hit.id,
      title: hit.title,
      countryName: hit.country_name,
      countryCode: hit.country_code,
      dataAmount: hit.data_amount,
      validityDays: hit.validity_days,
      agentPrice: hit.wholesale_price,
      currency: hit.currency,
      supplier_name: "eSIM Provider"
    });
  };

  return (
    <Card className="h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">{hit.title}</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {hit.country_name}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-primary">
              {getCurrencySymbol()}{displayPrice}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              {hit.data_amount}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {hit.validity_days} days
            </div>
          </div>
          
          {hit.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {hit.description}
            </p>
          )}
          
          <Button 
            onClick={handleAddToCart}
            className="w-full"
            size="sm"
          >
            Add to Cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const AlgoliaSearch = () => {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <InstantSearch searchClient={searchClient} indexName="esim_plans">
        <Configure hitsPerPage={20} filters="is_active:true" />
        
        <div className="space-y-6">
          {/* Search Header */}
          <Card className="w-full">
            <CardContent className="p-6">
              <div className="space-y-4">
                <SearchBox 
                  placeholder="Search by country, data amount, or validity..."
                  classNames={{
                    root: 'w-full',
                    form: 'w-full',
                    input: 'flex h-12 w-full rounded-md border border-input bg-background px-4 py-3 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    submit: 'hidden',
                    reset: 'absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer',
                  }}
                />
                <Stats 
                  classNames={{
                    root: 'text-sm text-muted-foreground'
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Country</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <RefinementList 
                    attribute="country_name"
                    limit={10}
                    showMore={true}
                    classNames={{
                      root: 'space-y-2',
                      list: 'space-y-2 max-h-64 overflow-y-auto',
                      item: 'flex items-center space-x-2',
                      label: 'text-sm cursor-pointer flex items-center space-x-2 w-full',
                      checkbox: 'h-4 w-4 rounded border border-input text-primary focus:ring-primary',
                      labelText: 'text-sm flex-1',
                      count: 'text-xs text-muted-foreground bg-muted px-2 py-1 rounded',
                      showMore: 'text-sm text-primary hover:underline mt-2 cursor-pointer'
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Data Amount</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <RefinementList 
                    attribute="data_amount"
                    limit={8}
                    classNames={{
                      root: 'space-y-2',
                      list: 'space-y-2',
                      item: 'flex items-center space-x-2',
                      label: 'text-sm cursor-pointer flex items-center space-x-2 w-full',
                      checkbox: 'h-4 w-4 rounded border border-input text-primary focus:ring-primary',
                      labelText: 'text-sm flex-1',
                      count: 'text-xs text-muted-foreground bg-muted px-2 py-1 rounded',
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Validity</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <RefinementList 
                    attribute="validity_days"
                    limit={8}
                    classNames={{
                      root: 'space-y-2',
                      list: 'space-y-2',
                      item: 'flex items-center space-x-2',
                      label: 'text-sm cursor-pointer flex items-center space-x-2 w-full',
                      checkbox: 'h-4 w-4 rounded border border-input text-primary focus:ring-primary',
                      labelText: 'text-sm flex-1',
                      count: 'text-xs text-muted-foreground bg-muted px-2 py-1 rounded',
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Results */}
            <div className="lg:col-span-3">
              <Hits 
                hitComponent={PlanHit}
                classNames={{
                  root: 'w-full',
                  list: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4',
                  item: 'w-full'
                }}
              />
            </div>
          </div>
        </div>
      </InstantSearch>
    </div>
  );
};

export default AlgoliaSearch;