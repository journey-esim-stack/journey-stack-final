import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Globe } from 'lucide-react';
import { getCountryFlag } from '@/utils/countryFlags';

interface RegionalPlanDropdownProps {
  planTitle: string;
  countryCode: string;
}

// Define regional coverage based on plan patterns
const getRegionalCoverage = (planTitle: string, countryCode: string): { name: string; code: string; flag: string }[] => {
  const title = planTitle.toLowerCase();
  
  // Extract area count from title (e.g., "20 areas", "12 areas", "7 areas")
  const areaMatch = planTitle.match(/(\d+)\s+areas?/i);
  const areaCount = areaMatch ? parseInt(areaMatch[1]) : 0;
  
  // Full list of Asian countries
  const asianCountries = [
    { name: 'Singapore', code: 'SG', flag: '🇸🇬' },
    { name: 'Thailand', code: 'TH', flag: '🇹🇭' },
    { name: 'Malaysia', code: 'MY', flag: '🇲🇾' },
    { name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
    { name: 'Philippines', code: 'PH', flag: '🇵🇭' },
    { name: 'Cambodia', code: 'KH', flag: '🇰🇭' },
    { name: 'Vietnam', code: 'VN', flag: '🇻🇳' },
    { name: 'Myanmar', code: 'MM', flag: '🇲🇲' },
    { name: 'Laos', code: 'LA', flag: '🇱🇦' },
    { name: 'Brunei', code: 'BN', flag: '🇧🇳' },
    { name: 'Japan', code: 'JP', flag: '🇯🇵' },
    { name: 'South Korea', code: 'KR', flag: '🇰🇷' },
    { name: 'Hong Kong', code: 'HK', flag: '🇭🇰' },
    { name: 'Macau', code: 'MO', flag: '🇲🇴' },
    { name: 'Taiwan', code: 'TW', flag: '🇹🇼' },
    { name: 'India', code: 'IN', flag: '🇮🇳' },
    { name: 'Sri Lanka', code: 'LK', flag: '🇱🇰' },
    { name: 'Bangladesh', code: 'BD', flag: '🇧🇩' },
    { name: 'Nepal', code: 'NP', flag: '🇳🇵' },
    { name: 'Pakistan', code: 'PK', flag: '🇵🇰' }
  ];
  
  // Full list of European countries
  const europeanCountries = [
    { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
    { name: 'Germany', code: 'DE', flag: '🇩🇪' },
    { name: 'France', code: 'FR', flag: '🇫🇷' },
    { name: 'Italy', code: 'IT', flag: '🇮🇹' },
    { name: 'Spain', code: 'ES', flag: '🇪🇸' },
    { name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
    { name: 'Belgium', code: 'BE', flag: '🇧🇪' },
    { name: 'Austria', code: 'AT', flag: '🇦🇹' },
    { name: 'Switzerland', code: 'CH', flag: '🇨🇭' },
    { name: 'Poland', code: 'PL', flag: '🇵🇱' },
    { name: 'Czech Republic', code: 'CZ', flag: '🇨🇿' },
    { name: 'Portugal', code: 'PT', flag: '🇵🇹' },
    { name: 'Greece', code: 'GR', flag: '🇬🇷' },
    { name: 'Denmark', code: 'DK', flag: '🇩🇰' },
    { name: 'Sweden', code: 'SE', flag: '🇸🇪' },
    { name: 'Norway', code: 'NO', flag: '🇳🇴' },
    { name: 'Finland', code: 'FI', flag: '🇫🇮' },
    { name: 'Ireland', code: 'IE', flag: '🇮🇪' }
  ];
  
  // Asia regional plans - return the exact number of countries based on area count
  if (countryCode === 'RG' && (title.includes('asia') || title.includes('areas'))) {
    if (areaCount > 0 && areaCount <= asianCountries.length) {
      return asianCountries.slice(0, areaCount);
    }
    return asianCountries;
  }
  
  // Europe regional plans - return the exact number of countries based on area count
  if (countryCode === 'RG' && title.includes('europe')) {
    if (areaCount > 0 && areaCount <= europeanCountries.length) {
      return europeanCountries.slice(0, areaCount);
    }
    return europeanCountries;
  }
  
  // Default fallback for other regional plans
  return [];
};

export default function RegionalPlanDropdown({ planTitle, countryCode }: RegionalPlanDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const countries = getRegionalCoverage(planTitle, countryCode);
  
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