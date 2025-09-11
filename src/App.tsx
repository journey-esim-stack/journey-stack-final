import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import TestAuth from "./pages/TestAuth";
import Plans from "./pages/Plans";

import Wallet from "./pages/Wallet";
import Dashboard from "./pages/Dashboard";
import ESims from "./pages/ESims";
import ESimDetail from "./pages/ESimDetail";
import AdminAgents from "./pages/AdminAgents";
import TopupSuccess from "./pages/TopupSuccess";
import TopupCanceled from "./pages/TopupCanceled";
import Profile from "./pages/Profile";

const App = () => (
  <TooltipProvider>
    <CurrencyProvider>
      <CartProvider>
      <Toaster />
      <Sonner />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/test-auth" element={<TestAuth />} />
          <Route path="/plans" element={<Plans />} />
          
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/esims" element={<ESims />} />
          <Route path="/esims/:iccid" element={<ESimDetail />} />
          <Route path="/admin/agents" element={<AdminAgents />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/wallet/topup-success" element={<TopupSuccess />} />
          <Route path="/wallet/topup-canceled" element={<TopupCanceled />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </CartProvider>
    </CurrencyProvider>
  </TooltipProvider>
);

export default App;
