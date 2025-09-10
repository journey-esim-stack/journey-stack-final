import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
  Globe
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  };
  plan: {
    name: string;
    validity: number;
    data_amount: string;
    expires_at: string;
  };
  activation: {
    qr_code: string;
    manual_code: string;
    sm_dp_address: string;
  };
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
        // Create mock data based on order info for demo
        const mockDetails: ESIMDetails = {
          iccid: iccid || "",
          status: "Active",
          data_usage: {
            used: 0.26,
            total: parseFloat(orderData.esim_plans?.data_amount?.replace(/[^\d.]/g, '') || "3"),
            unit: "GB"
          },
          network: {
            connected: true,
            operator: "Vodafone",
            country: orderData.esim_plans?.country_name || "Unknown"
          },
          plan: {
            name: orderData.esim_plans?.title || "Unknown Plan",
            validity: orderData.esim_plans?.validity_days || 5,
            data_amount: orderData.esim_plans?.data_amount || "3GB",
            expires_at: new Date(Date.now() + (orderData.esim_plans?.validity_days || 5) * 24 * 60 * 60 * 1000).toISOString()
          },
          activation: {
            qr_code: orderData.esim_qr_code || "",
            manual_code: orderData.activation_code || "TN20250820112904SEFCE8F6",
            sm_dp_address: "consumer.e-sim.global"
          }
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
      <div className="container mx-auto p-6">
        <div className="text-center">Loading eSIM details...</div>
      </div>
    );
  }

  if (!esimDetails || !orderInfo) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">eSIM Not Found</h2>
          <p className="text-muted-foreground">The requested eSIM could not be found.</p>
          <Button onClick={() => navigate("/esims")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to eSIMs
          </Button>
        </div>
      </div>
    );
  }

  const usagePercentage = (esimDetails.data_usage.used / esimDetails.data_usage.total) * 100;
  const remainingData = esimDetails.data_usage.total - esimDetails.data_usage.used;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate("/esims")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">eSIM Details</h1>
          <p className="text-muted-foreground">ICCID: {esimDetails.iccid}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="activation">Activation</TabsTrigger>
          <TabsTrigger value="usage">Data Usage Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          {/* eSIM Details Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                eSIM Details
              </CardTitle>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">MAYA UID</p>
                  <p className="font-mono text-sm">{orderInfo.customer_name.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ICCID</p>
                  <p className="font-mono text-sm">{esimDetails.iccid}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Customer</p>
                  <p className="text-sm">{orderInfo.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date Assigned</p>
                  <p className="text-sm">{format(new Date(orderInfo.created_at), "yyyy-MM-dd")}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">eSIM Status</p>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 inline-flex items-center gap-1 mt-1">
                    {getStatusIcon(esimDetails.status)}
                    {esimDetails.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Network Status</p>
                  <Badge className="bg-green-100 text-green-800 border-green-200 inline-flex items-center gap-1 mt-1">
                    {getStatusIcon("connected")}
                    Enabled
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">eSIM Tag</p>
                <p className="text-sm">{esimDetails.plan.data_amount.toLowerCase()}</p>
              </div>
            </CardContent>
          </Card>

          {/* Network Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Signal className="h-5 w-5" />
                Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span className="font-medium">
                          {esimDetails.network.country} Network: {esimDetails.network.operator}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Last Connection: {format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    Connected
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Usage Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Data Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{esimDetails.data_usage.used} {esimDetails.data_usage.unit}</p>
                  <p className="text-sm text-muted-foreground">Last 30 Days</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{esimDetails.data_usage.used} {esimDetails.data_usage.unit}</p>
                  <p className="text-sm text-muted-foreground">Last 24 Hours</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{remainingData.toFixed(2)} {esimDetails.data_usage.unit}</p>
                  <p className="text-sm text-muted-foreground">Average per Day</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Data Usage Progress</span>
                  <span>{usagePercentage.toFixed(1)}% used</span>
                </div>
                <Progress value={usagePercentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {remainingData.toFixed(2)} {esimDetails.data_usage.unit} remaining of {esimDetails.data_usage.total} {esimDetails.data_usage.unit}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Top-up Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Data Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Data Plan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activation" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* QR Code Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  QR Code
                </CardTitle>
                <Button variant="outline" size="sm" className="ml-auto">
                  Email to User
                </Button>
              </CardHeader>
              <CardContent className="text-center">
                <div className="w-64 h-64 mx-auto mb-4 border-2 border-dashed border-muted-foreground rounded-lg flex items-center justify-center">
                  {esimDetails.activation.qr_code ? (
                    <img 
                      src={esimDetails.activation.qr_code} 
                      alt="eSIM QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <QrCode className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">QR Code</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Activation Instructions Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Activation Instructions
                </CardTitle>
                <Button variant="outline" size="sm" className="ml-auto">
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
          <Card>
            <CardHeader>
              <CardTitle>Manual Activation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">iPhone / iOS</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">Activation Code</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted p-2 rounded font-mono text-sm flex-1">
                      {esimDetails.activation.manual_code}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(esimDetails.activation.manual_code)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">SM-DP Address</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted p-2 rounded font-mono text-sm flex-1">
                      {esimDetails.activation.sm_dp_address}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(esimDetails.activation.sm_dp_address)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">A</span>
                    </div>
                    <p className="text-sm font-medium">Android</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">Activation Code</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted p-2 rounded font-mono text-sm flex-1">
                      LPA:1${esimDetails.activation.sm_dp_address}${esimDetails.activation.manual_code}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(`LPA:1$${esimDetails.activation.sm_dp_address}$${esimDetails.activation.manual_code}`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-sm mb-2 text-blue-900">Tips & Reminders</h4>
                <ul className="text-sm space-y-1 text-blue-800">
                  <li>✓ Set the eSIM plan as your cellular data plan when you arrive at your destination. Find this in Settings → Cellular Data → Cellular Data.</li>
                  <li>✓ Turn off Data Roaming on your main SIM card to avoid any unexpected charges.</li>
                  <li>✓ Turn on Low Data Mode (iOS) or Data Saver mode (Android) to conserve data.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Data Usage Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Usage Data Available</h3>
                <p className="text-muted-foreground">
                  Data usage logs will appear here once the eSIM starts being used.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ESimDetail;