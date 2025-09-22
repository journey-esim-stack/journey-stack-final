// Regional plan mapping system for both Maya and eSIM Access suppliers
export type RegionType = 'APAC' | 'Europe' | 'Middle East' | 'North America' | 'Latin America' | 'Africa' | 'Oceania' | 'Global';

export interface RegionalPlan {
  region: RegionType;
  countries: string[];
  countryCount: number;
}

// Country definitions for each region
export const REGION_COUNTRIES: Record<RegionType, string[]> = {
  'APAC': [
    'China', 'Japan', 'South Korea', 'Taiwan', 'Hong Kong', 'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 
    'Philippines', 'Indonesia', 'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Cambodia', 'Laos', 'Myanmar'
  ],
  'Europe': [
    'United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Switzerland', 'Austria',
    'Portugal', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czech Republic', 'Hungary', 'Romania',
    'Bulgaria', 'Croatia', 'Greece', 'Ireland', 'Luxembourg', 'Slovenia', 'Slovakia', 'Estonia', 'Latvia', 'Lithuania'
  ],
  'Middle East': [
    'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Israel', 'Jordan', 'Lebanon', 'Turkey'
  ],
  'North America': [
    'United States', 'Canada', 'Mexico'
  ],
  'Latin America': [
    'Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia', 'Venezuela', 'Ecuador', 'Bolivia', 'Uruguay', 'Paraguay',
    'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Dominican Republic', 'Puerto Rico'
  ],
  'Africa': [
    'South Africa', 'Nigeria', 'Kenya', 'Ghana', 'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'Tanzania', 'Uganda',
    'Rwanda', 'Ethiopia', 'Botswana', 'Namibia', 'Zambia', 'Zimbabwe', 'Senegal', 'Ivory Coast', 'Cameroon'
  ],
  'Oceania': [
    'Australia', 'New Zealand', 'Fiji', 'Papua New Guinea', 'Samoa', 'Tonga', 'Vanuatu'
  ],
  'Global': []
};

// Detect regional plans and map to standardized regions
export const detectRegionalPlan = (plan: { country_name: string; title: string; supplier_name: string; country_code: string }): RegionalPlan | null => {
  const { country_name, title, supplier_name, country_code } = plan;
  
  // Handle Maya regional plans
  if (supplier_name === 'maya') {
    switch (country_name.toLowerCase()) {
      case 'apac region':
        return { region: 'APAC', countries: REGION_COUNTRIES.APAC, countryCount: REGION_COUNTRIES.APAC.length };
      case 'europe region':
        return { region: 'Europe', countries: REGION_COUNTRIES.Europe, countryCount: REGION_COUNTRIES.Europe.length };
      case 'mena region':
        return { region: 'Middle East', countries: REGION_COUNTRIES['Middle East'], countryCount: REGION_COUNTRIES['Middle East'].length };
      case 'latam region':
        return { region: 'Latin America', countries: REGION_COUNTRIES['Latin America'], countryCount: REGION_COUNTRIES['Latin America'].length };
      case 'global region':
        return { region: 'Global', countries: [], countryCount: 150 }; // Approximate global coverage
    }
  }
  
  // Handle eSIM Access regional plans
  if (supplier_name === 'esim_access' && country_code === 'RG') {
    const titleLower = title.toLowerCase();
    
    // Asia variants
    if (titleLower.includes('asia')) {
      const countries = titleLower.includes('20 areas') ? 
        [...REGION_COUNTRIES.APAC, ...REGION_COUNTRIES['Middle East']].slice(0, 20) :
        titleLower.includes('12 areas') ? REGION_COUNTRIES.APAC.slice(0, 12) :
        titleLower.includes('7 areas') ? REGION_COUNTRIES.APAC.slice(0, 7) :
        REGION_COUNTRIES.APAC;
      return { region: 'APAC', countries, countryCount: countries.length };
    }
    
    // Europe
    if (titleLower.includes('europe')) {
      return { region: 'Europe', countries: REGION_COUNTRIES.Europe, countryCount: REGION_COUNTRIES.Europe.length };
    }
    
    // Africa
    if (titleLower.includes('africa')) {
      return { region: 'Africa', countries: REGION_COUNTRIES.Africa, countryCount: REGION_COUNTRIES.Africa.length };
    }
    
    // Australia & New Zealand (Oceania)
    if (titleLower.includes('australia') && titleLower.includes('new zealand')) {
      return { region: 'Oceania', countries: ['Australia', 'New Zealand'], countryCount: 2 };
    }
    
    // Global/Worldwide
    if (titleLower.includes('global') || titleLower.includes('worldwide')) {
      return { region: 'Global', countries: [], countryCount: 150 };
    }
    
    // Middle East (if we have specific ME plans)
    if (titleLower.includes('middle east') || titleLower.includes('mena')) {
      return { region: 'Middle East', countries: REGION_COUNTRIES['Middle East'], countryCount: REGION_COUNTRIES['Middle East'].length };
    }
    
    // Latin America / Caribbean
    if (titleLower.includes('latin') || titleLower.includes('caribbean') || titleLower.includes('central america') || titleLower.includes('south america')) {
      return { region: 'Latin America', countries: REGION_COUNTRIES['Latin America'], countryCount: REGION_COUNTRIES['Latin America'].length };
    }
    
    // North America
    if (titleLower.includes('north america') || (titleLower.includes('usa') && titleLower.includes('canada'))) {
      return { region: 'North America', countries: REGION_COUNTRIES['North America'], countryCount: REGION_COUNTRIES['North America'].length };
    }
  }
  
  return null;
};

// Get all unique regions from plans
export const getAllRegionTypes = (): RegionType[] => {
  return ['APAC', 'Europe', 'Middle East', 'North America', 'Latin America', 'Africa', 'Oceania', 'Global'];
};

// Check if a plan matches a region filter
export const planMatchesRegion = (plan: { country_name: string; title: string; supplier_name: string; country_code: string }, regionFilter: RegionType): boolean => {
  const regionalPlan = detectRegionalPlan(plan);
  return regionalPlan?.region === regionFilter;
};

// Get region display name with country count
export const getRegionDisplayName = (region: RegionType, countryCount?: number): string => {
  const suffix = countryCount && countryCount > 0 ? ` (${countryCount} countries)` : '';
  return `${region}${suffix}`;
};