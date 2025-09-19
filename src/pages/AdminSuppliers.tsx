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
  const [regionalRouting, setRegionalRouting] = useState<SupplierRouting>({});
  const [supplierConfigs, setSupplierConfigs] = useState<SupplierConfigs>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingMaya, setSyncingMaya] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
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

  const mayaRegions = [
    { code: 'europe', name: 'Europe', countries: ['Germany', 'France', 'Italy', 'Spain', 'United Kingdom', 'Netherlands', 'Poland'] },
    { code: 'apac', name: 'Asia Pacific', countries: ['Japan', 'South Korea', 'Singapore', 'Thailand', 'Australia', 'India', 'Philippines'] },
    { code: 'latam', name: 'Latin America', countries: ['Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru'] },
    { code: 'caribbean', name: 'Caribbean', countries: ['Jamaica', 'Dominican Republic', 'Puerto Rico', 'Bahamas'] },
    { code: 'mena', name: 'Middle East & North Africa', countries: ['UAE', 'Saudi Arabia', 'Egypt', 'Israel', 'Turkey'] },
    { code: 'balkans', name: 'Balkans', countries: ['Serbia', 'Croatia', 'Bosnia', 'Montenegro', 'Albania'] },
    { code: 'caucasus', name: 'Caucasus', countries: ['Georgia', 'Armenia', 'Azerbaijan'] }
  ];

  useEffect(() => {
    fetchSupplierSettings();
  }, []);

  const fetchSupplierSettings = async () => {
    try {
      const [routingResponse, regionalResponse, configsResponse] = await Promise.all([
        supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'supplier_routing')
          .single(),
        supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'regional_routing')
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

      if (regionalResponse.data) {
        setRegionalRouting(JSON.parse(regionalResponse.data.setting_value));
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

  const handleRegionalRoutingChange = (regionCode: string, supplier: string) => {
    setRegionalRouting(prev => ({
      ...prev,
      [regionCode]: supplier
    }));
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
      const [routingResult, regionalResult, configsResult] = await Promise.all([
        supabase
          .from('system_settings')
          .upsert({
            setting_key: 'supplier_routing',
            setting_value: JSON.stringify(supplierRouting),
            description: 'JSON configuration for routing countries to specific suppliers'
          }),
        supabase
          .from('system_settings')
          .upsert({
            setting_key: 'regional_routing',
            setting_value: JSON.stringify(regionalRouting),
            description: 'JSON configuration for routing regions to specific suppliers'
          }),
        supabase
          .from('system_settings')
          .upsert({
            setting_key: 'supplier_configs',
            setting_value: JSON.stringify(supplierConfigs),
            description: 'JSON configuration for supplier settings and priorities'
          })
      ]);

      if (routingResult.error || regionalResult.error || configsResult.error) {
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
    if (!selectedRegion) {
      toast({
        title: "Error",
        description: "Please select a region to sync",
        variant: "destructive",
      });
      return;
    }

    setSyncingMaya(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-maya-plans', {
        body: { region: selectedRegion }
      });
      
      if (error) {
        throw error;
      }

      const regionName = mayaRegions.find(r => r.code === selectedRegion)?.name || selectedRegion;
      toast({
        title: "Success",
        description: `Maya ${regionName} plans synced successfully: ${data?.synced_count || 0} plans`,
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
                    <SelectContent className="bg-background border shadow-lg z-50">
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

        {/* Regional Routing */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Regional Routing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mayaRegions.map(region => (
                <div key={region.code} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{region.name}</span>
                  <Select
                    value={regionalRouting[region.code] || 'maya'}
                    onValueChange={(value) => handleRegionalRoutingChange(region.code, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
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

        {/* Maya Region Sync */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Maya Region Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {mayaRegions.map(region => (
                <div key={region.code} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{region.name}</h3>
                    <Badge variant={selectedRegion === region.code ? "default" : "outline"}>
                      {region.code.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Countries: {region.countries.slice(0, 3).join(', ')}
                    {region.countries.length > 3 && ` +${region.countries.length - 3} more`}
                  </p>
                  <Button
                    variant={selectedRegion === region.code ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRegion(region.code)}
                    className="w-full"
                  >
                    Select {region.name}
                  </Button>
                </div>
              ))}
            </div>
            
            <Separator />
            
            <div className="flex gap-4">
              <Button 
                onClick={syncMayaPlans} 
                disabled={syncingMaya || !selectedRegion}
                className="flex-1"
              >
                {syncingMaya ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sync Selected Region Plans
              </Button>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}