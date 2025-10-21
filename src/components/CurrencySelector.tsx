import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrency, Currency } from '@/contexts/CurrencyContext';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const CURRENCIES: { value: Currency; label: string; flag: string }[] = [
  { value: 'USD', label: 'USD', flag: '🇺🇸' },
  { value: 'INR', label: 'INR', flag: '🇮🇳' },
  { value: 'AUD', label: 'AUD', flag: '🇦🇺' },
  { value: 'EUR', label: 'EUR', flag: '🇪🇺' }
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
                <span>{currency.flag}</span>
                <span>{currency.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
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