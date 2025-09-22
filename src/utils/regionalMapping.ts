import { getCountryFlag } from "@/utils/countryFlags";

// Standardized regional types
export type StandardRegion = 'APAC' | 'Europe' | 'Middle East' | 'North America' | 'Latin America' | 'Africa' | 'Oceania' | 'Global';

export interface Country {
  name: string;
  code: string;
  flag: string;
}

// Regional country definitions
export const regionalCountries: Record<StandardRegion, Country[]> = {
  'APAC': [
    { name: 'Australia', code: 'AU', flag: '🇦🇺' },
    { name: 'Bangladesh', code: 'BD', flag: '🇧🇩' },
    { name: 'Brunei', code: 'BN', flag: '🇧🇳' },
    { name: 'Cambodia', code: 'KH', flag: '🇰🇭' },
    { name: 'China', code: 'CN', flag: '🇨🇳' },
    { name: 'Hong Kong', code: 'HK', flag: '🇭🇰' },
    { name: 'India', code: 'IN', flag: '🇮🇳' },
    { name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
    { name: 'Japan', code: 'JP', flag: '🇯🇵' },
    { name: 'Laos', code: 'LA', flag: '🇱🇦' },
    { name: 'Macau', code: 'MO', flag: '🇲🇴' },
    { name: 'Malaysia', code: 'MY', flag: '🇲🇾' },
    { name: 'Myanmar', code: 'MM', flag: '🇲🇲' },
    { name: 'Nepal', code: 'NP', flag: '🇳🇵' },
    { name: 'New Zealand', code: 'NZ', flag: '🇳🇿' },
    { name: 'Pakistan', code: 'PK', flag: '🇵🇰' },
    { name: 'Philippines', code: 'PH', flag: '🇵🇭' },
    { name: 'Singapore', code: 'SG', flag: '🇸🇬' },
    { name: 'South Korea', code: 'KR', flag: '🇰🇷' },
    { name: 'Sri Lanka', code: 'LK', flag: '🇱🇰' },
    { name: 'Taiwan', code: 'TW', flag: '🇹🇼' },
    { name: 'Thailand', code: 'TH', flag: '🇹🇭' },
    { name: 'Vietnam', code: 'VN', flag: '🇻🇳' }
  ],
  'Europe': [
    { name: 'Albania', code: 'AL', flag: '🇦🇱' },
    { name: 'Austria', code: 'AT', flag: '🇦🇹' },
    { name: 'Belarus', code: 'BY', flag: '🇧🇾' },
    { name: 'Belgium', code: 'BE', flag: '🇧🇪' },
    { name: 'Bosnia and Herzegovina', code: 'BA', flag: '🇧🇦' },
    { name: 'Bulgaria', code: 'BG', flag: '🇧🇬' },
    { name: 'Croatia', code: 'HR', flag: '🇭🇷' },
    { name: 'Cyprus', code: 'CY', flag: '🇨🇾' },
    { name: 'Czech Republic', code: 'CZ', flag: '🇨🇿' },
    { name: 'Denmark', code: 'DK', flag: '🇩🇰' },
    { name: 'Estonia', code: 'EE', flag: '🇪🇪' },
    { name: 'Finland', code: 'FI', flag: '🇫🇮' },
    { name: 'France', code: 'FR', flag: '🇫🇷' },
    { name: 'Germany', code: 'DE', flag: '🇩🇪' },
    { name: 'Greece', code: 'GR', flag: '🇬🇷' },
    { name: 'Hungary', code: 'HU', flag: '🇭🇺' },
    { name: 'Iceland', code: 'IS', flag: '🇮🇸' },
    { name: 'Ireland', code: 'IE', flag: '🇮🇪' },
    { name: 'Italy', code: 'IT', flag: '🇮🇹' },
    { name: 'Latvia', code: 'LV', flag: '🇱🇻' },
    { name: 'Liechtenstein', code: 'LI', flag: '🇱🇮' },
    { name: 'Lithuania', code: 'LT', flag: '🇱🇹' },
    { name: 'Luxembourg', code: 'LU', flag: '🇱🇺' },
    { name: 'Malta', code: 'MT', flag: '🇲🇹' },
    { name: 'Moldova', code: 'MD', flag: '🇲🇩' },
    { name: 'Monaco', code: 'MC', flag: '🇲🇨' },
    { name: 'Montenegro', code: 'ME', flag: '🇲🇪' },
    { name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
    { name: 'North Macedonia', code: 'MK', flag: '🇲🇰' },
    { name: 'Norway', code: 'NO', flag: '🇳🇴' },
    { name: 'Poland', code: 'PL', flag: '🇵🇱' },
    { name: 'Portugal', code: 'PT', flag: '🇵🇹' },
    { name: 'Romania', code: 'RO', flag: '🇷🇴' },
    { name: 'Serbia', code: 'RS', flag: '🇷🇸' },
    { name: 'Slovakia', code: 'SK', flag: '🇸🇰' },
    { name: 'Slovenia', code: 'SI', flag: '🇸🇮' },
    { name: 'Spain', code: 'ES', flag: '🇪🇸' },
    { name: 'Sweden', code: 'SE', flag: '🇸🇪' },
    { name: 'Switzerland', code: 'CH', flag: '🇨🇭' },
    { name: 'Ukraine', code: 'UA', flag: '🇺🇦' },
    { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' }
  ],
  'Middle East': [
    { name: 'Armenia', code: 'AM', flag: '🇦🇲' },
    { name: 'Azerbaijan', code: 'AZ', flag: '🇦🇿' },
    { name: 'Bahrain', code: 'BH', flag: '🇧🇭' },
    { name: 'Egypt', code: 'EG', flag: '🇪🇬' },
    { name: 'Georgia', code: 'GE', flag: '🇬🇪' },
    { name: 'Iran', code: 'IR', flag: '🇮🇷' },
    { name: 'Iraq', code: 'IQ', flag: '🇮🇶' },
    { name: 'Israel', code: 'IL', flag: '🇮🇱' },
    { name: 'Jordan', code: 'JO', flag: '🇯🇴' },
    { name: 'Kuwait', code: 'KW', flag: '🇰🇼' },
    { name: 'Lebanon', code: 'LB', flag: '🇱🇧' },
    { name: 'Morocco', code: 'MA', flag: '🇲🇦' },
    { name: 'Oman', code: 'OM', flag: '🇴🇲' },
    { name: 'Qatar', code: 'QA', flag: '🇶🇦' },
    { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦' },
    { name: 'Tunisia', code: 'TN', flag: '🇹🇳' },
    { name: 'Turkey', code: 'TR', flag: '🇹🇷' },
    { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' }
  ],
  'North America': [
    { name: 'Canada', code: 'CA', flag: '🇨🇦' },
    { name: 'Mexico', code: 'MX', flag: '🇲🇽' },
    { name: 'United States', code: 'US', flag: '🇺🇸' }
  ],
  'Latin America': [
    { name: 'Argentina', code: 'AR', flag: '🇦🇷' },
    { name: 'Bolivia', code: 'BO', flag: '🇧🇴' },
    { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
    { name: 'Chile', code: 'CL', flag: '🇨🇱' },
    { name: 'Colombia', code: 'CO', flag: '🇨🇴' },
    { name: 'Costa Rica', code: 'CR', flag: '🇨🇷' },
    { name: 'Dominican Republic', code: 'DO', flag: '🇩🇴' },
    { name: 'Ecuador', code: 'EC', flag: '🇪🇨' },
    { name: 'El Salvador', code: 'SV', flag: '🇸🇻' },
    { name: 'Guatemala', code: 'GT', flag: '🇬🇹' },
    { name: 'Honduras', code: 'HN', flag: '🇭🇳' },
    { name: 'Nicaragua', code: 'NI', flag: '🇳🇮' },
    { name: 'Panama', code: 'PA', flag: '🇵🇦' },
    { name: 'Paraguay', code: 'PY', flag: '🇵🇾' },
    { name: 'Peru', code: 'PE', flag: '🇵🇪' },
    { name: 'Uruguay', code: 'UY', flag: '🇺🇾' },
    { name: 'Venezuela', code: 'VE', flag: '🇻🇪' }
  ],
  'Africa': [
    { name: 'Algeria', code: 'DZ', flag: '🇩🇿' },
    { name: 'Angola', code: 'AO', flag: '🇦🇴' },
    { name: 'Botswana', code: 'BW', flag: '🇧🇼' },
    { name: 'Cameroon', code: 'CM', flag: '🇨🇲' },
    { name: 'Ethiopia', code: 'ET', flag: '🇪🇹' },
    { name: 'Ghana', code: 'GH', flag: '🇬🇭' },
    { name: 'Kenya', code: 'KE', flag: '🇰🇪' },
    { name: 'Libya', code: 'LY', flag: '🇱🇾' },
    { name: 'Nigeria', code: 'NG', flag: '🇳🇬' },
    { name: 'Rwanda', code: 'RW', flag: '🇷🇼' },
    { name: 'Senegal', code: 'SN', flag: '🇸🇳' },
    { name: 'South Africa', code: 'ZA', flag: '🇿🇦' },
    { name: 'Tanzania', code: 'TZ', flag: '🇹🇿' },
    { name: 'Uganda', code: 'UG', flag: '🇺🇬' },
    { name: 'Zambia', code: 'ZM', flag: '🇿🇲' }
  ],
  'Oceania': [
    { name: 'Australia', code: 'AU', flag: '🇦🇺' },
    { name: 'Fiji', code: 'FJ', flag: '🇫🇯' },
    { name: 'New Zealand', code: 'NZ', flag: '🇳🇿' },
    { name: 'Papua New Guinea', code: 'PG', flag: '🇵🇬' },
    { name: 'Samoa', code: 'WS', flag: '🇼🇸' },
    { name: 'Tonga', code: 'TO', flag: '🇹🇴' },
    { name: 'Vanuatu', code: 'VU', flag: '🇻🇺' }
  ],
  'Global': []
};

// Maya supplier region mapping
const mayaRegionMapping: Record<string, StandardRegion[]> = {
  'apac region': ['APAC'],
  'asia+': ['APAC'],
  'europe region': ['Europe'],
  'europe+': ['Europe'],
  'mena region': ['Middle East'],
  'mena+': ['Middle East'],
  'latam region': ['Latin America'],
  'latam+': ['Latin America'],
  'global': ['Global']
};

// eSIM Access supplier region mapping
const esimAccessRegionMapping: Record<string, StandardRegion[]> = {
  'asia': ['APAC'],
  'asian': ['APAC'],
  'apac': ['APAC'],
  'pacific': ['APAC', 'Oceania'],
  'europe': ['Europe'],
  'european': ['Europe'],
  'middle east': ['Middle East'],
  'mena': ['Middle East'],
  'gulf': ['Middle East'],
  'africa': ['Africa'],
  'african': ['Africa'],
  'north america': ['North America'],
  'americas': ['North America', 'Latin America'],
  'south america': ['Latin America'],
  'latin america': ['Latin America'],
  'latam': ['Latin America'],
  'oceania': ['Oceania'],
  'global': ['Global'],
  'worldwide': ['Global']
};

/**
 * Detects which standardized regions a plan belongs to based on title and supplier
 */
export function detectPlanRegions(planTitle: string, supplierName: string = 'esim_access'): StandardRegion[] {
  const title = planTitle.toLowerCase();
  const regions: Set<StandardRegion> = new Set();

  if (supplierName === 'maya') {
    // Maya-specific mapping
    Object.entries(mayaRegionMapping).forEach(([keyword, mappedRegions]) => {
      if (title.includes(keyword)) {
        mappedRegions.forEach(region => regions.add(region));
      }
    });
  } else {
    // eSIM Access and other suppliers
    Object.entries(esimAccessRegionMapping).forEach(([keyword, mappedRegions]) => {
      if (title.includes(keyword)) {
        mappedRegions.forEach(region => regions.add(region));
      }
    });
  }

  return Array.from(regions);
}

/**
 * Gets countries for a regional plan based on detected regions
 */
export function getRegionalPlanCountries(planTitle: string, supplierName: string = 'esim_access', description?: string): Country[] {
  if (supplierName === 'maya' && description) {
    // For Maya plans, try to extract specific countries from description
    const countryCodeMatches = description.match(/\b[A-Z]{2,3}\b/g);
    if (countryCodeMatches) {
      const planCountries: Country[] = [];
      countryCodeMatches.forEach(code => {
        // Find matching country in our regional mapping
        Object.values(regionalCountries).flat().forEach(country => {
          if (country.code === code || country.code === code.substring(0, 2)) {
            if (!planCountries.find(c => c.code === country.code)) {
              planCountries.push(country);
            }
          }
        });
      });
      if (planCountries.length > 0) {
        return planCountries;
      }
    }
  } else if (supplierName === 'esim_access') {
    // For eSIM Access, parse area count from title
    const areaMatch = planTitle.match(/(\d+)\s+areas?/i);
    if (areaMatch) {
      const regions = detectPlanRegions(planTitle, supplierName);
      const areaCount = parseInt(areaMatch[1]);
      const countries: Set<Country> = new Set();

      regions.forEach(region => {
        regionalCountries[region].forEach(country => {
          if (!Array.from(countries).find(c => c.code === country.code)) {
            countries.add(country);
          }
        });
      });

      // Return only the specified number of areas
      return Array.from(countries).slice(0, areaCount);
    }
  }

  // Fallback: return all countries for detected regions
  const regions = detectPlanRegions(planTitle, supplierName);
  const countries: Set<Country> = new Set();

  regions.forEach(region => {
    regionalCountries[region].forEach(country => {
      if (!Array.from(countries).find(c => c.code === country.code)) {
        countries.add(country);
      }
    });
  });

  return Array.from(countries);
}

/**
 * Checks if a plan is a regional plan
 */
export function isRegionalPlan(countryCode: string): boolean {
  return countryCode === 'RG';
}

/**
 * Gets region labels for filtering
 */
export function getRegionFilterOptions(): Array<{value: string, label: string}> {
  return [
    { value: 'APAC', label: 'Asia-Pacific (APAC)' },
    { value: 'Europe', label: 'Europe' },
    { value: 'Middle East', label: 'Middle East' },
    { value: 'North America', label: 'North America' },
    { value: 'Latin America', label: 'Latin America' },
    { value: 'Africa', label: 'Africa' },
    { value: 'Oceania', label: 'Oceania' },
    { value: 'Global', label: 'Global' }
  ];
}

/**
 * Checks if a plan matches a regional filter
 */
export function planMatchesRegionalFilter(plan: any, regionFilter: string): boolean {
  if (!regionFilter) return true;
  if (!isRegionalPlan(plan.country_code)) return false;
  
  const planRegions = detectPlanRegions(plan.title, plan.supplier_name);
  return planRegions.includes(regionFilter as StandardRegion);
}