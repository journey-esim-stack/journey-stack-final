// Standardized regional types
export type StandardRegion = 'APAC' | 'Europe' | 'Middle East' | 'North America' | 'Latin America' | 'Africa' | 'Oceania' | 'Global';

export interface Country {
  name: string;
  code: string;
}

// Regional country definitions - no longer includes flag emojis
// Use FlagIcon component to render flags from country codes
export const regionalCountries: Record<StandardRegion, Country[]> = {
  'APAC': [
    { name: 'Australia', code: 'AU' },
    { name: 'Bangladesh', code: 'BD' },
    { name: 'Brunei', code: 'BN' },
    { name: 'Cambodia', code: 'KH' },
    { name: 'China', code: 'CN' },
    { name: 'Hong Kong', code: 'HK' },
    { name: 'India', code: 'IN' },
    { name: 'Indonesia', code: 'ID' },
    { name: 'Japan', code: 'JP' },
    { name: 'Laos', code: 'LA' },
    { name: 'Macau', code: 'MO' },
    { name: 'Malaysia', code: 'MY' },
    { name: 'Myanmar', code: 'MM' },
    { name: 'Nepal', code: 'NP' },
    { name: 'New Zealand', code: 'NZ' },
    { name: 'Pakistan', code: 'PK' },
    { name: 'Philippines', code: 'PH' },
    { name: 'Singapore', code: 'SG' },
    { name: 'South Korea', code: 'KR' },
    { name: 'Sri Lanka', code: 'LK' },
    { name: 'Taiwan', code: 'TW' },
    { name: 'Thailand', code: 'TH' },
    { name: 'Vietnam', code: 'VN' }
  ],
  'Europe': [
    { name: 'Albania', code: 'AL' },
    { name: 'Austria', code: 'AT' },
    { name: 'Belarus', code: 'BY' },
    { name: 'Belgium', code: 'BE' },
    { name: 'Bosnia and Herzegovina', code: 'BA' },
    { name: 'Bulgaria', code: 'BG' },
    { name: 'Croatia', code: 'HR' },
    { name: 'Cyprus', code: 'CY' },
    { name: 'Czech Republic', code: 'CZ' },
    { name: 'Denmark', code: 'DK' },
    { name: 'Estonia', code: 'EE' },
    { name: 'Finland', code: 'FI' },
    { name: 'France', code: 'FR' },
    { name: 'Germany', code: 'DE' },
    { name: 'Greece', code: 'GR' },
    { name: 'Hungary', code: 'HU' },
    { name: 'Iceland', code: 'IS' },
    { name: 'Ireland', code: 'IE' },
    { name: 'Italy', code: 'IT' },
    { name: 'Latvia', code: 'LV' },
    { name: 'Liechtenstein', code: 'LI' },
    { name: 'Lithuania', code: 'LT' },
    { name: 'Luxembourg', code: 'LU' },
    { name: 'Malta', code: 'MT' },
    { name: 'Moldova', code: 'MD' },
    { name: 'Monaco', code: 'MC' },
    { name: 'Montenegro', code: 'ME' },
    { name: 'Netherlands', code: 'NL' },
    { name: 'North Macedonia', code: 'MK' },
    { name: 'Norway', code: 'NO' },
    { name: 'Poland', code: 'PL' },
    { name: 'Portugal', code: 'PT' },
    { name: 'Romania', code: 'RO' },
    { name: 'Serbia', code: 'RS' },
    { name: 'Slovakia', code: 'SK' },
    { name: 'Slovenia', code: 'SI' },
    { name: 'Spain', code: 'ES' },
    { name: 'Sweden', code: 'SE' },
    { name: 'Switzerland', code: 'CH' },
    { name: 'Ukraine', code: 'UA' },
    { name: 'United Kingdom', code: 'GB' }
  ],
  'Middle East': [
    { name: 'Armenia', code: 'AM' },
    { name: 'Azerbaijan', code: 'AZ' },
    { name: 'Bahrain', code: 'BH' },
    { name: 'Egypt', code: 'EG' },
    { name: 'Georgia', code: 'GE' },
    { name: 'Iran', code: 'IR' },
    { name: 'Iraq', code: 'IQ' },
    { name: 'Israel', code: 'IL' },
    { name: 'Jordan', code: 'JO' },
    { name: 'Kuwait', code: 'KW' },
    { name: 'Lebanon', code: 'LB' },
    { name: 'Morocco', code: 'MA' },
    { name: 'Oman', code: 'OM' },
    { name: 'Qatar', code: 'QA' },
    { name: 'Saudi Arabia', code: 'SA' },
    { name: 'Tunisia', code: 'TN' },
    { name: 'Turkey', code: 'TR' },
    { name: 'United Arab Emirates', code: 'AE' }
  ],
  'North America': [
    { name: 'Canada', code: 'CA' },
    { name: 'Mexico', code: 'MX' },
    { name: 'United States', code: 'US' }
  ],
  'Latin America': [
    { name: 'Argentina', code: 'AR' },
    { name: 'Bolivia', code: 'BO' },
    { name: 'Brazil', code: 'BR' },
    { name: 'Chile', code: 'CL' },
    { name: 'Colombia', code: 'CO' },
    { name: 'Costa Rica', code: 'CR' },
    { name: 'Dominican Republic', code: 'DO' },
    { name: 'Ecuador', code: 'EC' },
    { name: 'El Salvador', code: 'SV' },
    { name: 'Guatemala', code: 'GT' },
    { name: 'Honduras', code: 'HN' },
    { name: 'Nicaragua', code: 'NI' },
    { name: 'Panama', code: 'PA' },
    { name: 'Paraguay', code: 'PY' },
    { name: 'Peru', code: 'PE' },
    { name: 'Uruguay', code: 'UY' },
    { name: 'Venezuela', code: 'VE' }
  ],
  'Africa': [
    { name: 'Algeria', code: 'DZ' },
    { name: 'Angola', code: 'AO' },
    { name: 'Botswana', code: 'BW' },
    { name: 'Cameroon', code: 'CM' },
    { name: 'Ethiopia', code: 'ET' },
    { name: 'Ghana', code: 'GH' },
    { name: 'Kenya', code: 'KE' },
    { name: 'Libya', code: 'LY' },
    { name: 'Nigeria', code: 'NG' },
    { name: 'Rwanda', code: 'RW' },
    { name: 'Senegal', code: 'SN' },
    { name: 'South Africa', code: 'ZA' },
    { name: 'Tanzania', code: 'TZ' },
    { name: 'Uganda', code: 'UG' },
    { name: 'Zambia', code: 'ZM' }
  ],
  'Oceania': [
    { name: 'Australia', code: 'AU' },
    { name: 'Fiji', code: 'FJ' },
    { name: 'New Zealand', code: 'NZ' },
    { name: 'Papua New Guinea', code: 'PG' },
    { name: 'Samoa', code: 'WS' },
    { name: 'Tonga', code: 'TO' },
    { name: 'Vanuatu', code: 'VU' }
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
  if (supplierName === 'maya') {
    // For Maya plans, use specific country counts based on plan title
    const title = planTitle.toLowerCase();
    
    if (title.includes('europe+')) {
      // Maya Europe+ plans cover 35 specific European countries
      const europeCountries = regionalCountries['Europe'];
      return europeCountries.slice(0, 35);
    }
    
    if (title.includes('asia+')) {
      // Maya Asia+ plans cover 13 specific APAC countries
      const apacCountries = regionalCountries['APAC'];
      return apacCountries.slice(0, 13);
    }
    
    if (title.includes('mena+')) {
      // Maya MENA+ plans cover 18 Middle East countries
      const menaCountries = regionalCountries['Middle East'];
      return menaCountries.slice(0, 18);
    }
    
    if (title.includes('latam+')) {
      // Maya LATAM+ plans cover 17 Latin America countries
      const latamCountries = regionalCountries['Latin America'];
      return latamCountries.slice(0, 17);
    }
    
    // Fallback: try to extract specific countries from description
    if (description) {
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