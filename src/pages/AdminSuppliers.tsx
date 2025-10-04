import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Loader2, Globe, Settings, CheckCircle, XCircle, Plus, Minus, RefreshCw } from "lucide-react";
import Layout from "@/components/Layout";
import { getSupplierDisplayName } from "@/utils/supplierNames";

interface SupplierConfig {
  enabled: boolean;
  priority: number;
}

interface SupplierConfigs {
  [key: string]: SupplierConfig;
}

interface CountryActivation {
  [key: string]: string[];  // country code -> array of active suppliers
}

interface RegionActivation {
  [key: string]: boolean;  // region code -> whether Maya is active
}

export default function AdminSuppliers() {
  const [countryActivation, setCountryActivation] = useState<CountryActivation>({});
  const [regionActivation, setRegionActivation] = useState<RegionActivation>({});
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
      const [countryResponse, regionResponse, configsResponse] = await Promise.all([
        supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'country_activation')
          .single(),
        supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'region_activation')
          .single(),
        supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'supplier_configs')
          .single()
      ]);

      if (countryResponse.data) {
        setCountryActivation(JSON.parse(countryResponse.data.setting_value));
      }

      if (regionResponse.data) {
        setRegionActivation(JSON.parse(regionResponse.data.setting_value));
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

  const toggleCountrySupplier = (countryCode: string, supplier: string) => {
    setCountryActivation(prev => {
      const current = prev[countryCode] || ['esim_access']; // always include esim_access
      const newActivation = current.includes(supplier) 
        ? current.filter(s => s !== supplier || s === 'esim_access') // can't remove esim_access
        : [...current, supplier];
      
      // ensure esim_access is always included
      if (!newActivation.includes('esim_access')) {
        newActivation.push('esim_access');
      }
      
      return {
        ...prev,
        [countryCode]: newActivation
      };
    });
  };

  const toggleRegionActivation = (regionCode: string) => {
    setRegionActivation(prev => ({
      ...prev,
      [regionCode]: !prev[regionCode]
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
      console.log('Saving settings:', {
        countryActivation,
        regionActivation,
        supplierConfigs
      });

      const [countryResult, regionResult, configsResult] = await Promise.all([
        supabase
          .from('system_settings')
          .upsert({
            setting_key: 'country_activation',
            setting_value: JSON.stringify(countryActivation),
            description: 'JSON configuration for active suppliers per country'
          }, {
            onConflict: 'setting_key'
          }),
        supabase
          .from('system_settings')
          .upsert({
            setting_key: 'region_activation',
            setting_value: JSON.stringify(regionActivation),
            description: 'JSON configuration for active Maya regions'
          }, {
            onConflict: 'setting_key'
          }),
        supabase
          .from('system_settings')
          .upsert({
            setting_key: 'supplier_configs',
            setting_value: JSON.stringify(supplierConfigs),
            description: 'JSON configuration for supplier settings and priorities'
          }, {
            onConflict: 'setting_key'
          })
      ]);

      console.log('Upsert results:', { countryResult, regionResult, configsResult });

      if (countryResult.error) {
        console.error('Country activation error:', countryResult.error);
        throw new Error(`Country activation: ${countryResult.error.message}`);
      }
      
      if (regionResult.error) {
        console.error('Region activation error:', regionResult.error);
        throw new Error(`Region activation: ${regionResult.error.message}`);
      }
      
      if (configsResult.error) {
        console.error('Supplier configs error:', configsResult.error);
        throw new Error(`Supplier configs: ${configsResult.error.message}`);
      }

      toast({
        title: "Success",
        description: "Supplier settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: `Failed to save supplier settings: ${(error as Error).message}`,
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

  const runComprehensiveSync = async () => {
    try {
      setSaving(true);
      const { data, error } = await supabase.functions.invoke('sync-all-plans');
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: "Comprehensive Sync Completed",
          description: `Total active plans: ${data.total_active_plans}`,
        });
      } else {
        toast({
          title: "Sync Completed with Errors",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync all plans",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const syncESIMPlans = async () => {
    try {
      setSaving(true);
      const { data, error } = await supabase.functions.invoke('sync-esim-plans');
      
      if (error) throw error;
      
      toast({
        title: "eSIM Access Plans Synced",
        description: `Successfully synced eSIM Access plans`,
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync eSIM Access plans",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
            Configure supplier activation and manage eSIM plan sources
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
                const isBase = supplier === 'esim_access';
                return (
                  <div key={supplier} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {isEnabled || isBase ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium capitalize">
                          {getSupplierDisplayName(supplier)}
                          {isBase && <span className="text-xs ml-2 text-muted-foreground">(Base)</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Priority: {config?.priority || 1}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isEnabled || isBase ? "default" : "secondary"}>
                        {isEnabled || isBase ? "Active" : "Inactive"}
                      </Badge>
                      {!isBase && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleSupplier(supplier)}
                        >
                          {isEnabled ? "Disable" : "Enable"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Country Activation */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Country-Level Activation
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              eSIM Access is always active. Enable additional suppliers per country.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {countries.map(country => {
                const activeSuppliers = countryActivation[country.code] || ['esim_access'];
                const isMayaActive = activeSuppliers.includes('maya');
                
                return (
                  <div key={country.code} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{country.name}</span>
                      <Badge variant="outline">{country.code}</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">eSIM Access</span>
                        <Badge variant="default" className="text-xs">Base</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isMayaActive ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-sm">Maya</span>
                        </div>
                        <Button
                          variant={isMayaActive ? "destructive" : "default"}
                          size="sm"
                          onClick={() => toggleCountrySupplier(country.code, 'maya')}
                        >
                          {isMayaActive ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Regional Activation */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Regional Activation (Maya Multi-Country)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Activate Maya regional plans alongside eSIM Access plans.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mayaRegions.map(region => {
                const isActive = regionActivation[region.code];
                
                return (
                  <div key={region.code} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{region.name}</span>
                      <Badge variant="outline">{region.code.toUpperCase()}</Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      {region.countries.slice(0, 3).join(', ')}
                      {region.countries.length > 3 && ` +${region.countries.length - 3} more`}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm">Maya Plans</span>
                      </div>
                      <Button
                        variant={isActive ? "destructive" : "default"}
                        size="sm"
                        onClick={() => toggleRegionActivation(region.code)}
                      >
                        {isActive ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>


        {/* Actions */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={runComprehensiveSync} 
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync All Plans
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={syncESIMPlans} 
                  disabled={saving}
                  variant="outline"
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync eSIM Access Only
                    </>
                  )}
                </Button>
              </div>
              
              <Button 
                onClick={saveSettings} 
                disabled={saving}
                variant="secondary"
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Configuration Settings"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}