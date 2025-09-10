import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Wifi, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

      // Get agent profile first
      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agentProfile) {
        toast.error("Agent profile not found");
        return;
      }

      // Fetch orders with eSIM data
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
        .not("esim_iccid", "is", null)
        .order("created_at", { ascending: false });

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
      <div className="container mx-auto p-6">
        <div className="text-center">Loading eSIMs...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My eSIMs</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor your purchased eSIMs
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            eSIM Inventory
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by ICCID, customer name, email, or country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <Wifi className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No eSIMs Found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "No eSIMs match your search criteria." : "You haven't purchased any eSIMs yet."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>eSIM ICCID</TableHead>
                  <TableHead>Date Assigned</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Data Plan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell 
                      className="font-mono text-sm text-primary hover:underline"
                      onClick={() => handleESIMClick(order.esim_iccid)}
                    >
                      {order.esim_iccid || "N/A"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.created_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-sm text-muted-foreground">{order.customer_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{order.esim_plans?.country_name || "N/A"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ESims;