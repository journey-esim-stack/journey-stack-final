import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function TopupCanceled() {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="max-w-xl mx-auto text-center py-16 space-y-6">
        <h1 className="text-3xl font-bold">Top-up Canceled</h1>
        <p className="text-muted-foreground">You canceled the payment. Your wallet was not charged.</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate("/plans")}>Browse Plans</Button>
          <Button onClick={() => navigate("/wallet")}>Back to Wallet</Button>
        </div>
      </div>
    </Layout>
  );
}
