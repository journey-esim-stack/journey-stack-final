// Country display name to database name mapping
export const countryDisplayMapping: Record<string, string> = {
  "UAE (Dubai)": "United Arab Emirates",
  "UAE": "United Arab Emirates",
  "Dubai": "United Arab Emirates",
  "USA": "United States",
  "UK": "United Kingdom",
  "South Korea": "Korea (South)",
  "North Korea": "Korea (North)",
  "Czech Republic": "Czech Republic",
  "Dominican Republic": "Dominican Republic",
  "Central African Republic": "Central African Republic",
  "Congo (DRC)": "Congo (Democratic Republic)",
  "Bosnia": "Bosnia and Herzegovina",
  "St. Kitts and Nevis": "Saint Kitts and Nevis",
  "St. Lucia": "Saint Lucia",
  "St. Vincent": "Saint Vincent and the Grenadines",
  "São Tomé": "Sao Tome and Principe",
};

// Reverse mapping for search suggestions
export const createSearchSynonyms = () => {
  const synonyms: Record<string, string[]> = {};
  
  // Add main mappings
  Object.entries(countryDisplayMapping).forEach(([display, actual]) => {
    if (!synonyms[actual]) {
      synonyms[actual] = [];
    }
    synonyms[actual].push(display);
  });

  // Add common variations
  synonyms["United Arab Emirates"] = ["UAE", "Dubai", "UAE (Dubai)", "Emirates"];
  synonyms["United States"] = ["USA", "US", "America"];
  synonyms["United Kingdom"] = ["UK", "Britain", "England"];
  synonyms["Korea (South)"] = ["South Korea", "S. Korea"];
  synonyms["Korea (North)"] = ["North Korea", "N. Korea"];
  
  return synonyms;
};

// Function to resolve display name to database name
export const resolveCountryName = (displayName: string): string => {
  return countryDisplayMapping[displayName] || displayName;
};

// Function to get all possible names for a country
export const getCountryVariations = (countryName: string): string[] => {
  const synonyms = createSearchSynonyms();
  const variations = [countryName];
  
  // Add synonyms if available
  if (synonyms[countryName]) {
    variations.push(...synonyms[countryName]);
  }
  
  // Check if this is a synonym pointing to another country
  const actualCountry = resolveCountryName(countryName);
  if (actualCountry !== countryName) {
    variations.push(actualCountry);
    if (synonyms[actualCountry]) {
      variations.push(...synonyms[actualCountry]);
    }
  }
  
  return [...new Set(variations)]; // Remove duplicates
};