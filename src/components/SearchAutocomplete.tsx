import React, { useState, useEffect, useMemo } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Search, Globe, MapPin, Clock, Database } from "lucide-react";
import { countries } from "@/utils/countries";
import { resolveCountryName, getCountryVariations } from "@/utils/countryMapping";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  recentSearches?: string[];
  popularDestinations?: string[];
}

interface Suggestion {
  type: 'country' | 'destination' | 'recent' | 'data';
  value: string;
  display: string;
  icon: React.ReactNode;
  category?: string;
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "Search countries, destinations, or data plans...",
  recentSearches = [],
  popularDestinations = ["Europe", "Asia", "North America", "Middle East", "Africa"]
}) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const debouncedValue = useDebouncedValue(inputValue, 150);

  // Data plan suggestions
  const dataPlanSuggestions = [
    "1GB", "3GB", "5GB", "10GB", "20GB", "Unlimited",
    "Daily plans", "Weekly plans", "Monthly plans"
  ];

  // Update parent when debounced value changes
  useEffect(() => {
    onChange(debouncedValue);
  }, [debouncedValue, onChange]);

  // Generate suggestions based on input
  const suggestions = useMemo(() => {
    if (!inputValue.trim()) {
      // Show recent searches and popular destinations when empty
      const suggestions: Suggestion[] = [];
      
      if (recentSearches.length > 0) {
        suggestions.push(...recentSearches.slice(0, 3).map(search => ({
          type: 'recent' as const,
          value: search,
          display: search,
          icon: <Clock className="h-4 w-4" />,
          category: "Recent Searches"
        })));
      }
      
      suggestions.push(...popularDestinations.map(dest => ({
        type: 'destination' as const,
        value: dest,
        display: dest,
        icon: <MapPin className="h-4 w-4" />,
        category: "Popular Destinations"
      })));
      
      return suggestions;
    }

    const query = inputValue.toLowerCase();
    const suggestions: Suggestion[] = [];

    // Country suggestions with fuzzy matching
    const matchingCountries = countries.filter(country => {
      const variations = getCountryVariations(country);
      return variations.some(variation => 
        variation.toLowerCase().includes(query) ||
        // Fuzzy matching for typos
        query.length > 2 && variation.toLowerCase().includes(query.slice(0, -1))
      );
    }).slice(0, 8);

    suggestions.push(...matchingCountries.map(country => ({
      type: 'country' as const,
      value: country,
      display: country,
      icon: <Globe className="h-4 w-4" />,
      category: "Countries"
    })));

    // Destination suggestions
    const matchingDestinations = popularDestinations.filter(dest =>
      dest.toLowerCase().includes(query)
    ).slice(0, 4);

    suggestions.push(...matchingDestinations.map(dest => ({
      type: 'destination' as const,
      value: dest,
      display: dest,
      icon: <MapPin className="h-4 w-4" />,
      category: "Regions"
    })));

    // Data plan suggestions
    const matchingDataPlans = dataPlanSuggestions.filter(plan =>
      plan.toLowerCase().includes(query)
    ).slice(0, 4);

    suggestions.push(...matchingDataPlans.map(plan => ({
      type: 'data' as const,
      value: plan,
      display: plan,
      icon: <Database className="h-4 w-4" />,
      category: "Data Plans"
    })));

    return suggestions;
  }, [inputValue, recentSearches, popularDestinations]);

  // Group suggestions by category
  const groupedSuggestions = useMemo(() => {
    const groups: Record<string, Suggestion[]> = {};
    suggestions.forEach(suggestion => {
      const category = suggestion.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(suggestion);
    });
    return groups;
  }, [suggestions]);

  const handleSelect = (suggestion: Suggestion) => {
    const resolvedValue = suggestion.type === 'country' 
      ? resolveCountryName(suggestion.value) 
      : suggestion.value;
    
    setInputValue(suggestion.display);
    onChange(suggestion.display);
    onSearch(resolvedValue);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    if (!open) setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedValue = resolveCountryName(inputValue);
    onSearch(resolvedValue);
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <form onSubmit={handleSubmit}>
              <Command className="rounded-lg border shadow-sm">
                <CommandInput
                  placeholder={placeholder}
                  value={inputValue}
                  onValueChange={handleInputChange}
                  onFocus={() => setOpen(true)}
                  className="pl-10"
                />
              </Command>
            </form>
          </div>
        </PopoverTrigger>
        
        <PopoverContent 
          className="w-[--radix-popover-trigger-width] p-0 max-h-[400px] overflow-hidden"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <Command>
            <CommandList className="max-h-[350px]">
              {suggestions.length === 0 ? (
                <CommandEmpty>
                  <div className="flex flex-col items-center py-6 text-center">
                    <Search className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No results found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try searching for countries, regions, or data amounts
                    </p>
                  </div>
                </CommandEmpty>
              ) : (
                Object.entries(groupedSuggestions).map(([category, categoryItems]) => (
                  <CommandGroup key={category} heading={category}>
                    {categoryItems.map((suggestion) => (
                      <CommandItem
                        key={`${suggestion.type}-${suggestion.value}`}
                        value={suggestion.display}
                        onSelect={() => handleSelect(suggestion)}
                        className="flex items-center gap-2 cursor-pointer hover:bg-accent/50"
                      >
                        {suggestion.icon}
                        <span className="flex-1">{suggestion.display}</span>
                        {suggestion.type === 'country' && (
                          <span className="text-xs text-muted-foreground">Country</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};