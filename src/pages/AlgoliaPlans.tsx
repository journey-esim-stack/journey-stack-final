import Layout from "@/components/Layout";
import AlgoliaSearch from "@/components/AlgoliaSearch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Zap, Filter } from "lucide-react";
import { Link } from "react-router-dom";

export default function AlgoliaPlans() {
  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="glass-intense p-8 text-left border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/plans">
              <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Plans
              </Button>
            </Link>
          </div>
          
          <div className="max-w-4xl">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Smart eSIM Search
            </h1>
            <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
              Experience lightning-fast search with instant results, smart filtering, and typo tolerance. 
              Find the perfect eSIM plan from thousands of options across the globe.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50 border border-border/50">
                <Search className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-sm">Smart Search</div>
                  <div className="text-xs text-muted-foreground">Typo-tolerant & instant</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50 border border-border/50">
                <Filter className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-sm">Advanced Filters</div>
                  <div className="text-xs text-muted-foreground">Country, data, price & more</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-background/50 border border-border/50">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-sm">1000+ Plans</div>
                  <div className="text-xs text-muted-foreground">Multiple suppliers</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Algolia Search Component */}
        <AlgoliaSearch />
      </div>
    </Layout>
  );
}