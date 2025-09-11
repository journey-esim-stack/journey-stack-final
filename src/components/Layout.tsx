import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CartSidebar from "@/components/CartSidebar";
import CartIcon from "@/components/CartIcon";
import CurrencySelector from "@/components/CurrencySelector";
import { AppSidebar } from "@/components/AppSidebar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";

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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar user={user} isAdmin={isAdmin} />
        
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card px-4">
            <SidebarTrigger className="mr-2" />
            <div className="flex items-center justify-between w-full">
              <Breadcrumbs />
              <div className="flex items-center space-x-4">
                <CurrencySelector />
                <CartIcon />
                <Button variant="ghost" onClick={handleSignOut} className="hover:glass-subtle transition-all duration-200 rounded-xl">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
          
          {/* Footer */}
          <footer className="border-t bg-card mt-auto">
            <div className="px-6 py-8">
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
        </SidebarInset>
        
        {/* Global Cart Sidebar */}
        <CartSidebar />
      </div>
    </SidebarProvider>
  );
}