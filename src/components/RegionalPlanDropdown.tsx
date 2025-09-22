import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Globe } from 'lucide-react';
import { getRegionalPlanCountries, isRegionalPlan, type Country } from '@/utils/regionalMapping';

interface RegionalPlanDropdownProps {
  planTitle: string;
  countryCode: string;
  description?: string;
}

// Get regional coverage using the new mapping system
const getRegionalCoverage = (planTitle: string, countryCode: string, description?: string): Country[] => {
  // Return early if not a regional plan
  if (!isRegionalPlan(countryCode)) {
    return [];
  }

  // Use the new standardized regional mapping system
  return getRegionalPlanCountries(planTitle, 'esim_access', description);
};

export default function RegionalPlanDropdown({ planTitle, countryCode, description }: RegionalPlanDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const countries = getRegionalCoverage(planTitle, countryCode, description);
  
  // Extract area count from title (e.g., "20 areas")
  const areaMatch = planTitle.match(/(\d+)\s+areas?/i);
  const areaCount = areaMatch ? areaMatch[1] : countries.length.toString();
  
  if (countries.length === 0) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-1 px-2 text-muted-foreground hover:text-primary font-normal text-xs border border-border/50 rounded-md transition-colors"
        >
          <span>{areaCount} countries</span>
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 glass-intense border-0" align="start">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">Countries Covered</h4>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {countries.map((country) => (
              <div key={country.code} className="flex items-center gap-2 p-2 rounded-lg glass-subtle hover:glass-intense transition-all">
                <span className="text-lg">{country.flag}</span>
                <span className="text-xs font-medium truncate">{country.name}</span>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}