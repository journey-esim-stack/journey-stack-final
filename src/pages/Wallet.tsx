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
import { Download, FileText, FileSpreadsheet, ChevronLeft, ChevronRight, Shield, Lock, CheckCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
  const [allTransactions, setAllTransactions] = useState<WalletTransaction[]>([]);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [topUpAmount, setTopUpAmount] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    // Set page title
    document.title = "Journey Stack | Unrivaled eSIM Platform - Wallet";
    
    const run = async () => {
      try {
        await supabase.functions.invoke('sync-topups');
      } catch {}
      await fetchWalletData();
    };
    run();
  }, []);

  // Listen for URL changes and visibility changes to refresh data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("Page became visible, refreshing wallet data");
        fetchWalletData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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

      // Fetch all transactions for export functionality
      const { data: allTransactionsData, error: allTransactionsError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("agent_id", profileData.id)
        .order("created_at", { ascending: false });

      console.log("Agent ID:", profileData.id);
      console.log("All transactions query result:", { allTransactionsData, allTransactionsError });

      if (allTransactionsError) {
        console.error("Transaction fetch error:", allTransactionsError);
        setTransactions([]);
        setAllTransactions([]);
      } else {
        console.log("Setting all transactions:", allTransactionsData);
        const allData = allTransactionsData || [];
        setAllTransactions(allData);
        
        // Calculate pagination
        const totalItems = allData.length;
        const pages = Math.ceil(totalItems / itemsPerPage);
        setTotalPages(pages);
        
        // Get current page transactions
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        setTransactions(allData.slice(startIndex, endIndex));
      }
    } catch (error) {
      console.error("Wallet data fetch error:", error);
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
    if (topUpAmount < 10) {
      toast({
        title: "Minimum top-up is $10",
        description: "Please enter $10 or more.",
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
        
        // Add a slight delay before refreshing to allow the window to open
        setTimeout(() => {
          fetchWalletData();
        }, 1000);
      }
    } catch (e) {
      console.error("Top-up error:", e);
      toast({
        title: 'Top-up failed',
        description: 'Could not create top-up session',
        variant: 'destructive'
      });
    }
  };

  // Update displayed transactions when page changes
  useEffect(() => {
    if (allTransactions.length > 0) {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      setTransactions(allTransactions.slice(startIndex, endIndex));
    }
  }, [currentPage, allTransactions]);

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "deposit":
        return "bg-green-100 text-green-800 border-green-200";
      case "purchase":
        return "bg-red-100 text-red-800 border-red-200";
      case "refund":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Transaction History', 20, 20);
    
    // Add current balance
    doc.setFontSize(12);
    doc.text(`Current Balance: USD ${profile?.wallet_balance?.toFixed(2) || "0.00"}`, 20, 35);
    doc.text(`Generated on: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, 20, 45);
    
    // Prepare table data
    const tableData = allTransactions.map(transaction => [
      format(new Date(transaction.created_at), "MMM dd, yyyy HH:mm"),
      transaction.transaction_type === "deposit" ? "Top-up" : transaction.transaction_type === "purchase" ? "Purchase" : "Refund",
      transaction.description || "-",
      `${transaction.transaction_type === "deposit" || transaction.transaction_type === "refund" ? "+" : "-"}USD ${Math.abs(transaction.amount).toFixed(2)}`,
      `USD ${transaction.balance_after.toFixed(2)}`,
      transaction.reference_id || "-"
    ]);
    
    // Add table
    autoTable(doc, {
      head: [['Date', 'Type', 'Description', 'Amount', 'Balance After', 'Reference']],
      body: tableData,
      startY: 55,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.save('transaction-history.pdf');
    
    toast({
      title: "PDF Downloaded",
      description: "Transaction history has been downloaded as PDF",
    });
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      allTransactions.map(transaction => ({
        Date: format(new Date(transaction.created_at), "MMM dd, yyyy HH:mm"),
        Type: transaction.transaction_type === "deposit" ? "Top-up" : transaction.transaction_type === "purchase" ? "Purchase" : "Refund",
        Description: transaction.description || "-",
        Amount: transaction.amount,
        'Balance After': transaction.balance_after,
        Reference: transaction.reference_id || "-"
      }))
    );
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    
    // Add current balance as a separate sheet
    const balanceSheet = XLSX.utils.json_to_sheet([
      { 
        'Current Balance': profile?.wallet_balance?.toFixed(2) || "0.00",
        'Generated On': format(new Date(), "MMM dd, yyyy HH:mm")
      }
    ]);
    XLSX.utils.book_append_sheet(wb, balanceSheet, "Summary");
    
    XLSX.writeFile(wb, 'transaction-history.xlsx');
    
    toast({
      title: "Excel Downloaded",
      description: "Transaction history has been downloaded as Excel file",
    });
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
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

        <Card className="glass-card border-black">
          <CardHeader className="relative">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Top Up Wallet</CardTitle>
                <CardDescription>Minimum top-up is USD 10</CardDescription>
              </div>
              {/* Security badges moved to top right */}
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Secure</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Encrypted</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">PCI Compliant</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-sm text-muted-foreground">Amount (USD)</label>
                <Input
                  type="number"
                  min={10}
                  step="10"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(Number(e.target.value))}
                />
              </div>
              <Button onClick={handleTopUp} className="sm:self-end">
                Top Up
              </Button>
            </div>
            
            {/* Payment Methods Image */}
              <div className="mt-6 text-right">
              <div className="flex justify-end">
                <img 
                  src="/payment-methods.png" 
                  alt="Payment methods" 
                  className="h-8 opacity-80 max-w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-black">
          <CardHeader className="relative">
            <CardTitle>Current Balance</CardTitle>
            <CardDescription>Your available wallet balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              USD {profile?.wallet_balance?.toFixed(2) || "0.00"}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-black">
          <CardHeader className="relative">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Recent wallet transactions - Credits (top-ups) and debits (purchases)</CardDescription>
              </div>
              {allTransactions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={downloadPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Download Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
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
                        <Badge 
                          className={`${getTransactionTypeColor(transaction.transaction_type)} inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap border`}
                        >
                          {transaction.transaction_type === "deposit" ? "Top-up" : transaction.transaction_type === "purchase" ? "Purchase" : "Refund"}
                        </Badge>
                      </TableCell>
                      <TableCell>{transaction.description || "-"}</TableCell>
                      <TableCell>
                        <span className={
                          transaction.transaction_type === "deposit" || transaction.transaction_type === "refund" 
                            ? "text-green-600" 
                            : "text-red-600"
                        }>
                          {transaction.transaction_type === "deposit" || transaction.transaction_type === "refund" ? "+" : "-"}
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
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, allTransactions.length)} of {allTransactions.length} transactions
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}