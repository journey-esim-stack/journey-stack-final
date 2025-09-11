import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Wifi, MapPin, Globe, Database, RefreshCw, Eye, Activity } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { ESimDetailModal } from "@/components/ESimDetailModal";

interface Order {
  id: string;
  created_at: string;
  esim_iccid: string | null;
  esim_qr_code?: string;
  activation_code?: string;
  status: string;
  plan_id: string;
  customer_name: string;
  customer_email: string;
  esim_plans?: {
    title: string;
    country_name: string;
    country_code: string;
    data_amount: string;
    validity_days: number;
  };
  real_status?: string; // Real eSIM status from API
}

const ESims = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusLoading, setStatusLoading] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  // Auto-refresh effect for pending orders and real-time status updates
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const hasPendingOrders = orders.some(order => order.status === 'pending');
    const hasCompletedOrders = orders.some(order => order.status === 'completed' && order.esim_iccid);
    
    if (!hasPendingOrders && !hasCompletedOrders) {
      setAutoRefreshEnabled(false);
      return;
    }

    const interval = setInterval(() => {
      if (hasPendingOrders) {
        // Full refresh for pending orders
        fetchOrders();
      } else if (hasCompletedOrders) {
        // Just update statuses for completed orders
        fetchESIMStatuses(orders);
      }
    }, 10000); // Refresh every 10 seconds for real-time updates

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, orders]);

  // Auto-enable refresh if there are completed eSIMs
  useEffect(() => {
    const hasCompletedOrders = orders.some(order => order.status === 'completed' && order.esim_iccid);
    if (hasCompletedOrders && !autoRefreshEnabled) {
      setAutoRefreshEnabled(true);
    }
  }, [orders]);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to view your eSIMs");
        return;
      }

      console.log("Fetching eSIMs for user:", user.id);

      // Get agent profile first
      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      console.log("Agent profile:", agentProfile);

      if (!agentProfile) {
        toast.error("Agent profile not found");
        return;
      }

      // Fetch all orders first to see what we have
      const { data: allOrders, error: allOrdersError } = await supabase
        .from("orders")
        .select(`
          *,
          esim_plans (
            title,
            country_name,
            country_code,
            data_amount,
            validity_days
          )
        `)
        .eq("agent_id", agentProfile.id)
        .order("created_at", { ascending: false });

      console.log("All orders for agent:", allOrders);
      console.log("All orders error:", allOrdersError);

      // Fetch orders with eSIM data (completed and pending orders)
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          esim_plans (
            title,
            country_name,
            country_code,
            data_amount,
            validity_days
          )
        `)
        .eq("agent_id", agentProfile.id)
        .in("status", ["completed", "pending", "failed"])
        .order("created_at", { ascending: false });

      console.log("Completed orders with eSIMs:", data);
      console.log("Orders fetch error:", error);

      if (error) {
        console.error("Error fetching orders:", error);
        toast.error("Failed to fetch eSIMs");
        return;
      }

      setOrders(data || []);
      
      // Fetch real eSIM status for completed orders
      if (data && data.length > 0) {
        fetchESIMStatuses(data);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while fetching eSIMs");
    } finally {
      setLoading(false);
    }
  };

  const fetchESIMStatuses = async (ordersList: Order[]) => {
    const completedOrders = ordersList.filter(order => 
      order.status === "completed" && order.esim_iccid
    );

    const newStatusLoading = new Set(completedOrders.map(order => order.id));
    setStatusLoading(newStatusLoading);

    const updatedOrders = [...ordersList];

    for (const order of completedOrders) {
      try {
        const { data: eSimDetails, error } = await supabase.functions.invoke('get-esim-details', {
          body: { iccid: order.esim_iccid }
        });

        if (!error && eSimDetails?.success && eSimDetails.obj) {
          const orderIndex = updatedOrders.findIndex(o => o.id === order.id);
          if (orderIndex !== -1) {
            // Map API status to our status format
            const apiStatus = eSimDetails.obj.status || eSimDetails.obj.state;
            let realStatus = "inactive";
            
            if (apiStatus) {
              switch (apiStatus.toLowerCase()) {
                case "active":
                case "activated":
                case "connected":
                case "online":
                  realStatus = "active";
                  break;
                case "inactive":
                case "not_activated":
                case "not_active":
                case "offline":
                  realStatus = "inactive";
                  break;
                case "suspended":
                case "blocked":
                  realStatus = "suspended";
                  break;
                case "expired":
                  realStatus = "expired";
                  break;
                default:
                  realStatus = "inactive";
              }
            }
            
            updatedOrders[orderIndex] = {
              ...updatedOrders[orderIndex],
              real_status: realStatus
            };
          }
        }
      } catch (error) {
        console.error(`Failed to fetch status for eSIM ${order.esim_iccid}:`, error);
      }
    }

    setOrders(updatedOrders);
    setStatusLoading(new Set());
  };

  const filteredOrders = orders.filter((order) =>
    order.esim_iccid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.esim_plans?.country_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string, realStatus?: string) => {
    // Use real status if available, otherwise fall back to order status
    const currentStatus = realStatus || status;
    
    switch (currentStatus.toLowerCase()) {
      case "active":
      case "activated":
      case "connected":
      case "online":
        return "bg-green-100 text-green-800 border-green-200";
      case "inactive":
      case "not_activated":
      case "not_active":
      case "offline":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "suspended":
      case "blocked":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "expired":
        return "bg-red-100 text-red-800 border-red-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "failed":
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusText = (status: string, realStatus?: string) => {
    // Use real status if available, otherwise fall back to order status
    const currentStatus = realStatus || status;
    
    switch (currentStatus.toLowerCase()) {
      case "active":
      case "activated":
      case "connected":
      case "online":
        return "Active";
      case "inactive":
      case "not_activated":
      case "not_active":
      case "offline":
        return "Inactive";
      case "suspended":
      case "blocked":
        return "Suspended";
      case "expired":
        return "Expired";
      case "pending":
        return "Processing";
      case "failed":
        return "Failed";
      default:
        return currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
    }
  };

  const handleESIMClick = (iccid: string | null) => {
    if (iccid) {
      navigate(`/esims/${iccid}`);
    }
  };

  const retryESIMCreation = async (orderId: string, planId: string) => {
    try {
      setRetryingId(orderId);
      
      console.log('Calling create-esim function directly...');
      
      // Use direct fetch to get detailed error info  
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const response = await fetch('https://cccktfactlzxuprpyhgh.supabase.co/functions/v1/create-esim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          plan_id: planId, 
          order_id: orderId 
        })
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      let responseData;
      try {
        responseData = await response.json();
        console.log('Response data:', responseData);
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        const textResponse = await response.text();
        console.log('Response as text:', textResponse);
        toast.error(`API error: ${response.status} - Failed to parse response`);
        return;
      }
      
      if (!response.ok) {
        // Extract detailed error information
        const errorMsg = responseData?.error || 'Unknown error';
        const details = responseData?.details || '';
        const apiStatus = responseData?.status || '';
        
        let fullErrorMsg = errorMsg;
        if (details && typeof details === 'object') {
          // If details is an object (eSIM Access API response), extract meaningful info
          const detailMsg = details.message || details.error || JSON.stringify(details);
          fullErrorMsg = `${errorMsg}: ${detailMsg}`;
        } else if (details) {
          fullErrorMsg = `${errorMsg}: ${details}`;
        }
        
        if (apiStatus) {
          fullErrorMsg = `${fullErrorMsg} (API Status: ${apiStatus})`;
        }
        
        toast.error(fullErrorMsg);
        console.error('Create eSIM failed:', { 
          status: response.status, 
          error: responseData?.error,
          details: responseData?.details,
          apiStatus: responseData?.status
        });
      } else {
        toast.success('eSIM created successfully!');
        console.log('eSIM creation successful:', responseData);
      }

      // Refresh the orders list
      fetchOrders();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create eSIM');
      console.error('Retry eSIM creation error:', error);
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="glass-intense p-8 text-left relative">
          <img 
            src="/illustrations/connection.png" 
            alt="Connection illustration" 
            className="absolute top-4 right-4 w-20 h-20 opacity-50 hidden md:block"
          />
          <h1 className="text-4xl font-bold mb-4 text-black">
            My eSIMs
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Manage and monitor your purchased eSIMs. View activation status, data usage, and download QR codes.
          </p>
          <div className="flex items-center justify-start gap-2 mt-4 text-sm text-muted-foreground">
            <Wifi className="h-4 w-4" />
            <span>{orders.length} eSIMs purchased</span>
            <span>•</span>
            <Database className="h-4 w-4" />
            <span>Active inventory</span>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                eSIM Inventory
              </div>
              <div className="flex items-center gap-2">
                {orders.some(order => order.status === 'pending') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                    className={`transition-colors ${autoRefreshEnabled ? 'bg-primary/10 text-primary border-primary' : ''}`}
                  >
                    <Activity className={`h-4 w-4 mr-2 ${autoRefreshEnabled ? 'animate-pulse' : ''}`} />
                    {autoRefreshEnabled ? 'Auto-refresh ON' : 'Auto-refresh'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchOrders}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardTitle>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary h-4 w-4" />
              <Input
                placeholder="Search by ICCID, customer name, email, or country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 glass-intense border-0"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Wifi className="h-16 w-16 text-muted-foreground mx-auto mb-6 opacity-50" />
                <h3 className="text-xl font-semibold mb-3">No eSIMs Found</h3>
                <p className="text-muted-foreground text-lg">
                  {searchTerm ? "No eSIMs match your search criteria." : "You haven't purchased any eSIMs yet."}
                </p>
                {!searchTerm && (
                  <p className="text-muted-foreground mt-2">
                    Start by browsing and purchasing plans from the Plans page.
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/50">
                      <TableHead className="text-muted-foreground font-medium">eSIM ICCID</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Date Assigned</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Country</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Data Plan</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow 
                        key={order.id} 
                        className="hover:bg-muted/30 transition-colors border-b border-border/30 cursor-pointer"
                        onClick={() => order.esim_iccid && handleESIMClick(order.esim_iccid)}
                      >
                        <TableCell 
                          className={`font-mono text-sm ${order.esim_iccid ? 'text-primary font-medium' : 'text-muted-foreground'} transition-all`}
                        >
                          {order.esim_iccid || "Pending..."}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(order.created_at), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{order.esim_plans?.country_name || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{order.esim_plans?.title || "N/A"}</div>
                            <div className="text-sm text-muted-foreground">{order.esim_plans?.data_amount || "N/A"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getStatusColor(order.status, order.real_status)} inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap border`}>
                              {statusLoading.has(order.id) ? (
                                <div className="flex items-center gap-1">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                                  Loading...
                                </div>
                              ) : (
                                getStatusText(order.status, order.real_status)
                              )}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {order.esim_iccid && order.status === "completed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrder(order);
                                }}
                                className="h-8 px-2 text-xs"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View eSIM
                              </Button>
                            )}
                            {order.status === "failed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={retryingId === order.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  retryESIMCreation(order.id, order.plan_id);
                                }}
                                className="h-8 px-2 text-xs"
                              >
                                <RefreshCw className={`h-3 w-3 mr-1 ${retryingId === order.id ? 'animate-spin' : ''}`} />
                                {retryingId === order.id ? 'Retrying...' : 'Retry'}
                              </Button>
                            )}
                            {order.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={retryingId === order.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  retryESIMCreation(order.id, order.plan_id);
                                  setAutoRefreshEnabled(true);
                                }}
                                className="h-8 px-2 text-xs"
                              >
                                <RefreshCw className={`h-3 w-3 mr-1 ${retryingId === order.id ? 'animate-spin' : ''}`} />
                                {retryingId === order.id ? 'Creating...' : 'Create eSIM'}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* eSIM Detail Modal */}
        {selectedOrder && (
          <ESimDetailModal
            isOpen={!!selectedOrder}
            onClose={() => setSelectedOrder(null)}
            order={selectedOrder}
          />
        )}
      </div>
    </Layout>
  );
};

export default ESims;