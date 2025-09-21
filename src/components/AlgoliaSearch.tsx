import React, { useState } from 'react';
import { 
  InstantSearch, 
  SearchBox, 
  Hits, 
  RefinementList, 
  Configure,
  ClearRefinements,
  CurrentRefinements,
  Stats,
  SortBy,
  RangeInput,
  useSearchBox,
  useStats
} from 'react-instantsearch';
import { searchClient } from '@/lib/algolia';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { Search, Filter, X, Wifi, Smartphone, Globe, Calendar, Database } from 'lucide-react';

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
    <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            <CardTitle className="text-lg font-semibold text-foreground leading-tight">
              {hit.title}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-4 w-4" />
              {hit.country_name}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {getCurrencySymbol()}{displayPrice}
            </div>
            <div className="text-xs text-muted-foreground">per plan</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Database className="h-4 w-4 text-primary" />
              <span className="font-medium">{hit.data_amount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span>{hit.validity_days} days</span>
            </div>
          </div>
        </div>
        
        {hit.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {hit.description}
          </p>
        )}
        
        <Button 
          onClick={handleAddToCart}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          size="sm"
        >
          Add to Cart
        </Button>
      </CardContent>
    </Card>
  );
};

const CustomSearchBox = () => {
  const { query, refine } = useSearchBox();
  
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        type="search"
        value={query}
        onChange={(e) => refine(e.target.value)}
        placeholder="Search by country, data amount, or validity..."
        className="pl-10 h-12 text-base border-input bg-background"
      />
    </div>
  );
};

const CustomStats = () => {
  const { nbHits, processingTimeMS } = useStats();
  
  return (
    <div className="text-sm text-muted-foreground">
      {nbHits.toLocaleString()} plans found in {processingTimeMS}ms
    </div>
  );
};

const FilterSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="border-border/50">
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      {children}
    </CardContent>
  </Card>
);

const AlgoliaSearch = () => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const refinementListClasses = {
    root: 'space-y-2',
    list: 'space-y-1.5 max-h-48 overflow-y-auto',
    item: 'flex items-center space-x-2',
    label: 'text-sm cursor-pointer flex items-center space-x-2 w-full hover:text-primary transition-colors',
    checkbox: 'h-4 w-4 rounded border border-input text-primary focus:ring-primary accent-primary',
    labelText: 'text-sm flex-1',
    count: 'text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full min-w-[1.5rem] text-center',
  };

  const MobileFilters = () => (
    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Search Filters</SheetTitle>
          <SheetDescription>
            Refine your search to find the perfect eSIM plan
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <FiltersContent />
        </div>
      </SheetContent>
    </Sheet>
  );

  const FiltersContent = () => (
    <>
      <div className="mb-4">
        <ClearRefinements 
          classNames={{
            root: '',
            button: 'text-sm text-primary hover:text-primary/80 underline'
          }}
          translations={{
            resetButtonText: 'Clear all filters'
          }}
        />
      </div>

      <FilterSection title="Country">
        <RefinementList 
          attribute="country_name"
          limit={8}
          showMore={true}
          showMoreLimit={20}
          classNames={refinementListClasses}
          translations={{
            showMoreButtonText: ({ isShowingMore }) =>
              isShowingMore ? 'Show less' : 'Show more'
          }}
        />
      </FilterSection>

      <FilterSection title="Data Amount">
        <RefinementList 
          attribute="data_amount"
          limit={10}
          classNames={refinementListClasses}
        />
      </FilterSection>

      <FilterSection title="Validity Period">
        <RefinementList 
          attribute="validity_days"
          limit={8}
          classNames={refinementListClasses}
        />
      </FilterSection>

      <FilterSection title="Price Range (USD)">
        <RangeInput 
          attribute="wholesale_price"
          classNames={{
            root: 'space-y-2',
            form: 'flex gap-2 items-center',
            input: 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm',
            separator: 'text-muted-foreground text-sm',
            submit: 'hidden'
          }}
          translations={{
            separatorElementText: 'to'
          }}
        />
      </FilterSection>
    </>
  );

  return (
    <InstantSearch 
      searchClient={searchClient} 
      indexName="esim_plans"
      future={{ preserveSharedStateOnUnmount: true }}
    >
      <Configure 
        hitsPerPage={24} 
        filters="is_active:true"
        attributesToSnippet={['description:50']}
      />
      
      <div className="space-y-6">
        {/* Search Header */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-6">
            <div className="space-y-4">
              <CustomSearchBox />
              
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CustomStats />
                
                <div className="flex items-center gap-3">
                  <MobileFilters />
                  
                  <SortBy
                    items={[
                      { label: 'Relevance', value: 'esim_plans' },
                      { label: 'Price: Low to High', value: 'esim_plans_price_asc' },
                      { label: 'Price: High to Low', value: 'esim_plans_price_desc' },
                      { label: 'Data: Most to Least', value: 'esim_plans_data_desc' },
                    ]}
                    classNames={{
                      root: '',
                      select: 'h-9 text-sm min-w-[140px]'
                    }}
                  />
                </div>
              </div>
              
              <CurrentRefinements
                classNames={{
                  root: '',
                  list: 'flex flex-wrap gap-2',
                  item: '',
                  label: 'inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs',
                  category: 'font-medium',
                  categoryLabel: '',
                  delete: 'ml-1 hover:bg-primary/20 rounded-full p-0.5'
                }}
                transformItems={(items) =>
                  items.map((item) => ({
                    ...item,
                    refinements: item.refinements.map((refinement) => ({
                      ...refinement,
                      label: `${item.label}: ${refinement.label}`
                    }))
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-6">
          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block w-80 space-y-6">
            <FiltersContent />
          </div>

          {/* Results */}
          <div className="flex-1">
            <Hits 
              hitComponent={PlanHit}
              classNames={{
                root: '',
                list: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6',
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