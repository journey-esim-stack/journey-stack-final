import React from "react";
import AlgoliaPlansOptimized from "./AlgoliaPlansOptimized";
import AlgoliaPlansSimple from "./AlgoliaPlansSimple";
import { AlgoliaErrorBoundary } from "@/components/AlgoliaErrorBoundary";

// Entry point page that guarantees a working experience.
// It prefers the optimized Algolia experience but gracefully falls back
// to the simple version if anything throws at runtime.
export default function AlgoliaPlansEntry() {
  return (
    <AlgoliaErrorBoundary fallback={<AlgoliaPlansSimple />}> 
      <AlgoliaPlansOptimized />
    </AlgoliaErrorBoundary>
  );
}
