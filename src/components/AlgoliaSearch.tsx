import React from 'react';
import { InstantSearch, SearchBox, Hits, RefinementList, Configure } from 'react-instantsearch';
import { searchClient } from '@/lib/algolia';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';

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
  supplier_name: string;
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
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{hit.title}</CardTitle>
            <CardDescription className="text-sm">
              {hit.country_name} • {hit.data_amount}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {hit.data_amount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Valid for {hit.validity_days} days
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">
                {getCurrencySymbol()}{displayPrice}
              </div>
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
    <InstantSearch searchClient={searchClient} indexName="esim_plans">
      <Configure hitsPerPage={20} />
      
      <div className="space-y-6">
        {/* Search Box */}
        <div className="max-w-md">
          <SearchBox 
            placeholder="Search plans by country, data amount..."
            classNames={{
              root: 'relative',
              form: 'relative',
              input: 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              submit: 'absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-foreground',
              reset: 'absolute right-8 top-2 h-6 w-6 text-muted-foreground hover:text-foreground',
            }}
          />
        </div>

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <div className="w-64 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Country</CardTitle>
              </CardHeader>
              <CardContent>
                <RefinementList 
                  attribute="country_name"
                  limit={10}
                  showMore={true}
                  classNames={{
                    root: 'space-y-2',
                    list: 'space-y-1',
                    item: 'flex items-center space-x-2',
                    label: 'text-sm cursor-pointer flex items-center space-x-2 w-full',
                    checkbox: 'h-4 w-4 rounded border border-primary text-primary focus:ring-primary',
                    labelText: 'text-sm',
                    count: 'text-xs text-muted-foreground ml-auto',
                    showMore: 'text-sm text-primary hover:underline mt-2'
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Data Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <RefinementList 
                  attribute="data_amount"
                  classNames={{
                    root: 'space-y-2',
                    list: 'space-y-1',
                    item: 'flex items-center space-x-2',
                    label: 'text-sm cursor-pointer flex items-center space-x-2 w-full',
                    checkbox: 'h-4 w-4 rounded border border-primary text-primary focus:ring-primary',
                    labelText: 'text-sm',
                    count: 'text-xs text-muted-foreground ml-auto',
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Validity</CardTitle>
              </CardHeader>
              <CardContent>
                <RefinementList 
                  attribute="validity_days"
                  classNames={{
                    root: 'space-y-2',
                    list: 'space-y-1',
                    item: 'flex items-center space-x-2',
                    label: 'text-sm cursor-pointer flex items-center space-x-2 w-full',
                    checkbox: 'h-4 w-4 rounded border border-primary text-primary focus:ring-primary',
                    labelText: 'text-sm',
                    count: 'text-xs text-muted-foreground ml-auto',
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="flex-1">
            <Hits 
              hitComponent={PlanHit}
              classNames={{
                root: '',
                list: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
                item: ''
              }}
            />
          </div>
        </div>
      </div>
    </InstantSearch>
  );
};

export default AlgoliaSearch;