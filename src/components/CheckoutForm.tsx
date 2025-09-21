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
    
    // Customer name and email are now optional
    if (customerInfo.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
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
    console.log('🛒 Starting checkout process...');
    
    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }
    
    if (state.items.length === 0) {
      console.log('❌ No items in cart');
      return;
    }
    
    // Check authentication first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('👤 Auth check:', { user: user?.id, error: authError });
    
    if (authError || !user) {
      toast({ 
        title: 'Authentication required', 
        description: 'Please log in to complete your purchase.', 
        variant: 'destructive' 
      });
      return;
    }
    
    setIsSubmitting(true);
    console.log('💰 Cart total:', state.total, selectedCurrency);
    
    try {
      // Convert prices back to USD for backend processing
      const usdConversionRate = selectedCurrency === 'USD' ? 1 : 
        selectedCurrency === 'INR' ? 1/84.50 :
        selectedCurrency === 'AUD' ? 1/1.58 :
        selectedCurrency === 'EUR' ? 1/0.95 : 1;
      
      const usdTotal = Number((state.total * usdConversionRate).toFixed(2));
      console.log('💵 USD total after conversion:', usdTotal);
      console.log('🛍️ Cart items:', state.items.length);
      
      const requestBody = {
        amount: usdTotal,
        description: `eSIM purchase: ${state.items.map(item => item.title).join(", ")}`,
        reference_id: `cart-${Date.now()}`,
        cart_items: state.items.map(item => ({
          ...item,
          agentPrice: item.agentPrice * usdConversionRate, // Convert back to USD
          wholesalePrice: (item.agentPrice * usdConversionRate) * 0.8, // Convert back to USD and estimate wholesale
          supplier_name: item.supplier_name // Include supplier info to route to correct create function
        })),
        customer_info: {
          name: customerInfo.name.trim() || 'Customer',
          email: customerInfo.email.trim() || 'customer@example.com',
          phone: customerInfo.phone.trim() || null,
        },
        device_info: deviceInfo.modelId ? {
          brand_id: deviceInfo.brandId,
          model_id: deviceInfo.modelId,
          compatibility_checked: true,
          compatibility_warning_shown: deviceInfo.isCompatible === false
        } : null
      };
      
      console.log('📤 Sending wallet-debit request:', JSON.stringify(requestBody, null, 2));
      
      const { error, data } = await supabase.functions.invoke('wallet-debit', {
        body: requestBody,
      });
      
      console.log('📥 Wallet-debit response:', { error, data });
      
      if (error) {
        console.error('💥 Wallet debit error:', error);
        const errorData = error as any;
        const msg = errorData?.message || '';
        
        if (msg.includes('INSUFFICIENT_FUNDS') || errorData?.error === 'INSUFFICIENT_FUNDS') {
          const balance = errorData?.balance || data?.balance || 0;
          toast({ 
            title: 'Insufficient wallet balance', 
            description: `Current balance: $${balance.toFixed(2)}. Required: $${usdTotal.toFixed(2)}. Please top up your wallet.`, 
            variant: 'destructive' 
          });
        } else {
          // Enhanced error messaging with provider status codes
          let errorTitle = 'Checkout failed';
          let errorMessage = msg || errorData?.error || 'Something went wrong. Try again.';
          
          // Check for specific provider errors
          if (msg.includes('401') || msg.includes('unauthorized')) {
            errorTitle = 'Provider authentication failed';
            errorMessage = 'Service provider credentials issue. Please contact support.';
          } else if (msg.includes('404') || msg.includes('not found') || msg.includes('not available')) {
            errorTitle = 'Service unavailable';
            errorMessage = 'eSIM service temporarily unavailable. Please try again later.';
          } else if (msg.includes('500') || msg.includes('502') || msg.includes('503') || 
                    msg.includes('busy') || msg.includes('temporarily')) {
            errorTitle = 'Provider service busy';
            errorMessage = 'eSIM provider is temporarily busy. Please try again in a few minutes.';
          } else if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
            errorTitle = 'Request timeout';
            errorMessage = 'eSIM provisioning is taking longer than expected. Your order may still be processing.';
          } else if (msg.includes('out of stock') || msg.includes('insufficient')) {
            errorTitle = 'Service temporarily unavailable';
            errorMessage = 'eSIM service temporarily out of stock. Please try again later.';
          }
          
          toast({ 
            title: errorTitle, 
            description: errorMessage, 
            variant: 'destructive' 
          });
        }
        return;
      }
      
      const orderCount = data?.order_ids?.length || 0;
      console.log('✅ Checkout successful:', { orderCount, orders: data?.order_ids });
      toast({ 
        title: 'Payment successful', 
        description: `${orderCount} order(s) created and charged from wallet.` 
      });
      
      clearCart();
      onSuccess();
    } catch (e) {
      console.error('💥 Checkout error:', e);
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
            <Label htmlFor="customer-name">Customer Name (Optional)</Label>
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
            <Label htmlFor="customer-email">Customer Email (Optional)</Label>
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