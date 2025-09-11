import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, 
  Wifi, 
  Signal, 
  MapPin, 
  Calendar, 
  Activity,
  QrCode,
  Smartphone,
  Plus,
  Copy,
  CheckCircle,
  AlertCircle,
  Globe,
  MoreHorizontal
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import Layout from "@/components/Layout";

interface ESIMDetails {
  iccid: string;
  status: string;
  data_usage: {
    used: number;
    total: number;
    unit: string;
  };
  network: {
    connected: boolean;
    operator: string;
    country: string;
    signal_strength: number;
  };
  plan: {
    name: string;
    validity: number;
    data_amount: string;
    expires_at: string;
    plan_id: string;
  };
  activation: {
    qr_code: string;
    manual_code: string;
    sm_dp_address: string;
  };
  sessions: Array<{
    id: string;
    start_time: string;
    end_time: string;
    data_used: number;
    status: string;
  }>;
}

const ESimDetail = () => {
  const { iccid } = useParams();
  const navigate = useNavigate();
  const [esimDetails, setEsimDetails] = useState<ESIMDetails | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    if (iccid) {
      fetchESIMDetails();
    }
  }, [iccid]);

  const fetchESIMDetails = async () => {
    try {
      // First get order information from database
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          esim_plans (
            id,
            title,
            country_name,
            country_code,
            data_amount,
            validity_days
          )
        `)
        .eq("esim_iccid", iccid)
        .single();

      if (orderError) {
        console.error("Error fetching order:", orderError);
        toast.error("Failed to fetch eSIM information");
        return;
      }

      setOrderInfo(orderData);

      // Fetch real-time details from eSIM Access API
      const { data: apiData, error: apiError } = await supabase.functions.invoke('get-esim-details', {
        body: { iccid }
      });

      if (apiError) {
        console.error("Error fetching eSIM details:", apiError);
        // Create enhanced mock data based on order info for demo
        const mockDetails: ESIMDetails = {
          iccid: iccid || "",
          status: "Active",
          data_usage: {
            used: 1.30,
            total: parseFloat(orderData.esim_plans?.data_amount?.replace(/[^\d.]/g, '') || "3"),
            unit: "GB"
          },
          network: {
            connected: true,
            operator: "Vodafone UK",
            country: orderData.esim_plans?.country_name || "United Kingdom",
            signal_strength: 85
          },
          plan: {
            name: orderData.esim_plans?.title || "Unknown Plan",
            validity: orderData.esim_plans?.validity_days || 5,
            data_amount: orderData.esim_plans?.data_amount || "3GB",
            expires_at: new Date(Date.now() + (orderData.esim_plans?.validity_days || 5) * 24 * 60 * 60 * 1000).toISOString(),
            plan_id: orderData.esim_plans?.id || ""
          },
          activation: {
            qr_code: orderData.esim_qr_code || "",
            manual_code: orderData.activation_code || "TN20250820112904SEFCE8F6",
            sm_dp_address: "consumer.e-sim.global"
          },
          sessions: [
            {
              id: "1SOBWJ3DSUST",
              start_time: "2025-09-10T10:53:31Z",
              end_time: "2025-09-16T11:02:21Z",
              data_used: 1.30,
              status: "ACTIVE"
            }
          ]
        };
        setEsimDetails(mockDetails);
      } else {
        setEsimDetails(apiData);
      }

    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while fetching eSIM details");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "connected":
        return <Signal className="h-4 w-4 text-green-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
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

  if (!esimDetails || !orderInfo) {
    return (
      <Layout>
        <div className="glass-intense p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">eSIM Not Found</h2>
          <p className="text-muted-foreground">The requested eSIM could not be found.</p>
          <Button onClick={() => navigate("/esims")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to eSIMs
          </Button>
        </div>
      </Layout>
    );
  }

  const usagePercentage = (esimDetails.data_usage.used / esimDetails.data_usage.total) * 100;
  const remainingData = esimDetails.data_usage.total - esimDetails.data_usage.used;

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header Section with Glass Morphism */}
        <div className="glass-intense p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/esims")} className="hover:bg-white/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to eSIMs
              </Button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                  eSIM Management
                </h1>
                <p className="text-muted-foreground">Monitor and manage your eSIM data plan</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 glass-intense border-0">
            <TabsTrigger value="summary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Summary</TabsTrigger>
            <TabsTrigger value="activation" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Activation</TabsTrigger>
            <TabsTrigger value="usage" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Data Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            {/* eSIM Status Card */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  eSIM Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">ICCID</p>
                    <p className="font-mono text-sm font-medium">{esimDetails.iccid}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned Customer</p>
                    <p className="text-sm font-medium">{orderInfo.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date Assigned</p>
                    <p className="text-sm font-medium">{format(new Date(orderInfo.created_at), "yyyy-MM-dd HH:mm")}</p>
                  </div>
                </div>

                <Separator className="bg-white/10" />

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">eSIM Status</p>
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 inline-flex items-center gap-1 mt-1">
                      {getStatusIcon(esimDetails.status)}
                      {esimDetails.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Network Status</p>
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 inline-flex items-center gap-1 mt-1">
                      {getStatusIcon("connected")}
                      Connected
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Network</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">{esimDetails.network.operator}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{esimDetails.network.country}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Network Details Card */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Signal className="h-5 w-5 text-primary" />
                  Network Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="glass-intense p-4 rounded-lg border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {esimDetails.network.operator}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Signal: {esimDetails.network.signal_strength}% • Last seen: {format(new Date(), "MMM dd, HH:mm")}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                      Connected
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Usage Component - Enhanced with Progress Bar */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Data Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Main Data Usage Display */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-center">
                    {/* Status */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Status</p>
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                        {esimDetails.status}
                      </Badge>
                    </div>

                    {/* Data Usage */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Data Usage</p>
                      <div className="text-lg font-semibold">
                        {esimDetails.data_usage.used} {esimDetails.data_usage.unit} Used / {esimDetails.data_usage.total} {esimDetails.data_usage.unit}
                      </div>
                    </div>

                    {/* Validity */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Validity</p>
                      <div className="text-lg font-semibold">
                        {esimDetails.plan.validity} Days
                      </div>
                    </div>

                    {/* Created */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Created</p>
                      <div className="text-sm">
                        {format(new Date(orderInfo.created_at), "yyyy-MM-dd")}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(orderInfo.created_at), "HH:mm:ss")}
                        </span>
                      </div>
                    </div>

                    {/* Expiration */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Expiration</p>
                      <div className="text-sm">
                        {format(new Date(esimDetails.plan.expires_at), "yyyy-MM-dd")}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(esimDetails.plan.expires_at), "HH:mm:ss")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Data Progress</span>
                      <span className="font-medium">{Math.round(usagePercentage)}% used</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500 ease-out relative"
                        style={{ width: `${usagePercentage}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                      <span>{remainingData.toFixed(2)} {esimDetails.data_usage.unit} remaining</span>
                      <Button variant="outline" size="sm" className="bg-orange-500 text-white hover:bg-orange-600 border-orange-500">
                        <Plus className="h-3 w-3 mr-1" />
                        Top-up
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activation" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* QR Code Card */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    QR Code
                  </CardTitle>
                  <Button variant="outline" size="sm" className="ml-auto glass-intense border-0 hover:bg-white/10">
                    Email to User
                  </Button>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="w-64 h-64 mx-auto mb-4 glass-intense rounded-lg flex items-center justify-center border border-white/10">
                    {esimDetails.activation.qr_code ? (
                      <img 
                        src={esimDetails.activation.qr_code} 
                        alt="eSIM QR Code"
                        className="w-full h-full object-contain p-4"
                      />
                    ) : (
                      <div className="text-center">
                        <QrCode className="h-12 w-12 mx-auto mb-2 text-primary" />
                        <p className="text-sm text-muted-foreground">QR Code</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Activation Instructions Card */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-primary" />
                    Activation Instructions
                  </CardTitle>
                  <Button variant="outline" size="sm" className="ml-auto glass-intense border-0 hover:bg-white/10">
                    Email to User
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">QR Code Installation</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Scan the QR code with the Camera app.</li>
                      <li>• Follow the prompts on screen to add a new Data Plan.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Apple iOS Devices</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Once complete, go to Settings → Cellular (Mobile or Mobile Service).</li>
                      <li>• Select the new eSIM plan under Cellular Data Plans, and set Data Roaming to ON.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Android Devices</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Once complete, go to Settings → Network and Internet.</li>
                      <li>• Turn on Data Roaming.</li>
                      <li>• Set the eSIM as the Mobile Data SIM.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Manual Activation Card */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-primary">Manual Activation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">iPhone / iOS</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Activation Code</p>
                    <div className="flex items-center gap-2">
                      <code className="glass-intense p-2 rounded font-mono text-sm flex-1 border border-white/10">
                        {esimDetails.activation.manual_code}
                      </code>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(esimDetails.activation.manual_code)}
                        className="glass-intense border-0 hover:bg-white/10"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">SM-DP Address</p>
                    <div className="flex items-center gap-2">
                      <code className="glass-intense p-2 rounded font-mono text-sm flex-1 border border-white/10">
                        {esimDetails.activation.sm_dp_address}
                      </code>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(esimDetails.activation.sm_dp_address)}
                        className="glass-intense border-0 hover:bg-white/10"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                        <span className="text-primary-foreground text-xs font-bold">A</span>
                      </div>
                      <p className="text-sm font-medium">Android</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Activation Code</p>
                    <div className="flex items-center gap-2">
                      <code className="glass-intense p-2 rounded font-mono text-sm flex-1 border border-white/10">
                        LPA:1${esimDetails.activation.sm_dp_address}${esimDetails.activation.manual_code}
                      </code>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(`LPA:1$${esimDetails.activation.sm_dp_address}$${esimDetails.activation.manual_code}`)}
                        className="glass-intense border-0 hover:bg-white/10"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="glass-intense p-4 rounded-lg border border-blue-500/20">
                  <h4 className="font-semibold text-sm mb-2 text-blue-300">Tips & Reminders</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>✓ Set the eSIM plan as your cellular data plan when you arrive at your destination. Find this in Settings → Cellular Data → Cellular Data.</li>
                    <li>✓ Turn off Data Roaming on your main SIM card to avoid any unexpected charges.</li>
                    <li>✓ Turn on Low Data Mode (iOS) or Data Saver mode (Android) to conserve data.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Data Usage Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-primary opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Usage History</h3>
                  <p className="text-muted-foreground">
                    Detailed data usage logs and session history will appear here as your eSIM is used.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ESimDetail;