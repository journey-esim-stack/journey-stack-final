import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { format, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Smartphone, DollarSign, ShoppingCart, AlertTriangle } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SkeletonCard } from "@/components/ui/skeleton-enhanced";
import { MayaStatusParser } from "@/utils/mayaStatus";

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  retail_price: number;
  wholesale_price?: number;
  status: string;
  created_at: string;
  esim_iccid: string;
  activation_code: string;
  supplier_order_id: string;
  real_status?: string;
  esim_plans: {
    title: string;
    country_name: string;
    data_amount: string;
    validity_days: number;
    supplier_name?: string;
  };
}

interface AgentProfile {
  company_name: string;
  contact_person: string;
  wallet_balance: number;
}

interface HighDataUsageESim {
  iccid: string;
  plan_name: string;
  country_name: string;
  data_used_percentage: number;
  customer_name: string;
  customer_email: string;
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeESims, setActiveESims] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [highUsageESims, setHighUsageESims] = useState<HighDataUsageESim[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [statusCache, setStatusCache] = useState<Record<string, any>>({});
  const { toast } = useToast();
  
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    // Set page title
    document.title = "Journey Stack | Unrivaled eSIM Platform - Dashboard";
    
    fetchDashboardData();
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchDashboardData = async () => {
    if (inFlightRef.current || !mountedRef.current) return;
    
    inFlightRef.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Get agent profile
      const { data: profile, error: profileError } = await supabase
        .from("agent_profiles")
        .select("id, company_name, contact_person, wallet_balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (!profile) {
        console.warn("No agent profile found for user");
        setAgentProfile(null);
        setOrders([]);
        setChartData([]);
        setActiveESims(0);
        setHighUsageESims([]);
        return;
      }
      
      setAgentProfile(profile);

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          customer_name,
          customer_email,
          customer_phone,
          retail_price,
          status,
          created_at,
          esim_iccid,
          activation_code,
          supplier_order_id,
          real_status,
          esim_plans:plan_id (
            title,
            country_name,
            data_amount,
            validity_days,
            supplier_name
          )
        `)
        .eq("agent_id", profile.id)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);
      
      // Generate chart data for last 30 days
      generateChartData(ordersData || []);
      
      // Fetch live statuses and compute active eSIMs from providers (with concurrency limit)
      await fetchApiStatuses(ordersData || []);

      // Fetch real eSIM usage data (using cached results when possible)
      await fetchHighUsageESims(ordersData || []);

    } catch (error) {
      if (mountedRef.current) {
        toast({
          title: "Error",
          description: "Failed to fetch dashboard data",
          variant: "destructive",
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      inFlightRef.current = false;
    }
  };

  const generateChartData = (ordersData: Order[]) => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      return {
        date: format(date, "MMM dd"),
        orders: 0,
      };
    });

    ordersData.forEach(order => {
      const orderDate = new Date(order.created_at);
      const dayIndex = last30Days.findIndex(day => 
        format(orderDate, "MMM dd") === day.date
      );
      if (dayIndex !== -1) {
        last30Days[dayIndex].orders++;
      }
    });

    setChartData(last30Days);
  };

  const fetchApiStatuses = async (ordersData: Order[]) => {
    const items = (ordersData || []).filter(o => !!o.esim_iccid);
    if (items.length === 0) {
      setActiveESims(0);
      return;
    }
    
    // Deduplicate ICCIDs to avoid duplicate API calls
    const uniqueItems = items.reduce((acc, order) => {
      if (!acc.find(item => item.esim_iccid === order.esim_iccid)) {
        acc.push(order);
      }
      return acc;
    }, [] as Order[]);
    
    try {
      // Process in batches of 5 to avoid overwhelming edge functions
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < uniqueItems.length; i += batchSize) {
        batches.push(uniqueItems.slice(i, i + batchSize));
      }
      
      const allResults = [];
      for (const batch of batches.slice(0, 5)) { // Max 25 ICCIDs total
        const batchResults = await Promise.allSettled(batch.map(async (o) => {
          // Check cache first
          if (statusCache[o.esim_iccid]) {
            return statusCache[o.esim_iccid];
          }
          const supplierName = o.esim_plans?.supplier_name?.toLowerCase();
          const isMaya = supplierName === 'maya' || (o.real_status && o.real_status.includes('state'));

          try {
            if (isMaya) {
              // For Maya eSIMs, use the Maya status API
              const { data, error } = await supabase.functions.invoke('get-maya-esim-status', {
                body: { iccid: o.esim_iccid }
              });
              if (!error && data?.success) {
                const networkStatus = data.status?.network_status || data.status?.esim?.network_status;
                const state = data.status?.state || data.status?.esim?.state;
                // For Maya: Connected requires network_status === 'ENABLED' and state !== 'RELEASED'
                const connected = (networkStatus === 'ENABLED' && state !== 'RELEASED');
                const result = { iccid: o.esim_iccid, status: data.status?.network_status || 'unknown', connected, details: data };
                setStatusCache(prev => ({ ...prev, [o.esim_iccid]: result }));
                return result;
              }
            } else {
              // For eSIM Access eSIMs, use the general status API
              const { data, error } = await supabase.functions.invoke('get-esim-details', {
                body: { iccid: o.esim_iccid }
              });
              
              // Handle provider API busy error gracefully
              if (error && data?.retryable) {
                console.log(`Provider API temporarily busy for ${o.esim_iccid}, using fallback`);
                return { iccid: o.esim_iccid, status: 'checking', connected: false };
              }
              
              if (!error && (data?.success === true || String(data?.success).toLowerCase() === 'true')) {
                const status = data?.obj?.status || data?.obj?.esimStatus || 'unknown';
                // For eSIM Access: Check obj.network.connected
                const connected = Boolean(data?.obj?.network?.connected);
                const result = { iccid: o.esim_iccid, status, connected, details: data };
                setStatusCache(prev => ({ ...prev, [o.esim_iccid]: result }));
                return result;
              }
            }
          } catch (apiError) {
            console.warn(`API call failed for ${o.esim_iccid}:`, apiError);
          }

          return { iccid: o.esim_iccid, status: 'unknown', connected: false };
        }));
        
        allResults.push(...batchResults);
        
        // Small delay between batches to avoid overwhelming the API
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const map: Record<string, string> = {};
      let connectedCount = 0;
      allResults.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          map[r.value.iccid] = r.value.status;
          if (r.value.connected) connectedCount += 1;
        }
      });
      
      if (mountedRef.current) {
        setStatusMap(prev => ({ ...prev, ...map }));
        setActiveESims(connectedCount);
      }
    } catch (e) {
      console.error('Failed to fetch eSIM statuses', e);
    }
  };
  
  const fetchHighUsageESims = async (ordersData: Order[]) => {
    const completedOrdersWithESims = ordersData.filter(o => 
      o.status === "completed" && o.esim_iccid
    );

    // Limit initial load to first 10 orders to speed up page load
    const ordersToCheck = completedOrdersWithESims.slice(0, 10);
    const highUsageESims: HighDataUsageESim[] = [];

    // Check each eSIM for high data usage, using cached results when available
    for (const order of ordersToCheck) {
      try {
        let eSimDetails;
        
        // Check if we already have this data in cache from status fetch
        if (statusCache[order.esim_iccid]?.details) {
          eSimDetails = statusCache[order.esim_iccid].details;
        } else {
          // Only make API call if not in cache
          const { data, error } = await supabase.functions.invoke('get-esim-details', {
            body: { iccid: order.esim_iccid }
          });
          
          if (error || !data?.success) {
            console.warn(`Failed to fetch usage for eSIM ${order.esim_iccid}`);
            continue;
          }
          eSimDetails = data;
        }

        if (eSimDetails?.success && eSimDetails.obj) {
          const usage = eSimDetails.obj;
          // Calculate data usage percentage
          const totalData = usage.dataAmount || usage.dataUsage?.total || 1;
          const usedData = usage.usedData || usage.dataUsage?.used || 0;
          const usagePercentage = (Number(usedData) / Number(totalData)) * 100;

          // Only include eSIMs with 80%+ usage
          if (usagePercentage >= 80) {
            highUsageESims.push({
              iccid: order.esim_iccid,
              plan_name: order.esim_plans?.title || "Unknown Plan",
              country_name: order.esim_plans?.country_name || "Unknown",
              data_used_percentage: usagePercentage,
              customer_name: order.customer_name || "Customer Name",
              customer_email: order.customer_email || "customer@example.com",
            });
          }
        }
      } catch (error) {
        console.error(`Failed to fetch usage for eSIM ${order.esim_iccid}:`, error);
      }
    }

    if (mountedRef.current) {
      setHighUsageESims(highUsageESims);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6 animate-fade-in">
          <div className="space-y-2">
            <div className="h-8 w-64 skeleton"></div>
            <div className="h-5 w-48 skeleton"></div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card p-6">
                <SkeletonCard />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }


  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        {/* Welcome Section */}
        {agentProfile ? (
          <div className="glass-intense p-8 text-left">
            <h1 className="text-4xl font-bold font-heading mb-2">
              Welcome back, {agentProfile.contact_person}! 👋
            </h1>
            <p className="text-xl text-muted-foreground">
              {agentProfile.company_name}
            </p>
            <div className="mt-4 text-sm text-muted-foreground">
              Dashboard overview • Real-time data
            </div>
          </div>
        ) : (
          <div className="glass-intense p-8 text-left">
            <h1 className="text-4xl font-bold font-heading mb-2">
              Complete Your Profile 📋
            </h1>
            <p className="text-xl text-muted-foreground">
              Please complete your agent profile to access the dashboard
            </p>
            <div className="mt-4 text-sm text-muted-foreground">
              Contact support if you need assistance
            </div>
          </div>
        )}

        {/* Dashboard Metrics */}
        <div className="grid gap-6 md:grid-cols-3">
          <MetricCard
            title="Total Orders"
            value={orders.length}
            description={`${orders.filter(o => o.status === "completed").length} completed`}
            icon={<ShoppingCart className="h-4 w-4" />}
            illustration="/illustrations/communication-new.png"
            trend={{
              value: orders.length > 0 ? 12 : 0,
              label: "vs last month"
            }}
          />
          
          <MetricCard
            title="Active eSIMs"
            value={activeESims}
            description="Connected to network"
            icon={<Smartphone className="h-4 w-4" />}
            illustration="/illustrations/connection-new.png"
            trend={{
              value: activeESims > 0 ? 8 : 0,
              label: "vs last week"
            }}
          />
          
          <MetricCard
            title="Wallet Balance"
            value={`$${agentProfile?.wallet_balance?.toFixed(2) || "0.00"}`}
            description="Available credit"
            icon={<DollarSign className="h-4 w-4" />}
            illustration="/illustrations/idea-new.png"
          />
        </div>

        {/* Orders Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              📊 eSIM Orders - Last 30 Days
            </CardTitle>
            <CardDescription>Daily order volume and trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--primary) / 0.1)' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="orders" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    className="hover-glow"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* High Data Usage Alert */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              eSIMs Requiring Attention
            </CardTitle>
            <CardDescription>
              eSIMs that have consumed 80%+ of their data allocation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {highUsageESims.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>ICCID</TableHead>
                    <TableHead>Data Usage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highUsageESims.map((esim, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{esim.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{esim.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{esim.plan_name}</p>
                          <p className="text-sm text-muted-foreground">{esim.country_name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {esim.iccid}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-orange-500 h-2 rounded-full" 
                              style={{ width: `${esim.data_used_percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {esim.data_used_percentage.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No eSIMs require attention</p>
                <p className="text-sm text-muted-foreground">All eSIMs are operating within normal data usage limits</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order History */}
        <Card>
          <CardHeader>
            <CardTitle>Order History</CardTitle>
            <CardDescription>Recent eSIM orders</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>eSIM Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(0, 10).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        {format(new Date(order.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.esim_plans?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.esim_plans?.country_name} • {order.esim_plans?.data_amount}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">USD {Number(order.retail_price).toFixed(2)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={statusMap[order.esim_iccid] || order.status} variant="with-icon" />
                      </TableCell>
                      <TableCell>
                        {order.esim_iccid ? (
                          <div className="text-sm">
                            <p>ICCID: {order.esim_iccid.slice(0, 10)}...</p>
                            {order.activation_code && (
                              <p>Code: {order.activation_code}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No orders found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}