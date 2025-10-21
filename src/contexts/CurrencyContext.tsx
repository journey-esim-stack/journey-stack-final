import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type Currency = 'USD' | 'INR' | 'AUD' | 'EUR';

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
  convertPrice: (usdPrice: number) => number;
  getCurrencySymbol: () => string;
  lastUpdated: string | null;
  isLoading: boolean;
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Fallback rates (1 USD = 90 INR as requested)
const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1,
  INR: 90,
  AUD: 1.58,
  EUR: 0.95
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  INR: '₹',
  AUD: 'A$',
  EUR: '€'
};

interface CurrencyProviderProps {
  children: ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<Currency, number>>(FALLBACK_RATES);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchExchangeRates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-exchange-rates');
      
      if (error) throw error;
      
      if (data?.success && data?.rates) {
        setExchangeRates(data.rates);
        setLastUpdated(data.lastUpdated);
        
        if (data.source === 'fallback') {
          console.warn('Using fallback exchange rates');
        }
      } else {
        throw new Error('Invalid response from exchange rate service');
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
      setExchangeRates(FALLBACK_RATES);
      toast.error('Using default exchange rates. Live rates unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRates = async () => {
    await fetchExchangeRates();
  };

  useEffect(() => {
    fetchExchangeRates();
    
    // Refresh every 24 hours
    const interval = setInterval(() => {
      fetchExchangeRates();
    }, 24 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const convertPrice = (usdPrice: number): number => {
    const rate = exchangeRates[selectedCurrency];
    return usdPrice * rate;
  };

  const getCurrencySymbol = (): string => {
    return CURRENCY_SYMBOLS[selectedCurrency];
  };

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        setSelectedCurrency,
        convertPrice,
        getCurrencySymbol,
        lastUpdated,
        isLoading,
        refreshRates
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}