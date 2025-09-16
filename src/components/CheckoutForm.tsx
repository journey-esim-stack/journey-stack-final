import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import DeviceCompatibilityChecker from './DeviceCompatibilityChecker';
import { CreditCard, User, AlertTriangle, Lock } from 'lucide-react';

interface CheckoutFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const CheckoutForm = ({ onSuccess, onCancel }: CheckoutFormProps) => {
  const { state, clearCart } = useCart();
  const { getCurrencySymbol, selectedCurrency } = useCurrency();
  const { toast } = useToast();
  
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: ''
  });
  
  const [deviceInfo, setDeviceInfo] = useState({
    brandId: '',
    modelId: '',
    isCompatible: null as boolean | null
  });
  
  const [compatibilityMode, setCompatibilityMode] = useState('warn');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCompatibilityMode();
  }, []);

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

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!customerInfo.name.trim()) {
      errors.name = 'Customer name is required';
    }
    
    if (!customerInfo.email.trim()) {
      errors.email = 'Customer email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Device compatibility validation
    if (compatibilityMode === 'block' && deviceInfo.isCompatible === false) {
      errors.device = 'Selected device is not compatible with eSIM. Please choose a compatible device.';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCompatibilityChange = (isCompatible: boolean | null, brandId?: string, modelId?: string) => {
    setDeviceInfo({
      brandId: brandId || '',
      modelId: modelId || '',
      isCompatible
    });
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    if (state.items.length === 0) return;
    
    setIsSubmitting(true);
    
    try {
      const { error, data } = await supabase.functions.invoke('wallet-debit', {
        body: {
          amount: Number(state.total.toFixed(2)),
          description: `eSIM purchase: ${state.items.map(item => item.title).join(", ")}`,
          reference_id: `cart-${Date.now()}`,
          cart_items: state.items.map(item => ({
            ...item,
            wholesalePrice: item.agentPrice * 0.8 // Estimate wholesale price as 80% of agent price
          })),
          customer_info: {
            name: customerInfo.name.trim(),
            email: customerInfo.email.trim(),
            phone: customerInfo.phone.trim() || null,
          },
          device_info: deviceInfo.modelId ? {
            brand_id: deviceInfo.brandId,
            model_id: deviceInfo.modelId,
            compatibility_checked: true,
            compatibility_warning_shown: deviceInfo.isCompatible === false
          } : null
        },
      });
      
      if (error) {
        const msg = (error as any)?.message || '';
        if (msg.includes('INSUFFICIENT_FUNDS')) {
          toast({ 
            title: 'Insufficient wallet balance', 
            description: 'Please top up your wallet and try again.', 
            variant: 'destructive' 
          });
        } else {
          toast({ 
            title: 'Checkout failed', 
            description: 'Something went wrong. Try again.', 
            variant: 'destructive' 
          });
        }
        return;
      }
      
      const orderCount = data?.order_ids?.length || 0;
      toast({ 
        title: 'Payment successful', 
        description: `${orderCount} order(s) created and charged from wallet.` 
      });
      
      clearCart();
      onSuccess();
    } catch (e) {
      console.error('Checkout error:', e);
      toast({ 
        title: 'Checkout error', 
        description: 'Unexpected error occurred.', 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCheckoutBlocked = compatibilityMode === 'block' && deviceInfo.isCompatible === false;

  return (
    <div className="space-y-6">
      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Customer Name *</Label>
            <Input
              id="customer-name"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter customer's full name"
              className={formErrors.name ? 'border-destructive' : ''}
            />
            {formErrors.name && (
              <p className="text-sm text-destructive">{formErrors.name}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="customer-email">Customer Email *</Label>
            <Input
              id="customer-email"
              type="email"
              value={customerInfo.email}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter customer's email address"
              className={formErrors.email ? 'border-destructive' : ''}
            />
            {formErrors.email && (
              <p className="text-sm text-destructive">{formErrors.email}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="customer-phone">Customer Phone (Optional)</Label>
            <Input
              id="customer-phone"
              type="tel"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Enter customer's phone number"
            />
          </div>
        </CardContent>
      </Card>

      {/* Device Compatibility Checker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Device Compatibility
            {compatibilityMode === 'disabled' && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Optional</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeviceCompatibilityChecker
            onCompatibilityChange={handleCompatibilityChange}
            mode="inline"
          />
          {formErrors.device && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{formErrors.device}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {state.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.title} (×{item.quantity})</span>
                <span>{getCurrencySymbol()}{(item.agentPrice * item.quantity).toFixed(2)} {selectedCurrency}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total:</span>
              <span>{getCurrencySymbol()}{state.total.toFixed(2)} {selectedCurrency}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || isCheckoutBlocked}
          className="flex-1"
        >
          {isSubmitting ? (
            <>Processing...</>
          ) : isCheckoutBlocked ? (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Blocked
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay from Wallet
            </>
          )}
        </Button>
      </div>
      
      {isCheckoutBlocked && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Checkout is blocked because the selected device is not compatible with eSIM. 
            Please select a compatible device to proceed.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default CheckoutForm;