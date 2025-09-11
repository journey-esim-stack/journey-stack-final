import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, DollarSign, Calendar, Database, Wifi } from "lucide-react";
import { useAgentMarkup } from "@/hooks/useAgentMarkup";

interface TopupPlan {
  packageCode: string;
  title: string;
  data_amount: string;
  validity_days: number;
  wholesale_price: number;
  retail_price: number;
  currency: string;
  country_name: string;
  country_code: string;
  description: string;
}

interface AgentProfile {
  wallet_balance: number;
}

interface TopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  iccid: string;
  packageCode?: string;
  onTopupComplete: () => void;
}

const TopupModal = ({ isOpen, onClose, iccid, packageCode, onTopupComplete }: TopupModalProps) => {
  const [topupPlans, setTopupPlans] = useState<TopupPlan[]>([]);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const { calculatePrice } = useAgentMarkup();

  useEffect(() => {
    if (isOpen) {
      fetchTopupPlans();
      fetchAgentProfile();
    }
  }, [isOpen, iccid, packageCode]);

  const fetchAgentProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from("agent_profiles")
        .select("wallet_balance")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (error) throw error;
      setAgentProfile(profile);
    } catch (error) {
      console.error("Error fetching agent profile:", error);
      toast.error("Failed to fetch wallet balance");
    }
  };

  const fetchTopupPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-topup-plans", {
        body: { iccid, packageCode },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setTopupPlans(data.plans || []);
    } catch (error) {
      console.error("Error fetching top-up plans:", error);
      toast.error("Failed to fetch top-up plans");
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async (plan: TopupPlan) => {
    if (!agentProfile) {
      toast.error("Wallet balance not available");
      return;
    }

    if (agentProfile.wallet_balance < Number(calculatePrice(plan.wholesale_price).toFixed(2))) {
      toast.error("Insufficient wallet balance");
      return;
    }

    setProcessing(plan.packageCode);
    try {
      const currentRetailPrice = Number(calculatePrice(plan.wholesale_price).toFixed(2));
      const { data, error } = await supabase.functions.invoke("process-topup", {
        body: {
          iccid,
          packageCode: plan.packageCode,
          amount: currentRetailPrice, // Use current retail price for wallet deduction
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(`Top-up successful! New balance: $${data.newBalance.toFixed(2)}`);
      onTopupComplete();
      onClose();
    } catch (error) {
      console.error("Error processing top-up:", error);
      toast.error(error instanceof Error ? error.message : "Top-up failed");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto glass-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Top-up Data Plan
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select a compatible top-up plan for eSIM: {iccid}
          </p>
          {agentProfile && (
            <div className="flex items-center gap-2 mt-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">
                Wallet Balance: ${agentProfile.wallet_balance.toFixed(2)}
              </span>
            </div>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading top-up plans...</span>
          </div>
        ) : topupPlans.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No top-up plans available for this eSIM</p>
          </div>
        ) : (
          <div className="space-y-4">
            {topupPlans.map((plan) => {
              // Recalculate retail price with current markup in real-time
               const currentRetailPrice = Number(calculatePrice(plan.wholesale_price).toFixed(2));
               const canAfford = agentProfile && agentProfile.wallet_balance >= currentRetailPrice;
               const isProcessingThis = processing === plan.packageCode;

              return (
                <div
                  key={plan.packageCode}
                  className={`glass-intense p-4 rounded-lg border transition-all ${
                    canAfford ? "border-primary/20 hover:border-primary/40" : "border-destructive/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{plan.title}</h3>
                        <Badge
                          variant="outline"
                          className={`${
                            canAfford
                              ? "border-green-500/20 text-green-600"
                              : "border-red-500/20 text-red-600"
                          }`}
                        >
                          {plan.country_name}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-primary" />
                          <span className="text-muted-foreground">Data:</span>
                          <span className="font-medium">{plan.data_amount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="text-muted-foreground">Validity:</span>
                          <span className="font-medium">{plan.validity_days} days</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                          <span className="text-muted-foreground">Price:</span>
                          <span className="font-medium">
                            ${currentRetailPrice.toFixed(2)} {plan.currency}
                          </span>
                        </div>
                      </div>

                      {plan.description && (
                        <p className="text-xs text-muted-foreground mt-2">{plan.description}</p>
                      )}

                      {!canAfford && (
                        <p className="text-xs text-destructive mt-2">
                          Insufficient wallet balance. Please top up your wallet first.
                        </p>
                      )}
                    </div>

                    <div className="ml-4">
                      <Button
                        onClick={() => handleTopup(plan)}
                        disabled={!canAfford || isProcessingThis}
                        variant={canAfford ? "default" : "outline"}
                        size="sm"
                        className="min-w-[100px]"
                      >
                        {isProcessingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          `Purchase $${currentRetailPrice.toFixed(2)}`
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Separator className="bg-white/10" />
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={!!processing}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TopupModal;