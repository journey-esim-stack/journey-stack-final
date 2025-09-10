import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import CartSidebar from './CartSidebar';

export default function CartIcon() {
  const { state } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => setIsOpen(true)}
        className="relative glass-subtle hover:glass-card transition-all duration-200 rounded-xl px-3 py-2 group"
      >
        <ShoppingCart className="h-5 w-5 text-primary group-hover:scale-110 transition-transform duration-200" />
        {totalItems > 0 && (
          <span className="absolute -top-2 -right-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg animate-pulse border-2 border-background">
            {totalItems}
          </span>
        )}
        <span className="sr-only">Shopping Cart ({totalItems} items)</span>
      </Button>
      
      <CartSidebar isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}