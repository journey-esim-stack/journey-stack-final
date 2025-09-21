import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { supabase } from "@/integrations/supabase/client";

// Dynamic Algolia client configuration
let cachedClient: any = null;
let credentialsValidUntilMs: number = 0;

export const ESIM_PLANS_INDEX = 'esim_plans';

// Get or refresh Algolia credentials
const getAlgoliaCredentials = async () => {
  const now = Date.now();
  
  if (cachedClient && credentialsValidUntilMs > now + 300000) {
    return cachedClient;
  }

  try {
    const { data: creds, error } = await supabase.functions.invoke('get-algolia-credentials');
    
    if (error || !creds?.appId || !creds?.apiKey) {
      throw new Error(`Failed to load Algolia credentials: ${error?.message || 'No credentials returned'}`);
    }

    const client = algoliasearch(creds.appId, creds.apiKey);
    
    // Cache the client and update validity timestamp (convert seconds to ms)
    cachedClient = client;
    credentialsValidUntilMs = creds.validUntil ? creds.validUntil * 1000 : (now + 21600000);
    
    console.log('Algolia credentials refreshed, valid until:', new Date(credentialsValidUntilMs));
    return client;
    
  } catch (error) {
    console.error('Failed to get Algolia credentials:', error);
    throw error;
  }
};

// Export dynamic search client
export const getSearchClient = getAlgoliaCredentials;

// For backward compatibility, export a default client getter
export const searchClient = {
  search: async (requests: any) => {
    const client = await getAlgoliaCredentials();
    return client.search(requests);
  }
};