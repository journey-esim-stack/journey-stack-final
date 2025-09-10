import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface WalletTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  reference_id: string;
  balance_after: number;
  created_at: string;
}

interface AgentProfile {
  id: string;
  wallet_balance: number;
}

export default function Wallet() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [topUpAmount, setTopUpAmount] = useState<number>(50);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Get agent profile
      const { data: profileData, error: profileError } = await supabase
        .from("agent_profiles")
        .select("id, wallet_balance")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("agent_id", profileData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch wallet data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    if (topUpAmount < 50) {
      toast({
        title: "Minimum top-up is $50",
        description: "Please enter $50 or more.",
        variant: "destructive",
      });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('create-topup', {
        body: { amount_dollars: topUpAmount }
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (e) {
      toast({
        title: 'Top-up failed',
        description: 'Could not create top-up session',
        variant: 'destructive'
      });
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "credit":
        return "bg-green-100 text-green-800";
      case "debit":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Wallet</h1>
          <p className="text-muted-foreground">Manage your wallet balance and view transaction history</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Up Wallet</CardTitle>
            <CardDescription>Minimum top-up is USD 50</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-sm text-muted-foreground">Amount (USD)</label>
                <Input
                  type="number"
                  min={50}
                  step="10"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(Number(e.target.value))}
                />
              </div>
              <Button onClick={handleTopUp} className="sm:self-end">
                Top Up
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Balance</CardTitle>
            <CardDescription>Your available wallet balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              USD {profile?.wallet_balance?.toFixed(2) || "0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Recent wallet transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance After</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {format(new Date(transaction.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTransactionTypeColor(transaction.transaction_type)}>
                          {transaction.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{transaction.description || "-"}</TableCell>
                      <TableCell>
                        <span className={transaction.transaction_type === "credit" ? "text-green-600" : "text-red-600"}>
                          {transaction.transaction_type === "credit" ? "+" : "-"}
                          USD {Math.abs(transaction.amount).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>USD {transaction.balance_after.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.reference_id || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No transactions found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}