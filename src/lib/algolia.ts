import { liteClient as algoliasearch } from 'algoliasearch/lite';

// Initialize Algolia client with actual credentials from secrets
const searchClient = algoliasearch(
  '7EHTXDSQKE', // Algolia Application ID
  '4f4b69b5e4f54c3f8c5f1e8d9c2a7b3e' // Algolia Search API Key (this should be the search-only key)
);

// Index configuration
export const ESIM_PLANS_INDEX = 'esim_plans';

export { searchClient };