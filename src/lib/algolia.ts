// Safe import for algoliasearch across ESM/CJS builds
import * as Algolia from 'algoliasearch/lite';

// Handle both default and namespace exports
const algoliasearchFn = (Algolia as any).default ?? (Algolia as any);

const searchClient = algoliasearchFn(
  'ESBNX49O6L',
  '6c52d8076ece4d9fc3c2e36f11240d9c'
);

export { searchClient };