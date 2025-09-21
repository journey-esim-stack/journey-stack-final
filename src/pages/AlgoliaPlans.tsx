import Layout from "@/components/Layout";
import AlgoliaSearch from "@/components/AlgoliaSearch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Database } from "lucide-react";
import { Link } from "react-router-dom";

export default function AlgoliaPlans() {
  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="glass-intense p-8 text-left">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/plans">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Legacy Search
              </Button>
            </Link>
          </div>
          
          <h1 className="text-4xl font-bold mb-4 text-black">
            Smart eSIM Search (Powered by Algolia)
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Experience lightning-fast search with instant results, smart filtering, and typo tolerance. 
            Search across thousands of plans in milliseconds.
          </p>
          
          <div className="flex items-center justify-start gap-2 mt-4 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>1000+ plans searchable</span>
            <span>•</span>
            <Database className="h-4 w-4" />
            <span>Multiple suppliers</span>
            <span>•</span>
            <span className="font-medium text-primary">⚡ Instant results</span>
          </div>
        </div>

        {/* Algolia Search Component */}
        <AlgoliaSearch />
      </div>
    </Layout>
  );
}