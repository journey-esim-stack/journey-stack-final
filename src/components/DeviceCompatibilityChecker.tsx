import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Smartphone, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

interface DeviceBrand {
  id: string;
  brand_name: string;
}

interface DeviceModel {
  id: string;
  brand_id: string;
  model_name: string;
  is_esim_compatible: boolean;
  notes?: string;
}

interface DeviceCompatibilityCheckerProps {
  onCompatibilityChange?: (isCompatible: boolean | null, brandId?: string, modelId?: string) => void;
  defaultBrandId?: string;
  defaultModelId?: string;
  mode?: 'inline' | 'card'; // inline for forms, card for standalone
}

export const DeviceCompatibilityChecker = ({ 
  onCompatibilityChange, 
  defaultBrandId, 
  defaultModelId,
  mode = 'inline'
}: DeviceCompatibilityCheckerProps) => {
  const [brands, setBrands] = useState<DeviceBrand[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>(defaultBrandId || "");
  const [selectedModelId, setSelectedModelId] = useState<string>(defaultModelId || "");
  const [compatibility, setCompatibility] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [compatibilityMode, setCompatibilityMode] = useState<string>("warn");

  useEffect(() => {
    fetchBrands();
    fetchCompatibilityMode();
  }, []);

  useEffect(() => {
    if (selectedBrandId) {
      fetchModels(selectedBrandId);
    } else {
      setModels([]);
      setSelectedModelId("");
      setCompatibility(null);
    }
  }, [selectedBrandId]);

  useEffect(() => {
    if (selectedModelId && models.length > 0) {
      const selectedModel = models.find(m => m.id === selectedModelId);
      const isCompatible = selectedModel?.is_esim_compatible || false;
      setCompatibility(isCompatible);
      onCompatibilityChange?.(isCompatible, selectedBrandId, selectedModelId);
    } else {
      setCompatibility(null);
      onCompatibilityChange?.(null);
    }
  }, [selectedModelId, models, selectedBrandId, onCompatibilityChange]);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from("device_brands")
        .select("*")
        .order("brand_name");

      if (error) {
        console.error("Error fetching device brands:", error);
        toast.error("Failed to load device brands");
        return;
      }

      setBrands(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while loading device brands");
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async (brandId: string) => {
    setLoadingModels(true);
    try {
      const { data, error } = await supabase
        .from("device_models")
        .select("*")
        .eq("brand_id", brandId)
        .order("model_name");

      if (error) {
        console.error("Error fetching device models:", error);
        toast.error("Failed to load device models");
        return;
      }

      setModels(data || []);
      
      // Reset selected model when brand changes
      if (selectedModelId && !data?.find(m => m.id === selectedModelId)) {
        setSelectedModelId("");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while loading device models");
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchCompatibilityMode = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "device_compatibility_mode")
        .single();

      if (!error && data) {
        setCompatibilityMode(data.setting_value);
      }
    } catch (error) {
      console.error("Error fetching compatibility mode:", error);
    }
  };

  const getCompatibilityBadge = () => {
    if (compatibility === null) return null;

    if (compatibility) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Check className="h-3 w-3 mr-1" />
          eSIM Compatible
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <X className="h-3 w-3 mr-1" />
          Not Compatible
        </Badge>
      );
    }
  };

  const getCompatibilityAlert = () => {
    if (compatibility === null || compatibility === true) return null;

    const alertType = compatibilityMode === 'block' ? 'destructive' : 'default';
    const icon = compatibilityMode === 'block' ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />;
    
    return (
      <Alert variant={alertType}>
        {icon}
        <AlertDescription>
          {compatibilityMode === 'block' 
            ? "This device does not support eSIM. Purchase is blocked until a compatible device is selected."
            : "Warning: This device may not support eSIM. Please verify with the customer before proceeding."
          }
        </AlertDescription>
      </Alert>
    );
  };

  const content = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Device Brand</label>
          <Select
            value={selectedBrandId}
            onValueChange={(value) => {
              setSelectedBrandId(value);
              setSelectedModelId("");
            }}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Loading brands..." : "Select device brand"} />
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.brand_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Device Model</label>
          <Select
            value={selectedModelId}
            onValueChange={setSelectedModelId}
            disabled={!selectedBrandId || loadingModels}
          >
            <SelectTrigger>
              <SelectValue 
                placeholder={
                  !selectedBrandId 
                    ? "Select brand first" 
                    : loadingModels 
                    ? "Loading models..." 
                    : "Select device model"
                } 
              />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{model.model_name}</span>
                    {model.is_esim_compatible ? (
                      <Check className="h-3 w-3 text-green-600 ml-2" />
                    ) : (
                      <X className="h-3 w-3 text-red-600 ml-2" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedModelId && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Compatibility Status:</span>
            {getCompatibilityBadge()}
          </div>
          
          {getCompatibilityAlert()}
          
          {/* Show model notes if available */}
          {selectedModelId && models.find(m => m.id === selectedModelId)?.notes && (
            <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
              <strong>Note:</strong> {models.find(m => m.id === selectedModelId)?.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (mode === 'card') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Device Compatibility Checker
          </CardTitle>
        </CardHeader>
        <CardContent>
          {content}
        </CardContent>
      </Card>
    );
  }

  return content;
};

export default DeviceCompatibilityChecker;