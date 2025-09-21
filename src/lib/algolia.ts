import { liteClient as algoliasearch } from 'algoliasearch/lite';

const searchClient = algoliasearch(
  'ESBNX49O6L', // Your Application ID
  '6c52d8076ece4d9fc3c2e36f11240d9c' // Your Search-Only API Key
);

export { searchClient };