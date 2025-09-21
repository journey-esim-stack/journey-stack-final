import { liteClient as algoliasearch } from 'algoliasearch/lite';

// Initialize Algolia client with environment variables
const searchClient = algoliasearch(
  'ALGOLIA_APPLICATION_ID', // This should be replaced with actual app ID from secrets
  'ALGOLIA_SEARCH_KEY' // This should be the search-only API key (publishable)
);

// Index configuration
export const ESIM_PLANS_INDEX = 'esim_plans';

export { searchClient };