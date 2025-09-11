import { useEffect, useState } from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Package, Wallet, ShoppingCart, ShieldCheck, Smartphone, User, BarChart3 } from "lucide-react";
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
    { name: "Plans", href: "/plans", icon: Package },
    { name: "Wallet", href: "/wallet", icon: Wallet },
    { name: "eSIMs", href: "/esims", icon: Smartphone },
    { name: "Profile", href: "/profile", icon: User },
    ...(isAdmin ? [{ name: "Admin: Agents", href: "/admin/agents", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/dashboard" className="flex items-center">
                <img src="/lovable-uploads/1e1f433f-d326-4551-ba07-4e6b9e5c259f.png" alt="Journey Stack" className="h-12" />
              </Link>
              <div className="hidden md:flex space-x-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        location.pathname === item.href
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground/80 hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Currency Selector */}
              <CurrencySelector />
              
              {/* Enhanced Cart Icon */}
              <CartIcon />
              
              <Button variant="ghost" onClick={handleSignOut} className="hover:glass-subtle transition-all duration-200 rounded-xl">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      
      {/* Global Cart Sidebar */}
      <CartSidebar />
    </div>
  );
}