import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useCart } from '@/contexts/CartContext';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard } from 'lucide-react';
import { getCountryFlag } from '@/utils/countryFlags';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CartSidebarProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function CartSidebar({ isOpen: externalIsOpen, onOpenChange }: CartSidebarProps = {}) {
  const { state, updateQuantity, removeFromCart, clearCart } = useCart();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const { toast } = useToast();

  // Use external control if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;

  const handleCheckout = async () => {
    if (state.items.length === 0) return;
    try {
      const { error, data } = await supabase.functions.invoke('wallet-debit', {
        body: {
          amount: Number(state.total.toFixed(2)),
          description: 'Cart purchase',
          reference_id: `cart-${Date.now()}`,
          cart_items: state.items,
          customer_info: {
            name: "Customer Name", // TODO: Get from user profile or form
            email: "customer@example.com", // TODO: Get from user profile or form
            phone: null,
          },
        },
      });
      if (error) {
        const msg = (error as any)?.message || '';
        if (msg.includes('INSUFFICIENT_FUNDS')) {
          toast({ title: 'Insufficient wallet balance', description: 'Please top up your wallet and try again.', variant: 'destructive' });
        } else {
          toast({ title: 'Checkout failed', description: 'Something went wrong. Try again.', variant: 'destructive' });
        }
        return;
      }
      const orderCount = data?.order_ids?.length || 0;
      toast({ 
        title: 'Payment successful', 
        description: `${orderCount} order(s) created and charged from wallet.` 
      });
      clearCart();
      setIsOpen(false);
    } catch (e) {
      toast({ title: 'Checkout error', description: 'Unexpected error occurred.', variant: 'destructive' });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {/* Only show the floating trigger if no external control is provided */}
      {externalIsOpen === undefined && (
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg glass-intense border-0 z-50 hover:scale-110 transition-all duration-200"
          >
            <ShoppingCart className="h-6 w-6" />
            {state.items.length > 0 && (
              <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground animate-bounce">
                {state.items.reduce((sum, item) => sum + item.quantity, 0)}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="w-full sm:max-w-lg glass-intense border-0">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Your Cart ({state.items.length} plans)
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {state.items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Your cart is empty</p>
              <p className="text-sm text-muted-foreground">Add some eSIM plans to get started</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {state.items.map((item) => (
                  <Card key={item.id} className="glass-subtle border-0">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getCountryFlag(item.countryCode)}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{item.title}</h4>
                          <p className="text-xs text-muted-foreground">{item.countryName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {item.dataAmount}
                            </span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {item.validityDays}d
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-primary">
                              {item.currency} {item.agentPrice.toFixed(2)}
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-sm font-medium w-8 text-center">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="border-t border-glass-border pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-lg text-primary">
                    USD {state.total.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleCheckout}
                    className="w-full"
                    disabled={state.items.length === 0}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay from Wallet
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={clearCart}
                    className="w-full"
                    disabled={state.items.length === 0}
                  >
                    Clear Cart
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}