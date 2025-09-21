import Layout from "@/components/Layout";
import AlgoliaSearch from "@/components/AlgoliaSearch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Zap, Filter } from "lucide-react";
import { Link } from "react-router-dom";

export default function AlgoliaPlans() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <Link to="/plans">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Plans
              </Button>
            </Link>
          </div>
          
          <h1 className="text-4xl font-bold mb-4 text-center">
            Smart eSIM Search
          </h1>
          <p className="text-muted-foreground text-lg text-center max-w-2xl mx-auto">
            Search thousands of eSIM plans with instant results and smart filtering
          </p>
        </div>

        {/* Search Component */}
        <AlgoliaSearch />
      </div>
    </Layout>
  );
}