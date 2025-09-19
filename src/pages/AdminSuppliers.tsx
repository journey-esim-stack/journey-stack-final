import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Loader2, Globe, Settings, CheckCircle, XCircle } from "lucide-react";
import Layout from "@/components/Layout";

interface SupplierConfig {
  enabled: boolean;
  priority: number;
}

interface SupplierConfigs {
  [key: string]: SupplierConfig;
}

interface SupplierRouting {
  [key: string]: string;
}

export default function AdminSuppliers() {
  const [supplierRouting, setSupplierRouting] = useState<SupplierRouting>({});
  const [supplierConfigs, setSupplierConfigs] = useState<SupplierConfigs>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingMaya, setSyncingMaya] = useState(false);
  const { toast } = useToast();

  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'AE', name: 'UAE' },
    { code: 'SG', name: 'Singapore' },
    { code: 'TH', name: 'Thailand' },
    { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'AU', name: 'Australia' },
  ];

  const suppliers = ['esim_access', 'maya'];

  useEffect(() => {
    fetchSupplierSettings();
  }, []);

  const fetchSupplierSettings = async () => {
    try {
      const [routingResponse, configsResponse] = await Promise.all([
        supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'supplier_routing')
          .single(),
        supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'supplier_configs')
          .single()
      ]);

      if (routingResponse.data) {
        setSupplierRouting(JSON.parse(routingResponse.data.setting_value));
      }

      if (configsResponse.data) {
        setSupplierConfigs(JSON.parse(configsResponse.data.setting_value));
      }
    } catch (error) {
      console.error('Error fetching supplier settings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch supplier settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoutingChange = (countryCode: string, supplier: string) => {
    setSupplierRouting(prev => ({
      ...prev,
      [countryCode]: supplier
    }));
  };

  const toggleSupplier = (supplierName: string) => {
    setSupplierConfigs(prev => ({
      ...prev,
      [supplierName]: {
        ...prev[supplierName],
        enabled: !prev[supplierName]?.enabled
      }
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const [routingResult, configsResult] = await Promise.all([
        supabase
          .from('system_settings')
          .upsert({
            setting_key: 'supplier_routing',
            setting_value: JSON.stringify(supplierRouting),
            description: 'JSON configuration for routing countries/regions to specific suppliers'
          }),
        supabase
          .from('system_settings')
          .upsert({
            setting_key: 'supplier_configs',
            setting_value: JSON.stringify(supplierConfigs),
            description: 'JSON configuration for supplier settings and priorities'
          })
      ]);

      if (routingResult.error || configsResult.error) {
        throw new Error('Failed to save settings');
      }

      toast({
        title: "Success",
        description: "Supplier settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save supplier settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const syncMayaPlans = async () => {
    setSyncingMaya(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-maya-plans');
      
      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Maya plans synced successfully: ${data?.synced_count || 0} plans`,
      });
    } catch (error) {
      console.error('Error syncing Maya plans:', error);
      toast({
        title: "Error",
        description: "Failed to sync Maya plans",
        variant: "destructive",
      });
    } finally {
      setSyncingMaya(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="glass-intense p-8">
          <h1 className="text-4xl font-bold mb-4 text-black">
            Supplier Management
          </h1>
          <p className="text-muted-foreground text-lg">
            Configure supplier routing and manage eSIM plan sources
          </p>
        </div>

        {/* Supplier Status */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Supplier Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suppliers.map(supplier => {
                const config = supplierConfigs[supplier];
                const isEnabled = config?.enabled;
                return (
                  <div key={supplier} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {isEnabled ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium capitalize">{supplier.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          Priority: {config?.priority || 1}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isEnabled ? "default" : "secondary"}>
                        {isEnabled ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSupplier(supplier)}
                      >
                        {isEnabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Country Routing */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Country Routing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {countries.map(country => (
                <div key={country.code} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{country.name}</span>
                  <Select
                    value={supplierRouting[country.code] || 'esim_access'}
                    onValueChange={(value) => handleRoutingChange(country.code, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier} value={supplier}>
                          {supplier.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Settings
              </Button>
              
              <Separator orientation="vertical" className="h-8" />
              
              <Button 
                variant="outline" 
                onClick={syncMayaPlans} 
                disabled={syncingMaya}
              >
                {syncingMaya ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sync Maya Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}