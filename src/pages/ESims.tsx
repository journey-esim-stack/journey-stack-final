import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Wifi, MapPin, Globe, Database } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Layout from "@/components/Layout";

interface Order {
  id: string;
  created_at: string;
  esim_iccid: string | null;
  status: string;
  plan_id: string;
  customer_name: string;
  customer_email: string;
  esim_plans?: {
    title: string;
    country_name: string;
    country_code: string;
    data_amount: string;
  };
}

const ESims = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

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
            data_amount
          )
        `)
        .eq("agent_id", agentProfile.id)
        .order("created_at", { ascending: false });

      console.log("All orders for agent:", allOrders);
      console.log("All orders error:", allOrdersError);

      // Fetch orders with eSIM data (completed orders)
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          esim_plans (
            title,
            country_name,
            country_code,
            data_amount
          )
        `)
        .eq("agent_id", agentProfile.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      console.log("Completed orders with eSIMs:", data);
      console.log("Orders fetch error:", error);

      if (error) {
        console.error("Error fetching orders:", error);
        toast.error("Failed to fetch eSIMs");
        return;
      }

      setOrders(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while fetching eSIMs");
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) =>
    order.esim_iccid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.esim_plans?.country_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "failed":
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handleESIMClick = (iccid: string | null) => {
    if (iccid) {
      navigate(`/esims/${iccid}`);
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
        <div className="glass-intense p-8 text-center">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            My eSIMs
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Manage and monitor your purchased eSIMs
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Wifi className="h-4 w-4" />
            <span>{orders.length} eSIMs purchased</span>
            <span>•</span>
            <Database className="h-4 w-4" />
            <span>Active inventory</span>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              eSIM Inventory
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
                      <TableHead className="text-muted-foreground font-medium">Customer</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Country</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Data Plan</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/30">
                        <TableCell 
                          className="font-mono text-sm text-primary hover:underline cursor-pointer transition-all"
                          onClick={() => handleESIMClick(order.esim_iccid)}
                        >
                          {order.esim_iccid || "N/A"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(order.created_at), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{order.customer_name}</div>
                            <div className="text-sm text-muted-foreground">{order.customer_email}</div>
                          </div>
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
                          <Badge className={`${getStatusColor(order.status)} inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap border`}>
                            {order.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ESims;