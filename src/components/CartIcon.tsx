import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useState } from "react";

export default function CartIcon() {
  const { state } = useCart();
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    // Find the cart sidebar trigger and click it
    const cartButton = document.querySelector('[data-testid="cart-trigger"]') as HTMLElement;
    if (cartButton) {
      cartButton.click();
    } else {
      // Fallback: look for the floating cart button
      const floatingButton = document.querySelector('button[class*="fixed"]') as HTMLElement;
      if (floatingButton) {
        floatingButton.click();
      }
    }
    setTimeout(() => setIsClicked(false), 200);
  };

  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="sm"
        onClick={handleClick}
        className={`relative glass-subtle hover:glass-card transition-all duration-200 rounded-xl px-3 py-2 group ${
          isClicked ? 'scale-95' : ''
        }`}
      >
        <ShoppingCart className="h-5 w-5 text-primary group-hover:scale-110 transition-transform duration-200" />
        {state.items.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg animate-pulse border border-white/20">
            {state.items.reduce((sum, item) => sum + item.quantity, 0)}
          </span>
        )}
        <span className="sr-only">Shopping Cart ({state.items.length} items)</span>
      </Button>
    </div>
  );
}