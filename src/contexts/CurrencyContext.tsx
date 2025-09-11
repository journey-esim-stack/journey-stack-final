import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Currency = 'USD' | 'INR' | 'AUD' | 'EUR';

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
  convertPrice: (usdPrice: number) => number;
  getCurrencySymbol: () => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Exchange rates (in production, these should come from an API)
const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  INR: 84.50,
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

  const convertPrice = (usdPrice: number): number => {
    const rate = EXCHANGE_RATES[selectedCurrency];
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
        getCurrencySymbol
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