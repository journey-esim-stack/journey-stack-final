import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AgentPreviewProvider } from "@/contexts/AgentPreviewContext";
import AgentApprovalGuard from "@/components/AgentApprovalGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AuthConfirmed from "./pages/AuthConfirmed";
import EmailConfirm from "./pages/EmailConfirm";
import TestAuth from "./pages/TestAuth";
import Plans from "./pages/Plans";

import Wallet from "./pages/Wallet";
import Dashboard from "./pages/Dashboard";
import ESims from "./pages/ESims";
import ESimDetail from "./pages/ESimDetail";
import AdminAgents from "./pages/AdminAgents";
import AdminInventory from "./pages/AdminInventory";
import AdminSuppliers from "./pages/AdminSuppliers";
import SystemHealth from "./pages/SystemHealth";
import TopupSuccess from "./pages/TopupSuccess";
import TopupCanceled from "./pages/TopupCanceled";
import Profile from "./pages/Profile";
import QrView from "./pages/QrView";
import AlgoliaSetup from "./pages/AlgoliaSetup";
import AlgoliaPlans from "./pages/AlgoliaPlans";
import AlgoliaPlansSimple from "./pages/AlgoliaPlansSimple";
import AlgoliaPlansOptimized from "./pages/AlgoliaPlansOptimized";
import AlgoliaDashboard from "./pages/AlgoliaDashboard";
import AlgoliaPlansEntry from "./pages/AlgoliaPlansEntry";
import AdminPricingRules from "./pages/AdminPricingRules";
import AdminAgentPricing from "./pages/AdminAgentPricing";

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <CurrencyProvider>
        <AgentPreviewProvider>
          <CartProvider>
            <Toaster />
            <Sonner />
            <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/confirmed" element={<AuthConfirmed />} />
          <Route path="/auth/confirm" element={<EmailConfirm />} />
          <Route path="/test-auth" element={<TestAuth />} />
          <Route path="/qr" element={<QrView />} />
          
          {/* Protected routes - require agent approval */}
          <Route path="/" element={<AgentApprovalGuard><Dashboard /></AgentApprovalGuard>} />
          <Route path="/plans" element={<AgentApprovalGuard><Plans /></AgentApprovalGuard>} />
          <Route path="/wallet" element={<AgentApprovalGuard><Wallet /></AgentApprovalGuard>} />
          <Route path="/dashboard" element={<AgentApprovalGuard><Dashboard /></AgentApprovalGuard>} />
          <Route path="/esims" element={<AgentApprovalGuard><ESims /></AgentApprovalGuard>} />
          <Route path="/esims/:iccid" element={<AgentApprovalGuard><ESimDetail /></AgentApprovalGuard>} />
          <Route path="/admin/agents" element={<AgentApprovalGuard><AdminAgents /></AgentApprovalGuard>} />
          <Route path="/admin/inventory" element={<AgentApprovalGuard><AdminInventory /></AgentApprovalGuard>} />
          <Route path="/admin/suppliers" element={<AgentApprovalGuard><AdminSuppliers /></AgentApprovalGuard>} />
          <Route path="/admin/pricing-rules" element={<AgentApprovalGuard><AdminPricingRules /></AgentApprovalGuard>} />
          <Route path="/admin/agent-pricing" element={<AgentApprovalGuard><AdminAgentPricing /></AgentApprovalGuard>} />
          <Route path="/admin/system-health" element={<AgentApprovalGuard><SystemHealth /></AgentApprovalGuard>} />
          <Route path="/profile" element={<AgentApprovalGuard><Profile /></AgentApprovalGuard>} />
          <Route path="/wallet/topup-success" element={<AgentApprovalGuard><TopupSuccess /></AgentApprovalGuard>} />
          <Route path="/wallet/topup-canceled" element={<AgentApprovalGuard><TopupCanceled /></AgentApprovalGuard>} />
          <Route path="/algolia-setup" element={<AgentApprovalGuard><AlgoliaSetup /></AgentApprovalGuard>} />
          <Route path="/algolia-plans" element={<AgentApprovalGuard><AlgoliaPlansSimple /></AgentApprovalGuard>} />
          <Route path="/algolia-plans-simple" element={<AgentApprovalGuard><AlgoliaPlansSimple /></AgentApprovalGuard>} />
          <Route path="/algolia-plans-advanced" element={<AgentApprovalGuard><AlgoliaPlans /></AgentApprovalGuard>} />
          <Route path="/algolia-dashboard" element={<AgentApprovalGuard><AlgoliaDashboard /></AgentApprovalGuard>} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </AgentPreviewProvider>
      </CurrencyProvider>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
