import { useEffect, useState } from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Package, Wallet, ShoppingCart, ShieldCheck, Smartphone, User, BarChart3, Archive, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import CartSidebar from "@/components/CartSidebar";
import CartIcon from "@/components/CartIcon";
import CurrencySelector from "@/components/CurrencySelector";
import { useCart } from "@/contexts/CartContext";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          setUser(session?.user ?? null);
          // Only show loading on sign out, not on route changes
          if (event === 'SIGNED_OUT') {
            setLoading(false);
          }
        }
      }
    );

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setIsAdmin(!!data?.some((r: any) => r.role === 'admin'));
      });
  }, [user]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Signed out successfully",
      });
    }
  };

  // Only show loading spinner on initial load, not during navigation
  if (loading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
    { name: "eSIM Plans", href: "/esim-plans", icon: Package },
    { name: "Wallet", href: "/wallet", icon: Wallet },
    { name: "eSIMs", href: "/esims", icon: Smartphone },
    { name: "Profile", href: "/profile", icon: User },
  ];

  const adminNavigation = isAdmin ? [
    { name: "Agents", href: "/admin/agents", icon: ShieldCheck },
    { name: "Inventory", href: "/admin/inventory", icon: Archive },
    { name: "Suppliers", href: "/admin/suppliers", icon: Package },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 md:h-20">
            <div className="flex items-center space-x-3">
              <Link to="/dashboard" className="flex items-center">
                <img 
                  src="/lovable-uploads/1e1f433f-d326-4551-ba07-4e6b9e5c259f.png" 
                  alt="Journey Stack" 
                  className="h-12 md:h-16 w-auto object-contain shrink-0"
                  loading="eager"
                  decoding="sync"
                  style={{ 
                    imageRendering: 'crisp-edges',
                    minHeight: '3rem',
                    minWidth: '3rem'
                  }}
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden';
                  }}
                />
              </Link>
              <div className="hidden md:flex items-center space-x-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center space-x-2 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${
                        location.pathname === item.href
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/80 hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
                {isAdmin && (
                  <div className="ml-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline"
                          size="sm"
                          className="flex items-center space-x-2 bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span className="whitespace-nowrap">Admin</span>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background border border-border">
                        {adminNavigation.map((item) => {
                          const Icon = item.icon;
                          return (
                            <DropdownMenuItem key={item.name} asChild>
                              <Link
                                to={item.href}
                                className={`flex items-center space-x-2 px-2 py-2 text-sm font-medium transition-colors ${
                                  location.pathname === item.href
                                    ? "bg-accent text-accent-foreground"
                                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                                <span>{item.name}</span>
                              </Link>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 md:space-x-3">
              <div className="hidden md:block h-6 w-px bg-border" aria-hidden="true" />
              {/* Currency Selector */}
              <CurrencySelector />
              
              {/* Enhanced Cart Icon */}
              <CartIcon />
              
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="hover:glass-subtle transition-all duration-200 rounded-xl">
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center space-x-4">
              <img src="/lovable-uploads/1e1f433f-d326-4551-ba07-4e6b9e5c259f.png" alt="Journey Stack" className="h-10" />
              <p className="text-foreground/80 text-sm max-w-xs">
                Journey Stack is designed to revolutionize how eSim operate.
              </p>
            </div>
            <div className="text-sm text-foreground/60">
              © 2025 Journey Stack, Inc. All rights reserved
            </div>
          </div>
        </div>
      </footer>
      
      {/* Global Cart Sidebar */}
      <CartSidebar />
    </div>
  );
}