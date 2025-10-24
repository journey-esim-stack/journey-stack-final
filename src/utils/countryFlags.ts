// Country code validation - used to check if a country code is valid
// No longer returns emoji flags - use FlagIcon component instead
export const isValidCountryCode = (countryCode: string): boolean => {
  const validCodes = [
    'AF', 'SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'JP', 'KR', 'CN', 'HK', 'TW',
    'IN', 'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'AU', 'NZ', 'BR', 'MX',
    'AE', 'SA', 'TR', 'EG', 'ZA', 'NG', 'KE', 'IL', 'RU', 'UA', 'PL', 'CZ',
    'AT', 'CH', 'NL', 'BE', 'DK', 'SE', 'NO', 'FI', 'IE', 'PT', 'GR', 'HR',
    'HU', 'RO', 'BG', 'LT', 'LV', 'EE', 'SI', 'SK', 'LU', 'MT', 'CY', 'BD',
    'PK', 'LK', 'NP', 'MM', 'KH', 'LA', 'BN', 'MN', 'KZ', 'UZ', 'TM', 'KG', 'TJ',
    'AL', 'BY', 'BA', 'IS', 'LI', 'MD', 'MC', 'ME', 'MK', 'RS',
    'AM', 'AZ', 'BH', 'GE', 'IR', 'IQ', 'JO', 'KW', 'LB', 'MA', 'OM', 'QA', 'TN',
    'AR', 'BO', 'CL', 'CO', 'CR', 'DO', 'EC', 'SV', 'GT', 'HN', 'NI', 'PA', 'PY', 'PE', 'UY', 'VE',
    'DZ', 'AO', 'BW', 'CM', 'ET', 'GH', 'LY', 'RW', 'SN', 'TZ', 'UG', 'ZM',
    'FJ', 'PG', 'WS', 'TO', 'VU', 'MO'
  ];
  
  return validCodes.includes(countryCode.toUpperCase());
};

// Legacy function for backward compatibility - now returns empty string
// Use FlagIcon component instead for rendering flags
export const getCountryFlag = (countryCode: string): string => {
  console.warn('getCountryFlag() is deprecated. Use <FlagIcon /> component instead.');
  return '';
};

// Regional groupings for filtering
export const getRegion = (countryCode: string): string => {
  const regionMap: Record<string, string> = {
    // Southeast Asia
    'SG': 'Southeast Asia',
    'MY': 'Southeast Asia', 
    'TH': 'Southeast Asia',
    'ID': 'Southeast Asia',
    'PH': 'Southeast Asia',
    'VN': 'Southeast Asia',
    
    // East Asia
    'JP': 'East Asia',
    'KR': 'East Asia',
    'CN': 'East Asia',
    'HK': 'East Asia',
    'TW': 'East Asia',
    
    // South Asia
    'IN': 'South Asia',
    
    // North America
    'US': 'North America',
    'CA': 'North America',
    'MX': 'North America',
    
    // Europe
    'GB': 'Europe',
    'DE': 'Europe',
    'FR': 'Europe',
    'IT': 'Europe',
    'ES': 'Europe',
    'NL': 'Europe',
    'BE': 'Europe',
    'AT': 'Europe',
    'CH': 'Europe',
    'DK': 'Europe',
    'SE': 'Europe',
    'NO': 'Europe',
    'FI': 'Europe',
    'IE': 'Europe',
    'PT': 'Europe',
    'GR': 'Europe',
    'HR': 'Europe',
    'HU': 'Europe',
    'RO': 'Europe',
    'BG': 'Europe',
    'LT': 'Europe',
    'LV': 'Europe',
    'EE': 'Europe',
    'SI': 'Europe',
    'SK': 'Europe',
    'LU': 'Europe',
    'MT': 'Europe',
    'CY': 'Europe',
    'PL': 'Europe',
    'CZ': 'Europe',
    'RU': 'Europe',
    'UA': 'Europe',
    'TR': 'Europe',
    
    // Oceania
    'AU': 'Oceania',
    'NZ': 'Oceania',
    
    // South America
    'BR': 'South America',
    
    // Middle East & Africa
    'AE': 'Middle East & Africa',
    'SA': 'Middle East & Africa',
    'EG': 'Middle East & Africa',
    'ZA': 'Middle East & Africa',
    'NG': 'Middle East & Africa',
    'KE': 'Middle East & Africa',
    'IL': 'Middle East & Africa',
  };

  return regionMap[countryCode.toUpperCase()] || 'Other';
};

export const getAllRegions = (): string[] => {
  return Array.from(new Set(Object.values({
    'SG': 'Southeast Asia',
    'JP': 'East Asia',
    'IN': 'South Asia',
    'US': 'North America',
    'GB': 'Europe',
    'AU': 'Oceania',
    'BR': 'South America',
    'AE': 'Middle East & Africa',
  })));
};