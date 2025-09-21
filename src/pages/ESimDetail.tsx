import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  RefreshCw
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

// QR Code Display Component
const QRCodeDisplay = ({ qrText, size = 256 }: { qrText: string; size?: number }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateQR = async () => {
      if (!qrText) return;
      
      try {
        setIsLoading(true);
        // Generate QR code from text
        const dataUrl = await QRCode.toDataURL(qrText, {
          margin: 1,
          scale: 6,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateQR();
  }, [qrText]);

  if (!qrText) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="text-center">
          <QrCode className="h-12 w-12 mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">No QR Code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 h-64 mx-auto mb-4 glass-intense rounded-lg flex items-center justify-center border border-white/10">
      {isLoading ? (
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      ) : qrDataUrl ? (
        <img 
          src={qrDataUrl} 
          alt="eSIM QR Code"
          className="w-full h-full object-contain p-4"
        />
      ) : (
        <div className="text-center">
          <QrCode className="h-12 w-12 mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Failed to generate QR</p>
        </div>
      )}
    </div>
  );
};

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
    expires_at: string | null; // Can be null for non-connected Maya eSIMs
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
  const { toast } = useToast();
  const [esimDetails, setEsimDetails] = useState<ESIMDetails | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [topupHistory, setTopupHistory] = useState<TopupHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Real-time subscription for status updates
  useEffect(() => {
    if (!iccid) return;

    const channel = supabase
      .channel('esim-detail-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `esim_iccid=eq.${iccid}`
        },
        (payload) => {
          console.log('Real-time order update for current eSIM:', payload);
          // Refresh data when this specific eSIM is updated
          fetchESIMDetails();
          toast({
            title: "Status Updated",
            description: "eSIM status has been updated in real-time",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [iccid]);
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

  // Set up real-time subscriptions and polling for Maya eSIMs
  useEffect(() => {
    if (!iccid) return;

    const isMayaEsim = orderInfo?.esim_plans?.supplier_name?.toLowerCase() === 'maya';

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
          
          // For Maya eSIMs, parse real_status and update immediately
          if (isMayaEsim && payload.new.real_status !== payload.old.real_status) {
            try {
              const mayaData = JSON.parse(payload.new.real_status || '{}');
              const networkStatus = mayaData.network_status || mayaData.esim?.network_status;
              
              console.log('Real-time Maya network_status update:', networkStatus);
              
              if (networkStatus) {
                setEsimDetails(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    status: networkStatus, // Use network_status directly
                    network: {
                      ...prev.network,
                      connected: networkStatus === 'ENABLED'
                    }
                  };
                });
              }
            } catch (e) {
              console.error('Failed to parse real_status JSON:', e);
            }
          } else {
            fetchESIMDetails(); // Refresh data for non-Maya or on other changes
          }
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

    // Enhanced polling for Maya eSIMs (every 10 seconds)
    const interval = setInterval(() => {
      if (isMayaEsim) {
        // For Maya, poll the API directly to get latest network_status
        supabase.functions.invoke('get-maya-esim-status', {
          body: { iccid }
        }).then(({ data, error }) => {
          if (!error && data?.success) {
            const networkStatus = data.status?.network_status || data.esim?.network_status;
            console.log('Polled Maya network_status:', networkStatus);
            
            if (networkStatus) {
              setEsimDetails(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  status: networkStatus, // Use network_status directly  
                  network: {
                    ...prev.network,
                    connected: networkStatus === 'ENABLED'
                  }
                };
              });
            }
          }
        });
      } else {
        fetchESIMDetails();
      }
    }, 10000);

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(statusChannel);
      clearInterval(interval);
    };
  }, [iccid, orderInfo?.esim_plans?.supplier_name]);

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
        toast({ title: "Error", description: "Failed to fetch eSIM information", variant: "destructive" });
        return;
      }

      setOrderInfo(orderData);
      
      if (!topupError && topupData) {
        setTopupHistory(topupData);
      }

      // Check if this is a Maya eSIM and use appropriate API
      const supplier = String(orderData.esim_plans?.supplier_name || '').toLowerCase();
      const isMayaEsim = supplier === 'maya';
      const functionName = isMayaEsim ? 'get-maya-esim-status' : 'get-esim-details';
      
      console.log('ESimDetail - isMayaEsim:', isMayaEsim, 'supplier_name:', orderData.esim_plans?.supplier_name);
      
      // Fetch real-time details from provider API
      const { data: apiData, error: apiError } = await supabase.functions.invoke(functionName, {
        body: { iccid }
      });

      console.log('ESimDetail - API Response:', apiData);

      if (apiError || !apiData?.success) {
        console.error("Error fetching eSIM details:", apiError);
        
        // Robust fallback: use stored real_status (JSON) and Maya mapping
        const raw = orderData.real_status || (orderData.status === 'completed' ? "Ready" : "New");
        let currentStatusText = String(raw || 'Unknown');
        let isActive = false;
        let networkStatusVal: string | undefined;
        let networkConnected = false;

        if (isMayaEsim) {
          try {
            const parsed = typeof raw === 'string' && raw.trim().startsWith('{') ? JSON.parse(raw) : raw;
            const stateVal = parsed?.state;
            networkStatusVal = parsed?.network_status;
            // Map using Maya rules: if state is RELEASED and network is ENABLED => NOT_ACTIVE (awaiting)
            if (stateVal === 'RELEASED' && networkStatusVal === 'ENABLED') {
              currentStatusText = 'NOT_ACTIVE';
              networkConnected = false;
              isActive = false;
            } else {
              if (networkStatusVal) {
                currentStatusText = networkStatusVal;
              }
              networkConnected = networkStatusVal === 'ENABLED' && stateVal !== 'RELEASED';
              isActive = networkConnected;
            }
          } catch {
            // If parsing fails, fall back to simple text
            isActive = /IN_USE|Active|ENABLED/i.test(currentStatusText);
            networkConnected = /ENABLED|Active|IN_USE/i.test(currentStatusText);
          }
        } else {
          // Non-Maya fallback
          isActive = currentStatusText === 'IN_USE';
          networkConnected = isActive;
        }

        // For Maya eSIMs: Only set expiry date if network is ENABLED (connected)
        const shouldHaveExpiryDate = isMayaEsim ? networkConnected : isActive;
        const expiryDate = shouldHaveExpiryDate 
          ? (orderData.esim_expiry_date || new Date(Date.now() + (orderData.esim_plans?.validity_days || 30) * 24 * 60 * 60 * 1000).toISOString())
          : null;

        const basicDetails: ESIMDetails = {
          iccid: iccid || "",
          status: currentStatusText,
          data_usage: {
            used: 0,
            total: parseFloat(orderData.esim_plans?.data_amount?.replace(/[^\d.]/g, '') || "3"),
            unit: "GB"
          },
          network: {
            connected: networkConnected,
            operator: isMayaEsim ? (networkConnected ? "Connected to Network" : "Not Connected") : (networkConnected ? "Connected" : "Not Connected"),
            country: orderData.esim_plans?.country_name || "Unknown",
            signal_strength: networkConnected ? 85 : 0
          },
          plan: {
            name: orderData.esim_plans?.title || "Unknown Plan",
            validity: orderData.esim_plans?.validity_days || 30,
            data_amount: orderData.esim_plans?.data_amount || "3GB",
            expires_at: expiryDate,
            plan_id: orderData.esim_plans?.id || ""
          },
          activation: {
            qr_code: orderData.esim_qr_code || "",
            manual_code: (orderData as any).manual_code || orderData.activation_code || "",
            sm_dp_address: (orderData as any).smdp_address || "consumer.e-sim.global"
          },
          sessions: []
        };
        setEsimDetails(basicDetails);
      } else {
        // Use real-time status data when available, prioritizing webhook data
        const realtimeStatus = statusData?.esim_status || orderData.real_status;
        let currentStatus = realtimeStatus || "Unknown";
        
        console.log('ESimDetail - Before Maya processing:', {
          isMayaEsim,
          realtimeStatus,
          currentStatus,
          mayaApiData: isMayaEsim ? apiData.status : null
        });
        
        // Maya status mapping: use network_status but override when state is RELEASED
        if (isMayaEsim && apiData.status) {
          const mayaStatus = apiData.status;
          const state = mayaStatus.state;
          const networkStatus = mayaStatus.network_status;
          
          console.log('ESimDetail - Maya status fields:', { state, networkStatus });
          
          if (state === 'RELEASED' && networkStatus === 'ENABLED') {
            currentStatus = 'NOT_ACTIVE'; // Awaiting activation
          } else {
            currentStatus = networkStatus || 'Unknown';
          }
          
          console.log('ESimDetail - Maya mapped status:', currentStatus);
        } else if (!isMayaEsim) {
          // For eSIM Access, use existing logic
          const apiStatus = apiData.obj?.status;
          currentStatus = realtimeStatus || apiStatus || "Unknown";
        }
        
        // Determine if active based on status
        const isActive = isMayaEsim
          ? (apiData.status?.network_status === 'ENABLED' && apiData.status?.state !== 'RELEASED')
          : currentStatus === 'IN_USE';
        
        // For Maya, 'Connected' requires network_status === 'ENABLED' and state not RELEASED
        const networkConnected = isMayaEsim
          ? (apiData.status?.network_status === 'ENABLED' && apiData.status?.state !== 'RELEASED')
          : (isActive || apiData.obj?.network?.connected || false);
        
        // For Maya eSIMs: Only set expiry date if network is ENABLED (connected)
        const shouldHaveExpiryDate = isMayaEsim ? networkConnected : isActive;
        const expiryDate = shouldHaveExpiryDate 
          ? (orderData.esim_expiry_date || apiData.obj?.plan?.expiresAt)
          : null;

        console.log('ESimDetail - Final status for transform:', currentStatus);

        // Transform API response to match our interface
        const transformedData: ESIMDetails = {
          iccid: (isMayaEsim ? (apiData.status?.iccid || iccid) : (apiData.obj?.iccid || iccid)) || "",
          status: currentStatus,
          data_usage: {
            used: parseFloat((!isMayaEsim ? apiData.obj?.dataUsage?.used : undefined) || "0"),
            total: parseFloat((!isMayaEsim ? apiData.obj?.dataUsage?.total : undefined) || orderData.esim_plans?.data_amount?.replace(/[^\d.]/g, '') || "3"),
            unit: "GB"
          },
          network: {
            connected: networkConnected,
            operator: isMayaEsim
              ? (networkConnected ? "Connected to Network" : "Not Connected")
              : (networkConnected ? (apiData.obj?.network?.operator || "Network Operator") : "Not Connected"),
            country: (!isMayaEsim ? (apiData.obj?.network?.country) : undefined) || orderData.esim_plans?.country_name || "Unknown",
            signal_strength: (isMayaEsim ? (networkConnected ? 85 : 0) : (networkConnected ? parseInt(apiData.obj?.network?.signalStrength || "85") : 0))
          },
          plan: {
            name: orderData.esim_plans?.title || "Unknown Plan",
            validity: orderData.esim_plans?.validity_days || 30,
            data_amount: orderData.esim_plans?.data_amount || "3GB",
            expires_at: expiryDate, // Will be null if not connected for Maya eSIMs
            plan_id: orderData.esim_plans?.id || ""
          },
          activation: {
            qr_code: orderData.esim_qr_code || "",
            manual_code: (orderData as any).manual_code || orderData.activation_code || "",
            sm_dp_address: (orderData as any).smdp_address || "consumer.e-sim.global"
          },
          sessions: []
        };
        setEsimDetails(transformedData);
      }

    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "An error occurred while fetching eSIM details", variant: "destructive" });
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setIsRefreshing(false);
        toast({ title: "Success", description: "eSIM data refreshed" });
      }
    }
  };

  const handleManualRefresh = () => {
    fetchESIMDetails(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Success", description: "Copied to clipboard" });
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
        copyToClipboard(shareText);
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
    toast({ title: "Success", description: `Shared via ${method === 'copy' ? 'clipboard' : method}` });
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
      case "activated":
      case "installed":
      case "enabled":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "connected":
        return <Signal className="h-4 w-4 text-green-600" />;
      case "new":
      case "pending":
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case "expired":
      case "cancelled":
      case "disabled":
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
                    <p className="text-sm text-muted-foreground">Network</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-3 h-3 rounded-full ${esimDetails.network.connected ? 'bg-green-500' : 'bg-gray-500'}`}></div>
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
                <div className={`glass-intense p-4 rounded-lg border ${esimDetails.network.connected ? 'border-green-500/20' : 'border-gray-500/20'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${esimDetails.network.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {esimDetails.network.operator}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {esimDetails.network.connected 
                            ? `Last seen: ${format(new Date(), "MMM dd, HH:mm")}`
                            : "Not connected to network"
                          }
                        </p>
                      </div>
                    </div>
                    <Badge className={`${esimDetails.network.connected ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-gray-500/10 text-gray-600 border-gray-500/20'}`}>
                      {esimDetails.network.connected ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Usage Component - Enhanced with Progress Bar */}
            <Card className="glass-card">
               <CardHeader>
                 <CardTitle className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Activity className="h-5 w-5 text-primary" />
                     Data Usage
                   </div>
                   <Button 
                     variant="ghost" 
                     size="sm" 
                     onClick={handleManualRefresh}
                     disabled={isRefreshing}
                     className="hover:bg-white/10"
                   >
                     <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                   </Button>
                 </CardTitle>
               </CardHeader>
              <CardContent className="space-y-4">
                {/* Top-up History - Show newest first */}
                {topupHistory.length > 0 && topupHistory.map((topup) => (
                  <div key={topup.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    {/* Status */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Status</p>
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        {topup.status}
                      </Badge>
                    </div>

                    {/* Data Usage */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Data Usage</p>
                      <div className="text-sm font-semibold">
                        0 GB Used / {topup.data_amount}
                      </div>
                    </div>

                    {/* Data Progress */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Data Progress</p>
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-xs text-muted-foreground">
                          {topup.data_amount} left
                        </div>
                      </div>
                    </div>

                    {/* Validity */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Validity</p>
                      <div className="text-sm font-semibold">
                        {topup.validity_days} Days
                      </div>
                    </div>

                    {/* Created */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Created</p>
                      <div className="text-sm">
                        {format(new Date(topup.created_at), "yyyy-MM-dd")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(topup.created_at), "HH:mm:ss")}
                      </div>
                    </div>

                    {/* Expiration (show only when connected) */}
                    {esimDetails.network.connected && (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Expiration</p>
                        <div className="text-sm">
                          {format(new Date(new Date(topup.created_at).getTime() + topup.validity_days * 24 * 60 * 60 * 1000), "yyyy-MM-dd")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(new Date(topup.created_at).getTime() + topup.validity_days * 24 * 60 * 60 * 1000), "HH:mm:ss")}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Original Plan - Always show at bottom */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center p-4 bg-background/50 rounded-lg border">
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
                    <div className="text-sm font-semibold">
                      {esimDetails.data_usage.used} {esimDetails.data_usage.unit} Used / {esimDetails.data_usage.total} {esimDetails.data_usage.unit}
                    </div>
                  </div>

                  {/* Data Progress */}
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Data Progress</p>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-24 bg-secondary/30 rounded-full h-2 overflow-hidden border border-border">
                        <div 
                          className={`h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500 ease-out ${usagePercentage === 0 ? 'w-0' : ''}`}
                          style={{ width: `${Math.max(usagePercentage, 0)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {remainingData.toFixed(2)} {esimDetails.data_usage.unit} left
                      </span>
                    </div>
                  </div>

                  {/* Validity */}
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Validity</p>
                    <div className="text-sm font-semibold">
                      {esimDetails.plan.validity} Days
                    </div>
                  </div>

                  {/* Created */}
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Created</p>
                    <div className="text-sm">
                      {format(new Date(orderInfo.created_at), "yyyy-MM-dd")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(orderInfo.created_at), "HH:mm:ss")}
                    </div>
                  </div>

                  {/* Expiration (show only when connected and has expiry date) */}
                  {esimDetails.network.connected && esimDetails.plan.expires_at && (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Expiration</p>
                      <div className="text-sm">
                        {format(new Date(esimDetails.plan.expires_at), "yyyy-MM-dd")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(esimDetails.plan.expires_at), "HH:mm:ss")}
                      </div>
                    </div>
                  )}
                  
                  {/* Not Connected Status for Maya eSIMs */}
                  {!esimDetails.network.connected && orderInfo?.esim_plans?.supplier_name?.toLowerCase() === 'maya' && (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Status</p>
                      <div className="text-sm text-orange-600 font-medium">
                        Awaiting Network Connection
                      </div>
                      <div className="text-xs text-muted-foreground">
                        No expiry until connected
                      </div>
                    </div>
                  )}
                </div>

                {/* Top-up Button Row */}
                <div className="flex justify-end pt-4 border-t border-white/10 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-orange-500 text-white hover:bg-orange-600 border-orange-500 h-8 px-4"
                    onClick={() => setShowTopupModal(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Top-up
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activation" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* QR Code Card */}
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <QrCode className="h-5 w-5 text-primary" />
                      QR Code
                    </CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="glass-intense border-0 hover:bg-white/10">
                          <Share2 className="h-4 w-4 mr-2" />
                          Share
                          <span className="ml-2 flex items-center gap-1 opacity-80">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <Mail className="h-3.5 w-3.5" />
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 glass-intense border-white/10">
                        <div className="space-y-4">
                          <h4 className="font-semibold">Share eSIM Details</h4>
                          <div className="space-y-3">
                            <Button 
                              variant="outline" 
                              className="w-full justify-start glass-intense border-0 hover:bg-white/10"
                              onClick={() => setShowShareModal(true)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy to Clipboard
                            </Button>
                             <Button 
                               variant="outline" 
                               className="w-full justify-start glass-intense border-0 hover:bg-white/10"
                               onClick={() => setShowShareModal(true)}
                             >
                               <MessageSquare className="h-4 w-4 mr-2" />
                               WhatsApp
                             </Button>
                             <Button 
                               variant="outline" 
                               className="w-full justify-start glass-intense border-0 hover:bg-white/10"
                               onClick={() => setShowShareModal(true)}
                             >
                               <Mail className="h-4 w-4 mr-2" />
                               Email
                             </Button>
                           </div>
                         </div>
                       </PopoverContent>
                     </Popover>
                  </div>
                </CardHeader>
                 <CardContent className="text-center">
                   <QRCodeDisplay qrText={esimDetails.activation.qr_code} />
                  
                  {/* Copy QR Code Image Button */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      try {
                        const qrText = `LPA:1$${esimDetails.activation.sm_dp_address}$${esimDetails.activation.manual_code}`;
                        const dataUrl = await QRCode.toDataURL(qrText, {
                          margin: 1,
                          scale: 6,
                          color: { dark: '#000000', light: '#FFFFFF' }
                        });
                        const res = await fetch(dataUrl);
                        const blob = await res.blob();
                        await navigator.clipboard.write([
                          new ClipboardItem({ [blob.type]: blob })
                        ]);
                        toast({ title: "Success", description: "QR Code image copied to clipboard" });
                      } catch (error) {
                        try {
                          const fallbackText = `LPA:1$${esimDetails.activation.sm_dp_address}$${esimDetails.activation.manual_code}`;
                          await navigator.clipboard.writeText(fallbackText);
                          toast({ title: "Success", description: "Manual activation string copied" });
                        } catch {
                          toast({ title: "Error", description: "Failed to copy QR code", variant: "destructive" });
                        }
                      }
                    }}
                    className="glass-intense border-0 hover:bg-white/10"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy QR Code
                  </Button>
                </CardContent>
              </Card>

              {/* Activation Instructions Card */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-primary" />
                    Activation Instructions
                  </CardTitle>
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

        {/* Top-up Modal */}
        <TopupModal
          isOpen={showTopupModal}
          onClose={() => setShowTopupModal(false)}
          iccid={iccid || ""}
          packageCode={esimDetails?.plan?.plan_id}
          onTopupComplete={() => {
            setShowTopupModal(false);
            fetchESIMDetails(); // Refresh to show new top-up
          }}
        />

        {/* Share Modal */}
        <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
          <DialogContent className="glass-intense border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                Share eSIM Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name (Optional)</Label>
                <Input
                  id="companyName"
                  value={agentBranding.companyName}
                  onChange={(e) => setAgentBranding(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Your Travel Agency Name"
                  className="glass-intense border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Custom Message (Optional)</Label>
                <Textarea
                  id="message"
                  value={agentBranding.message}
                  onChange={(e) => setAgentBranding(prev => ({ ...prev, message: e.target.value }))}
                  placeholder={`Here is your ${esimDetails?.plan?.name || 'eSIM Plan'} activation details:`}
                  className="glass-intense border-white/10"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactInfo">Contact Information (Optional)</Label>
                <Input
                  id="contactInfo"
                  value={agentBranding.contactInfo}
                  onChange={(e) => setAgentBranding(prev => ({ ...prev, contactInfo: e.target.value }))}
                  placeholder="support@yourcompany.com or +1-234-567-8900"
                  className="glass-intense border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label>Share Options</Label>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start glass-intense border-0 hover:bg-white/10"
                    onClick={() => handleShare('copy')}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to Clipboard
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start glass-intense border-0 hover:bg-white/10"
                    onClick={() => handleShare('whatsapp')}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start glass-intense border-0 hover:bg-white/10"
                    onClick={() => handleShare('email')}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ESimDetail;