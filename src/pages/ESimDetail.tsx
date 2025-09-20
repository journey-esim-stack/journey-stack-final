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
  MoreHorizontal,
  Share2,
  MessageSquare,
  Mail,
  RefreshCw,
  Key
} from "lucide-react";
import TopupModal from "@/components/TopupModal";
import { format } from "date-fns";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import QRCode from "qrcode";
import QRCodeGenerator from "@/components/QRCodeGenerator";

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
  supplier_name?: string;
}

interface TopupHistory {
  id: string;
  package_code: string;
  amount: number;
  data_amount: string;
  validity_days: number;
  status: string;
  created_at: string;
}

const ESimDetail = () => {
  const { iccid } = useParams();
  const navigate = useNavigate();
  const [esimDetails, setEsimDetails] = useState<ESIMDetails | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [topupHistory, setTopupHistory] = useState<TopupHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [agentBranding, setAgentBranding] = useState({
    companyName: "",
    message: "",
    contactInfo: ""
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (iccid) {
      fetchESIMDetails();
    }
  }, [iccid]);

  // Set up real-time subscriptions for immediate updates
  useEffect(() => {
    if (!iccid) return;

    // Subscribe to orders table changes for this ICCID
    const ordersChannel = supabase
      .channel('esim-orders-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `esim_iccid=eq.${iccid}`
        },
        (payload) => {
          console.log('Order updated:', payload);
          fetchESIMDetails(); // Refresh data when order updates
        }
      )
      .subscribe();

    // Subscribe to esim_status_events for real-time status updates
    const statusChannel = supabase
      .channel('esim-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'esim_status_events',
          filter: `iccid=eq.${iccid}`
        },
        (payload) => {
          console.log('eSIM status updated:', payload);
          fetchESIMDetails(); // Refresh data when status changes
        }
      )
      .subscribe();

    // Fallback polling for API data (less frequent since we have real-time for status)
    const interval = setInterval(() => {
      fetchESIMDetails();
    }, 30000); // Refresh every 30 seconds as fallback

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(statusChannel);
      clearInterval(interval);
    };
  }, [iccid]);

  const fetchESIMDetails = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    try {
      // Fetch order information, top-up history, and real-time status in parallel
      const [orderResponse, topupResponse, statusResponse] = await Promise.all([
        supabase
          .from("orders")
          .select(`
            *,
            esim_plans (
              id,
              title,
              country_name,
              country_code,
              data_amount,
              validity_days,
              supplier_name
            )
          `)
          .eq("esim_iccid", iccid)
          .single(),
        supabase
          .from("esim_topups")
          .select("*")
          .eq("iccid", iccid)
          .order("created_at", { ascending: false }),
        supabase
          .from("esim_status_events")
          .select("*")
          .eq("iccid", iccid)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      const { data: orderData, error: orderError } = orderResponse;
      const { data: topupData, error: topupError } = topupResponse;
      const { data: statusData, error: statusError } = statusResponse;

      if (orderError) {
        console.error("Error fetching order:", orderError);
        toast.error("Failed to fetch eSIM information");
        return;
      }

      setOrderInfo(orderData);
      
      if (!topupError && topupData) {
        setTopupHistory(topupData);
      }

      // Fetch real-time details from provider API
      const { data: apiData, error: apiError } = await supabase.functions.invoke('get-esim-details', {
        body: { iccid }
      });

      if (apiError || !apiData?.success) {
        console.error("Error fetching eSIM details:", apiError);
        
        // Use real-time status data when available, or fall back to basic data
        const currentStatus = statusData?.esim_status || orderData.real_status || (orderData.status === 'completed' ? "Ready" : "New");
        const isActive = currentStatus === 'IN_USE';
        const expiryDate = orderData.esim_expiry_date || 
          (isActive ? new Date(Date.now() + (orderData.esim_plans?.validity_days || 30) * 24 * 60 * 60 * 1000).toISOString() : null);

        const basicDetails: ESIMDetails = {
          iccid: iccid || "",
          status: currentStatus,
          data_usage: {
            used: 0,
            total: parseFloat(orderData.esim_plans?.data_amount?.replace(/[^\d.]/g, '') || "3"),
            unit: "GB"
          },
          network: {
            connected: isActive,
            operator: isActive ? "Connected" : "Not Connected",
            country: orderData.esim_plans?.country_name || "Unknown",
            signal_strength: isActive ? 85 : 0
          },
          plan: {
            name: orderData.esim_plans?.title || "Unknown Plan",
            validity: orderData.esim_plans?.validity_days || 30,
            data_amount: orderData.esim_plans?.data_amount || "3GB",
            expires_at: expiryDate || new Date(Date.now() + (orderData.esim_plans?.validity_days || 30) * 24 * 60 * 60 * 1000).toISOString(),
            plan_id: orderData.esim_plans?.id || ""
          },
          activation: {
            qr_code: orderData.esim_qr_code || "",
            manual_code: orderData.manual_code || orderData.activation_code || "",
            sm_dp_address: orderData.smdp_address || "consumer.e-sim.global"
          },
          sessions: [],
          supplier_name: orderData.esim_plans?.supplier_name || ""
        };
        setEsimDetails(basicDetails);
      } else {
        // Use real-time status data when available, prioritizing webhook data
        const realtimeStatus = statusData?.esim_status || orderData.real_status;
        const apiStatus = apiData.obj?.status;
        const currentStatus = realtimeStatus || apiStatus || "Unknown";
        const isActive = currentStatus === 'IN_USE';
        const expiryDate = orderData.esim_expiry_date || apiData.obj?.plan?.expiresAt;

        // Transform API response to match our interface
        const transformedData: ESIMDetails = {
          iccid: apiData.obj?.iccid || iccid || "",
          status: currentStatus,
          data_usage: {
            used: parseFloat(apiData.obj?.dataUsage?.used || "0"),
            total: parseFloat(apiData.obj?.dataUsage?.total || orderData.esim_plans?.data_amount?.replace(/[^\d.]/g, '') || "3"),
            unit: "GB"
          },
          network: {
            connected: isActive || apiData.obj?.network?.connected || false,
            operator: isActive ? (apiData.obj?.network?.operator || "Network Operator") : "Not Connected",
            country: apiData.obj?.network?.country || orderData.esim_plans?.country_name || "Unknown",
            signal_strength: isActive ? parseInt(apiData.obj?.network?.signalStrength || "85") : 0
          },
          plan: {
            name: orderData.esim_plans?.title || "Unknown Plan",
            validity: orderData.esim_plans?.validity_days || 30,
            data_amount: orderData.esim_plans?.data_amount || "3GB",
            expires_at: expiryDate || new Date(Date.now() + (orderData.esim_plans?.validity_days || 30) * 24 * 60 * 60 * 1000).toISOString(),
            plan_id: orderData.esim_plans?.id || ""
          },
          activation: {
            qr_code: orderData.esim_qr_code || "",
            manual_code: orderData.manual_code || orderData.activation_code || "",
            sm_dp_address: orderData.smdp_address || "consumer.e-sim.global"
          },
          sessions: apiData.obj?.sessions || [],
          supplier_name: orderData.esim_plans?.supplier_name || ""
        };
        setEsimDetails(transformedData);
      }

    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while fetching eSIM details");
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setIsRefreshing(false);
        toast.success("eSIM data refreshed");
      }
    }
  };

  const handleManualRefresh = () => {
    fetchESIMDetails(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const generateShareMessage = () => {
    const planName = esimDetails?.plan?.name || "eSIM Plan";
    const companyBranding = agentBranding.companyName ? `${agentBranding.companyName}\n\n` : "";
    const message = agentBranding.message || `Here is your ${planName} activation details:`;
    const contactInfo = agentBranding.contactInfo ? `\n\nFor support: ${agentBranding.contactInfo}` : "";
    
    return `${companyBranding}${message}

Plan: ${planName}
QR Code: ${esimDetails?.activation?.qr_code || ""}
Manual Activation Code: ${esimDetails?.activation?.manual_code || ""}

IMPORTANT - Check your device eSIM compatibility:

📞 Dial *#06#
👀 Look for your device's unique eSIM ID (EID)
✅ If you see it, your phone is eSIM compatible!

Instructions:
• Scan the QR code with your Camera app
• Follow prompts to add the new Data Plan
• Turn on Data Roaming for the new eSIM${contactInfo}`;
  };

  const handleShare = (method: 'copy' | 'whatsapp' | 'email') => {
    const shareText = generateShareMessage();
    
    switch (method) {
      case 'copy':
        copyToClipboard(shareText, "Share message");
        break;
      case 'whatsapp':
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        window.open(whatsappUrl, '_blank');
        break;
      case 'email':
        const planName = esimDetails?.plan?.name || "eSIM Plan";
        const subject = `Your ${planName} Activation Details`;
        const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`;
        window.open(emailUrl);
        break;
    }
    
    setShowShareModal(false);
    toast.success(`Shared via ${method === 'copy' ? 'clipboard' : method}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
      case "activated":
      case "installed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "connected":
        return <Signal className="h-4 w-4 text-green-600" />;
      case "new":
      case "pending":
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case "expired":
      case "cancelled":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
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
                    <Badge className={`${esimDetails.network.connected ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-gray-500/10 text-gray-600 border-gray-500/20'} inline-flex items-center gap-1 mt-1`}>
                      {getStatusIcon(esimDetails.network.connected ? "connected" : "disconnected")}
                      {esimDetails.network.connected ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data Usage</p>
                    <p className="text-sm font-medium">{esimDetails.data_usage.used.toFixed(2)} / {esimDetails.data_usage.total} {esimDetails.data_usage.unit}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Usage Progress */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Data Usage Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used: {esimDetails.data_usage.used.toFixed(2)} {esimDetails.data_usage.unit}</span>
                    <span>Remaining: {remainingData.toFixed(2)} {esimDetails.data_usage.unit}</span>
                  </div>
                  <Progress value={usagePercentage} className="h-3" />
                  <p className="text-xs text-muted-foreground">
                    {usagePercentage.toFixed(1)}% of your data plan has been used
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activation" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* QR Code Section */}
              <div className="bg-card p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  QR Code
                </h3>
                <div className="flex flex-col items-center space-y-4">
                  {esimDetails.activation.qr_code ? (
                    <div className="flex flex-col items-center space-y-4">
                      {esimDetails.supplier_name === 'maya' ? (
                        <QRCodeGenerator value={esimDetails.activation.qr_code} />
                      ) : (
                        <img 
                          src={esimDetails.activation.qr_code} 
                          alt="eSIM QR Code" 
                          className="w-48 h-48 border rounded-lg"
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(esimDetails.activation.qr_code, "QR Code")}
                        className="flex items-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy QR Code
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <QrCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>QR Code not available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Activation Section */}
              <div className="bg-card p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Manual Activation
                </h3>
                <div className="space-y-4">
                  {esimDetails.supplier_name === 'maya' ? (
                    // Maya-specific activation codes
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-primary">
                          For iOS Devices
                        </label>
                        {esimDetails.activation.manual_code && esimDetails.activation.sm_dp_address ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">
                                SM-DP+ Address
                              </label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                                  {esimDetails.activation.sm_dp_address}
                                </code>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyToClipboard(esimDetails.activation.sm_dp_address, "SM-DP+ Address")}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">
                                Activation Code
                              </label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                                  {esimDetails.activation.manual_code}
                                </code>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyToClipboard(esimDetails.activation.manual_code, "iOS Activation Code")}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">iOS activation codes not available</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-primary">
                          For Android Devices
                        </label>
                        {esimDetails.activation.qr_code ? (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">
                              LPA String
                            </label>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                                {esimDetails.activation.qr_code}
                              </code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(esimDetails.activation.qr_code, "Android LPA String")}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Android activation code not available</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Standard activation code for other providers
                    esimDetails.activation.manual_code ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                          Activation Code
                        </label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-3 bg-muted rounded-lg text-sm font-mono break-all">
                            {esimDetails.activation.manual_code}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(esimDetails.activation.manual_code, "Activation Code")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Activation code not available</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Installation Instructions */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Installation Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-primary mb-3">📱 For iOS Devices</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Go to Settings → Cellular → Add eSIM</li>
                      <li>Scan the QR code with your camera</li>
                      <li>Or manually enter the SM-DP+ address and activation code</li>
                      <li>Follow the on-screen prompts</li>
                      <li>Label your new eSIM plan</li>
                      <li>Turn on Data Roaming for the new eSIM</li>
                    </ol>
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary mb-3">🤖 For Android Devices</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Go to Settings → Network & Internet → Mobile Network</li>
                      <li>Tap "Add carrier" or "Add eSIM"</li>
                      <li>Scan the QR code with your camera</li>
                      <li>Or use "Enter manually" and paste the LPA string</li>
                      <li>Follow the setup prompts</li>
                      <li>Enable Data Roaming for the new eSIM</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Detailed Usage Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Detailed usage analytics and session history will appear here once the eSIM is activated and starts consuming data.
                </p>
                {esimDetails.sessions && esimDetails.sessions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session Start</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Data Used</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {esimDetails.sessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell>{format(new Date(session.start_time), "yyyy-MM-dd HH:mm")}</TableCell>
                          <TableCell>
                            {session.end_time 
                              ? Math.round((new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / (1000 * 60)) + " min"
                              : "Ongoing"
                            }
                          </TableCell>
                          <TableCell>{session.data_used} MB</TableCell>
                          <TableCell>
                            <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                              {session.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <p className="text-muted-foreground">No usage data available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Top-up History Modal */}
        <TopupModal
          isOpen={showTopupModal}
          onClose={() => setShowTopupModal(false)}
          iccid={iccid || ""}
          onTopupComplete={() => {
            setShowTopupModal(false);
            fetchESIMDetails(); // Refresh data after topup
          }}
        />

        {/* Share Modal */}
        <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share eSIM Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company Name (Optional)</Label>
                <Input
                  id="company"
                  placeholder="Your Company Name"
                  value={agentBranding.companyName}
                  onChange={(e) => setAgentBranding(prev => ({ ...prev, companyName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Custom Message (Optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Here are your eSIM activation details..."
                  value={agentBranding.message}
                  onChange={(e) => setAgentBranding(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Info (Optional)</Label>
                <Input
                  id="contact"
                  placeholder="support@company.com or +1-555-0123"
                  value={agentBranding.contactInfo}
                  onChange={(e) => setAgentBranding(prev => ({ ...prev, contactInfo: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleShare('copy')} className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button onClick={() => handleShare('whatsapp')} variant="outline" className="flex-1">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button onClick={() => handleShare('email')} variant="outline" className="flex-1">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ESimDetail;