// Country code to flag emoji mapping
export const getCountryFlag = (countryCode: string): string => {
  const flagMap: Record<string, string> = {
    'SG': '🇸🇬', // Singapore
    'MY': '🇲🇾', // Malaysia
    'TH': '🇹🇭', // Thailand
    'ID': '🇮🇩', // Indonesia
    'PH': '🇵🇭', // Philippines
    'VN': '🇻🇳', // Vietnam
    'JP': '🇯🇵', // Japan
    'KR': '🇰🇷', // South Korea
    'CN': '🇨🇳', // China
    'HK': '🇭🇰', // Hong Kong
    'TW': '🇹🇼', // Taiwan
    'IN': '🇮🇳', // India
    'US': '🇺🇸', // United States
    'CA': '🇨🇦', // Canada
    'GB': '🇬🇧', // United Kingdom
    'DE': '🇩🇪', // Germany
    'FR': '🇫🇷', // France
    'IT': '🇮🇹', // Italy
    'ES': '🇪🇸', // Spain
    'AU': '🇦🇺', // Australia
    'NZ': '🇳🇿', // New Zealand
    'BR': '🇧🇷', // Brazil
    'MX': '🇲🇽', // Mexico
    'AE': '🇦🇪', // United Arab Emirates
    'SA': '🇸🇦', // Saudi Arabia
    'TR': '🇹🇷', // Turkey
    'EG': '🇪🇬', // Egypt
    'ZA': '🇿🇦', // South Africa
    'NG': '🇳🇬', // Nigeria
    'KE': '🇰🇪', // Kenya
    'IL': '🇮🇱', // Israel
    'RU': '🇷🇺', // Russia
    'UA': '🇺🇦', // Ukraine
    'PL': '🇵🇱', // Poland
    'CZ': '🇨🇿', // Czech Republic
    'AT': '🇦🇹', // Austria
    'CH': '🇨🇭', // Switzerland
    'NL': '🇳🇱', // Netherlands
    'BE': '🇧🇪', // Belgium
    'DK': '🇩🇰', // Denmark
    'SE': '🇸🇪', // Sweden
    'NO': '🇳🇴', // Norway
    'FI': '🇫🇮', // Finland
    'IE': '🇮🇪', // Ireland
    'PT': '🇵🇹', // Portugal
    'GR': '🇬🇷', // Greece
    'HR': '🇭🇷', // Croatia
    'HU': '🇭🇺', // Hungary
    'RO': '🇷🇴', // Romania
    'BG': '🇧🇬', // Bulgaria
    'LT': '🇱🇹', // Lithuania
    'LV': '🇱🇻', // Latvia
    'EE': '🇪🇪', // Estonia
    'SI': '🇸🇮', // Slovenia
    'SK': '🇸🇰', // Slovakia
    'LU': '🇱🇺', // Luxembourg
    'MT': '🇲🇹', // Malta
    'CY': '🇨🇾', // Cyprus
  };

  return flagMap[countryCode.toUpperCase()] || '🌍';
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