import Layout from "@/components/Layout";
import AlgoliaSearch from "@/components/AlgoliaSearch";

export default function Plans() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            eSIM Plans
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Search and browse thousands of eSIM plans with instant results and smart filtering
          </p>
        </div>

        {/* Algolia Search Component */}
        <AlgoliaSearch />
      </div>
    </Layout>
  );
}