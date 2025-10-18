import { useEffect, useState } from 'react';
import { useInstantSearch, useSearchBox } from 'react-instantsearch';
import { resolveCountryName, getCountryVariations } from '@/utils/countryMapping';

/**
 * Country-aware search component that detects country tokens in the query
 * and applies appropriate facet filters for accurate country-specific results.
 */
export const CountryAwareSearch = () => {
  const { query } = useSearchBox();
  const { setUiState, indexUiState } = useInstantSearch();
  const [detectedCountries, setDetectedCountries] = useState<string[]>([]);

  useEffect(() => {
    if (!query || query.length < 3) {
      // Clear country filters if query is too short
      if (indexUiState.refinementList?.country_name) {
        setUiState((prevState: any) => ({
          ...prevState,
          refinementList: {
            ...prevState.refinementList,
            country_name: undefined,
          },
        }));
        setDetectedCountries([]);
      }
      return;
    }

    // Normalize query for matching
    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = normalizedQuery.split(/\s+/);
    
    // Try to detect countries from the query
    const foundCountries = new Set<string>();
    
    // Check each word and multi-word combinations
    for (let i = 0; i < queryWords.length; i++) {
      // Single word check
      const word = queryWords[i];
      const variations = getCountryVariations(word);
      
      if (variations.length > 0) {
        // Found a country match - resolve to canonical name
        const canonicalName = resolveCountryName(word);
        foundCountries.add(canonicalName);
      }
      
      // Two-word check (e.g., "United States", "South Korea")
      if (i < queryWords.length - 1) {
        const twoWords = `${queryWords[i]} ${queryWords[i + 1]}`;
        const twoWordVariations = getCountryVariations(twoWords);
        
        if (twoWordVariations.length > 0) {
          const canonicalName = resolveCountryName(twoWords);
          foundCountries.add(canonicalName);
        }
      }
    }

    const countriesArray = Array.from(foundCountries);

    // Only apply facet filters if we detected countries
    if (countriesArray.length > 0) {
      console.log('[CountryAwareSearch] Detected countries:', countriesArray, 'from query:', query);
      
      setDetectedCountries(countriesArray);
      
      // Apply facet filters to the search
      setUiState((prevState: any) => ({
        ...prevState,
        refinementList: {
          ...prevState.refinementList,
          country_name: countriesArray,
        },
      }));
    } else if (detectedCountries.length > 0) {
      // Clear previously detected countries if none are found now
      setDetectedCountries([]);
      setUiState((prevState: any) => ({
        ...prevState,
        refinementList: {
          ...prevState.refinementList,
          country_name: undefined,
        },
      }));
    }
  }, [query, setUiState]);

  // This component doesn't render anything - it just manages search state
  return null;
};
