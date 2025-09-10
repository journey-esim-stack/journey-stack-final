import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function TopupSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(true);
  const [result, setResult] = useState<{ amount?: number; balance?: number } | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      toast({
        title: "Missing session",
        description: "No Stripe session ID provided.",
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    const confirm = async () => {
      try {
        console.log("Confirming top-up with session ID:", sessionId);
        const { data, error } = await supabase.functions.invoke("confirm-topup", {
          body: { session_id: sessionId },
        });
        console.log("Confirm topup response:", { data, error });
        if (error) throw error;
        setResult({ amount: data?.amount, balance: data?.balance });
        toast({ title: "Top-up confirmed", description: `Balance updated successfully.` });
      } catch (e) {
        console.error("Top-up confirmation error:", e);
        toast({ title: "Confirmation failed", description: "Please contact support.", variant: "destructive" });
      } finally {
        setProcessing(false);
      }
    };

    confirm();
  }, [searchParams, toast]);

  return (
    <Layout>
      <div className="max-w-xl mx-auto text-center py-16 space-y-6">
        <h1 className="text-3xl font-bold">Top-up Successful</h1>
        {processing ? (
          <p className="text-muted-foreground">Confirming your payment...</p>
        ) : (
          <>
            <p className="text-muted-foreground">
              {result?.amount
                ? `Your wallet was credited with USD ${result.amount.toFixed(2)}.`
                : `Your wallet was updated.`}
            </p>
            {typeof result?.balance === "number" && (
              <p className="font-semibold">New Balance: USD {result.balance.toFixed(2)}</p>
            )}
            <div>
              <Button onClick={() => navigate("/wallet")}>Back to Wallet</Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
