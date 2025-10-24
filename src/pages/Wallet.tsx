import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, ChevronLeft, ChevronRight, Shield, Lock, CheckCircle, Wallet as WalletIcon, RefreshCw, Database } from "lucide-react";
import { useCurrency, Currency } from "@/contexts/CurrencyContext";
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
  wallet_currency: string;
}
export default function Wallet() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<WalletTransaction[]>([]);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { getCurrencySymbol } = useCurrency();
  const [topUpAmount, setTopUpAmount] = useState<number>(10);
  const [isRazorpayLoading, setIsRazorpayLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
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
      if (!document.hidden && !inFlightRef.current) {
        console.log("Page became visible, refreshing wallet data");
        fetchWalletData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Cleanup mounted ref on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const fetchWalletData = async () => {
    if (inFlightRef.current || !mountedRef.current) return;
    inFlightRef.current = true;
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Get agent profile with wallet currency
      const {
        data: profileData,
        error: profileError
      } = await supabase.from("agent_profiles").select("id, wallet_balance, wallet_currency").eq("user_id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profileData) {
        console.warn("No agent profile found for user");
        setProfile(null);
        setTransactions([]);
        setAllTransactions([]);
        return;
      }
      setProfile(profileData);

      // Fetch all transactions for export functionality
      const {
        data: allTransactionsData,
        error: allTransactionsError
      } = await supabase.from("wallet_transactions").select("*").eq("agent_id", profileData.id).order("created_at", {
        ascending: false
      });
      console.log("Agent ID:", profileData.id);
      console.log("All transactions query result:", {
        allTransactionsData,
        allTransactionsError
      });
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
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };
  // Load Razorpay script
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpayTopUp = async () => {
    const minAmount = profile?.wallet_currency === 'INR' ? 100 : 10;
    const currencySymbol = getCurrencySymbol(profile?.wallet_currency as Currency);
    
    if (topUpAmount < minAmount) {
      toast({
        title: `Minimum top-up is ${currencySymbol}${minAmount}`,
        description: `Please enter ${currencySymbol}${minAmount} or more.`,
        variant: "destructive"
      });
      return;
    }

    setIsRazorpayLoading(true);
    try {
      const res = await loadRazorpayScript();
      if (!res) {
        toast({
          title: 'Payment Gateway Error',
          description: 'Razorpay SDK failed to load. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      // Create Razorpay order
      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount_inr: topUpAmount }
      });

      if (error) throw error;

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'Journey Stack',
        description: 'Wallet Top-Up',
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            // Verify payment
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              }
            });

            if (verifyError) throw verifyError;

            toast({
              title: 'Top-up successful!',
              description: `₹${verifyData.amount_added.toFixed(2)} added to your wallet.`,
            });

            // Wait a moment for transaction to be committed, then refresh
            setTimeout(() => {
              fetchWalletData();
            }, 500);
          } catch (e) {
            console.error('Payment verification error:', e);
            toast({
              title: 'Payment verification failed',
              description: 'Please contact support if amount was deducted.',
              variant: 'destructive'
            });
          }
        },
        modal: {
          ondismiss: () => {
            setIsRazorpayLoading(false);
          }
        },
        theme: { color: '#3399cc' }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch (e) {
      console.error('Razorpay top-up error:', e);
      toast({
        title: 'Top-up failed',
        description: 'Could not create payment session',
        variant: 'destructive'
      });
    } finally {
      setIsRazorpayLoading(false);
    }
  };

  const handleStripeTopUp = async () => {
    if (topUpAmount < 10) {
      toast({
        title: "Minimum top-up is $10",
        description: "Please enter $10 or more.",
        variant: "destructive"
      });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('create-topup', {
        body: { amount_dollars: topUpAmount }
      });
      if (error) throw error;
      if (data?.url) {
        const popup = window.open(data.url, '_blank');
        if (!popup) {
          toast({
            title: "Payment Window Blocked",
            description: "Please allow popups and try again, or click the link below:",
            action: <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Open Payment
              </a>
          });
        } else {
          setTimeout(() => {
            fetchWalletData();
          }, 1000);
        }
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

  const handleTopUp = () => {
    if (profile?.wallet_currency === 'INR') {
      handleRazorpayTopUp();
    } else {
      handleStripeTopUp();
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

    // Add current balance with wallet currency
    doc.setFontSize(12);
    const walletCurrency = profile?.wallet_currency || 'USD';
    const currencySymbol = getCurrencySymbol(walletCurrency as Currency);
    doc.text(`Current Balance: ${currencySymbol}${profile?.wallet_balance?.toFixed(2) || "0.00"}`, 20, 35);
    doc.text(`Generated on: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, 20, 45);

    // Prepare table data
    const tableData = allTransactions.map(transaction => [
      format(new Date(transaction.created_at), "MMM dd, yyyy HH:mm"), 
      transaction.transaction_type === "deposit" ? "Top-up" : transaction.transaction_type === "purchase" ? "Purchase" : "Refund", 
      transaction.description || "-", 
      `${transaction.transaction_type === "deposit" || transaction.transaction_type === "refund" ? "+" : "-"}${walletCurrency} ${Math.abs(transaction.amount).toFixed(2)}`, 
      `${walletCurrency} ${transaction.balance_after.toFixed(2)}`, 
      transaction.reference_id || "-"
    ]);

    // Add table
    autoTable(doc, {
      head: [['Date', 'Type', 'Description', 'Amount', 'Balance After', 'Reference']],
      body: tableData,
      startY: 55,
      styles: {
        fontSize: 8
      },
      headStyles: {
        fillColor: [59, 130, 246]
      }
    });
    doc.save('transaction-history.pdf');
    toast({
      title: "PDF Downloaded",
      description: "Transaction history has been downloaded as PDF"
    });
  };
  const downloadExcel = () => {
    const walletCurrency = profile?.wallet_currency || 'USD';
    const ws = XLSX.utils.json_to_sheet(allTransactions.map(transaction => ({
      Date: format(new Date(transaction.created_at), "MMM dd, yyyy HH:mm"),
      Type: transaction.transaction_type === "deposit" ? "Top-up" : transaction.transaction_type === "purchase" ? "Purchase" : "Refund",
      Description: transaction.description || "-",
      Amount: transaction.amount,
      'Balance After': transaction.balance_after,
      Reference: transaction.reference_id || "-"
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");

    // Add current balance as a separate sheet
    const balanceSheet = XLSX.utils.json_to_sheet([{
      'Current Balance': `${walletCurrency} ${profile?.wallet_balance?.toFixed(2) || "0.00"}`,
      'Generated On': format(new Date(), "MMM dd, yyyy HH:mm")
    }]);
    XLSX.utils.book_append_sheet(wb, balanceSheet, "Summary");
    XLSX.writeFile(wb, 'transaction-history.xlsx');
    toast({
      title: "Excel Downloaded",
      description: "Transaction history has been downloaded as Excel file"
    });
  };

  const downloadCSV = () => {
    const walletCurrency = profile?.wallet_currency || 'USD';
    const currencySymbol = getCurrencySymbol(walletCurrency as Currency);
    
    // Create CSV header
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Balance After', 'Reference'];
    
    // Create CSV rows
    const rows = allTransactions.map(transaction => [
      format(new Date(transaction.created_at), "MMM dd, yyyy HH:mm"),
      transaction.transaction_type === "deposit" ? "Top-up" : transaction.transaction_type === "purchase" ? "Purchase" : "Refund",
      transaction.description || "-",
      `${transaction.transaction_type === "deposit" || transaction.transaction_type === "refund" ? "+" : "-"}${walletCurrency} ${Math.abs(transaction.amount).toFixed(2)}`,
      `${walletCurrency} ${transaction.balance_after.toFixed(2)}`,
      transaction.reference_id || "-"
    ]);
    
    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'transaction-history.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "CSV Downloaded",
      description: "Transaction history has been downloaded as CSV file"
    });
  };
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
  if (loading) {
    return <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>;
  }
  return <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <WalletIcon className="h-8 w-8 text-primary" />
            Simple &amp; Secure Wallet Top-Ups
          </h1>
          <p className="text-muted-foreground">Manage your wallet balance and view transaction history</p>
          {profile?.wallet_currency && (
            <p className="text-sm text-muted-foreground mt-1">
              Your Wallet Currency: <span className="font-semibold">{profile.wallet_currency} ({profile.wallet_currency === 'INR' ? '🇮🇳 India' : '🌍 International'})</span>
            </p>
          )}
        </div>

        {/* Info Alert */}
        {profile?.wallet_currency && (
          <Alert className="border-primary/20 bg-primary/5">
            <Database className="h-4 w-4" />
            <AlertTitle>About Your Wallet</AlertTitle>
            <AlertDescription>
              Your wallet is set to <strong>{profile.wallet_currency}</strong> based on your country during registration. 
              {profile.wallet_currency === 'INR' 
                ? ' Top-ups are processed via Razorpay in INR.' 
                : ' Top-ups are processed via Stripe in USD.'}
              {' '}Plan prices shown in other currencies are for reference only - you'll be charged in {profile.wallet_currency} at checkout.
            </AlertDescription>
          </Alert>
        )}

        <Card className="glass-card border-black">
          <CardHeader className="relative">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Top Up Wallet</CardTitle>
                <CardDescription>
                  {profile?.wallet_currency === 'INR' 
                    ? 'Minimum top-up is ₹100 - Pay via UPI, Cards, Net Banking'
                    : 'Minimum top-up is $10'}
                </CardDescription>
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
                <label className="text-sm text-muted-foreground">
                  Amount ({profile?.wallet_currency || 'USD'})
                </label>
                <Input 
                  type="number" 
                  min={profile?.wallet_currency === 'INR' ? 100 : 10} 
                  step={profile?.wallet_currency === 'INR' ? 100 : 10} 
                  value={topUpAmount} 
                  onChange={e => setTopUpAmount(Number(e.target.value))} 
                />
              </div>
              <Button 
                onClick={handleTopUp} 
                className="sm:self-end"
                disabled={isRazorpayLoading}
              >
                {isRazorpayLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {profile?.wallet_currency === 'INR' ? 'Pay with Razorpay' : 'Top Up with Stripe'}
              </Button>
            </div>
            
            {/* Payment Methods Image */}
              <div className="mt-6 text-right">
              <div className="flex justify-end">
                <img src="/payment-methods.png" alt="Payment methods" className="h-8 opacity-80 max-w-full" />
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
              {getCurrencySymbol(profile?.wallet_currency as Currency)} {profile?.wallet_balance?.toFixed(2) || "0.00"}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Wallet Currency: {profile?.wallet_currency || 'USD'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-black">
          <CardHeader className="relative">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Recent wallet transactions - Credits (top-ups) and debits (purchases)</CardDescription>
              </div>
              {allTransactions.length > 0 && <DropdownMenu>
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
                    <DropdownMenuItem onClick={downloadCSV}>
                      <FileText className="h-4 w-4 mr-2" />
                      Download CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Download Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>}
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? <Table>
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
                  {transactions.map(transaction => <TableRow key={transaction.id}>
                      <TableCell>
                        {format(new Date(transaction.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getTransactionTypeColor(transaction.transaction_type)} inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap border`}>
                          {transaction.transaction_type === "deposit" ? "Top-up" : transaction.transaction_type === "purchase" ? "Purchase" : "Refund"}
                        </Badge>
                      </TableCell>
                      <TableCell>{transaction.description || "-"}</TableCell>
                      <TableCell>
                        <span className={transaction.transaction_type === "deposit" || transaction.transaction_type === "refund" ? "text-green-600" : "text-red-600"}>
                          {transaction.transaction_type === "deposit" || transaction.transaction_type === "refund" ? "+" : "-"}
                          {profile?.wallet_currency || 'USD'} {Math.abs(transaction.amount).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>{profile?.wallet_currency || 'USD'} {transaction.balance_after.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.reference_id || "-"}
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table> : <div className="text-center py-8">
                <p className="text-muted-foreground">No transactions found</p>
              </div>}
            
            {/* Pagination */}
            {totalPages > 1 && <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, allTransactions.length)} of {allTransactions.length} transactions
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({
                  length: Math.min(5, totalPages)
                }, (_, i) => {
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
                  return <Button key={pageNum} variant={currentPage === pageNum ? "default" : "outline"} size="sm" onClick={() => goToPage(pageNum)} className="w-8 h-8 p-0">
                          {pageNum}
                        </Button>;
                })}
                  </div>
                  
                  <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>}
          </CardContent>
        </Card>
      </div>
    </Layout>;
}