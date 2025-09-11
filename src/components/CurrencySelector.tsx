import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrency, Currency } from '@/contexts/CurrencyContext';
import { DollarSign } from 'lucide-react';

const CURRENCIES: { value: Currency; label: string; flag: string }[] = [
  { value: 'USD', label: 'USD', flag: '🇺🇸' },
  { value: 'INR', label: 'INR', flag: '🇮🇳' },
  { value: 'AUD', label: 'AUD', flag: '🇦🇺' },
  { value: 'EUR', label: 'EUR', flag: '🇪🇺' }
];

export default function CurrencySelector() {
  const { selectedCurrency, setSelectedCurrency } = useCurrency();

  return (
    <div className="flex items-center space-x-2">
      <DollarSign className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
        <SelectTrigger className="w-20 h-8 text-sm bg-background border-border">
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
    </div>
  );
}