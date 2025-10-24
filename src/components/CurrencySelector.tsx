import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrency, Currency } from '@/contexts/CurrencyContext';
import { RefreshCw, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FlagIcon } from '@/components/ui/flag-icon';

const CURRENCIES: { value: Currency; label: string; countryCode: string }[] = [
  { value: 'USD', label: 'USD', countryCode: 'US' },
  { value: 'INR', label: 'INR', countryCode: 'IN' },
  { value: 'AUD', label: 'AUD', countryCode: 'AU' },
  { value: 'EUR', label: 'EUR', countryCode: 'EU' } // EU is not valid ISO code, will show Globe
];

export default function CurrencySelector() {
  const { selectedCurrency, setSelectedCurrency, lastUpdated, isLoading, refreshRates } = useCurrency();

  const formatLastUpdated = (date: string | null) => {
    if (!date) return 'Never';
    const diffMs = Date.now() - new Date(date).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="w-24 md:w-28 h-8 text-xs md:text-sm bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border shadow-lg">
                  {CURRENCIES.map((currency) => (
                    <SelectItem 
                      key={currency.value} 
                      value={currency.value}
                      className="hover:bg-accent focus:bg-accent"
                    >
                      <div className="flex items-center space-x-2">
                        <FlagIcon countryCode={currency.countryCode} size="sm" />
                        <span>{currency.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Display Currency - For viewing plan prices only</p>
            <p className="text-xs text-muted-foreground">Your wallet currency is set based on your country</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={refreshRates}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Rates updated: {formatLastUpdated(lastUpdated)}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}