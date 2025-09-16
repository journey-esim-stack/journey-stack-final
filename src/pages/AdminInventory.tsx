import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Search, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface InventoryItem {
  id: string;
  agent_id: string;
  agent_name: string;
  company_name: string;
  esim_iccid: string;
  plan_id: string;
  plan_title: string;
  country_name: string;
  data_amount: string;
  retail_price: number;
  wholesale_price: number;
  status: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string;
  activation_code?: string;
  supplier_order_id?: string;
}

export default function AdminInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [agents, setAgents] = useState<Array<{id: string, company_name: string}>>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchInventory();
    fetchAgents();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('inventory_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchInventory();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'esim_topups'
        },
        () => {
          fetchInventory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterInventory();
  }, [inventory, search, statusFilter, agentFilter]);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("id, company_name")
        .eq("status", "approved");

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error("Error fetching agents:", error);
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      console.log("Fetching inventory data...");

      // Try using the edge function for better data access
      const { data: response, error: functionError } = await supabase.functions.invoke('get-admin-inventory');
      
      if (functionError) {
        console.error("Function error:", functionError);
        throw functionError;
      }

      if (response?.success) {
        console.log("Inventory data from function:", response.data?.length || 0);
        setInventory(response.data || []);
        return;
      }

      // Fallback to direct query if function fails
      console.log("Function failed, trying direct query...");
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          agent_profiles(id, company_name, contact_person),
          esim_plans(title, country_name, data_amount)
        `)
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Direct query error:", ordersError);
        throw ordersError;
      }

      console.log("Direct query orders fetched:", orders?.length || 0);

      // Transform the data
      const inventoryData: InventoryItem[] = (orders || []).map((order: any) => ({
        id: order.id,
        agent_id: order.agent_id,
        agent_name: order.agent_profiles?.contact_person || 'Unknown',
        company_name: order.agent_profiles?.company_name || 'Unknown Company',
        esim_iccid: order.esim_iccid || 'Pending',
        plan_id: order.plan_id,
        plan_title: order.esim_plans?.title || 'Unknown Plan',
        country_name: order.esim_plans?.country_name || 'Unknown',
        data_amount: order.esim_plans?.data_amount || 'Unknown',
        retail_price: order.retail_price,
        wholesale_price: order.wholesale_price,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        activation_code: order.activation_code,
        supplier_order_id: order.supplier_order_id
      }));

      console.log("Direct query inventory data:", inventoryData.length);
      setInventory(inventoryData);

    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory data. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterInventory = () => {
    let filtered = inventory;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(item =>
        item.company_name.toLowerCase().includes(searchLower) ||
        item.esim_iccid.toLowerCase().includes(searchLower) ||
        item.customer_name.toLowerCase().includes(searchLower) ||
        item.customer_email.toLowerCase().includes(searchLower) ||
        item.plan_title.toLowerCase().includes(searchLower) ||
        item.country_name.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    if (agentFilter !== "all") {
      filtered = filtered.filter(item => item.agent_id === agentFilter);
    }

    setFilteredInventory(filtered);
  };

  const downloadInventory = () => {
    try {
      const exportData = filteredInventory.map(item => ({
        'Agent Company': item.company_name,
        'Agent Contact': item.agent_name,
        'ICCID': item.esim_iccid,
        'Plan': item.plan_title,
        'Country': item.country_name,
        'Data Amount': item.data_amount,
        'Customer Name': item.customer_name,
        'Customer Email': item.customer_email,
        'Status': item.status,
        'Retail Price': `$${item.retail_price}`,
        'Wholesale Price': `$${item.wholesale_price}`,
        'Activation Code': item.activation_code || 'N/A',
        'Supplier Order ID': item.supplier_order_id || 'N/A',
        'Created At': new Date(item.created_at).toLocaleString(),
        'Updated At': new Date(item.updated_at).toLocaleString()
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'eSIM Inventory');

      const fileName = `esim-inventory-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Success",
        description: `Inventory exported as ${fileName}`,
      });
    } catch (error) {
      console.error("Error exporting inventory:", error);
      toast({
        title: "Error",
        description: "Failed to export inventory",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">eSIM Inventory Management</h1>
            <p className="text-muted-foreground">
              Track all eSIM orders and inventory across all travel agents
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchInventory} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={downloadInventory} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Inventory
            </Button>
          </div>
        </div>

        {/* Debug Info */}
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <p className="text-sm text-yellow-800">
              Debug: Total inventory items: {inventory.length}, Filtered: {filteredInventory.length}
            </p>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by agent, ICCID, customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{inventory.length}</div>
              <p className="text-sm text-muted-foreground">Total eSIMs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                {inventory.filter(item => item.status === 'completed').length}
              </div>
              <p className="text-sm text-muted-foreground">Active eSIMs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                {inventory.filter(item => item.status === 'pending').length}
              </div>
              <p className="text-sm text-muted-foreground">Pending eSIMs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                {new Set(inventory.map(item => item.agent_id)).size}
              </div>
              <p className="text-sm text-muted-foreground">Active Agents</p>
            </CardContent>
          </Card>
        </div>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Inventory Items ({filteredInventory.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Agent</th>
                      <th className="text-left p-3">ICCID</th>
                      <th className="text-left p-3">Plan</th>
                      <th className="text-left p-3">Customer</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Prices</th>
                      <th className="text-left p-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{item.company_name}</div>
                            <div className="text-sm text-muted-foreground">{item.agent_name}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-sm">
                            {item.esim_iccid}
                          </div>
                        </td>
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{item.plan_title}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.country_name} • {item.data_amount}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{item.customer_name}</div>
                            <div className="text-sm text-muted-foreground">{item.customer_email}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge className={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="text-sm">
                            <div>Retail: ${item.retail_price}</div>
                            <div className="text-muted-foreground">
                              Wholesale: ${item.wholesale_price}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredInventory.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    No inventory items found{inventory.length > 0 && " (check filters)"}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}