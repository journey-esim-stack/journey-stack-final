import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { Eye, EyeOff, Shield, Users, Globe, CheckCircle, Smartphone } from "lucide-react";

const setSEO = (title: string, description: string, canonical?: string) => {
  document.title = title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", description);
  else {
    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content = description;
    document.head.appendChild(meta);
  }
  if (canonical) {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;
  }
};

const Auth = () => {
  const navigate = useNavigate();

  // Sign In state
  const [emailIn, setEmailIn] = useState("");
  const [passwordIn, setPasswordIn] = useState("");
  const [showPasswordIn, setShowPasswordIn] = useState(false);
  const [loadingIn, setLoadingIn] = useState(false);

  // Sign Up state
  const [emailUp, setEmailUp] = useState("");
  const [passwordUp, setPasswordUp] = useState("");
  const [showPasswordUp, setShowPasswordUp] = useState(false);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [loadingUp, setLoadingUp] = useState(false);

  useEffect(() => {
    setSEO(
      "eSIM Agent Portal – Sign in or Create Account",
      "Login or sign up to the Journey eSIM Agent Portal to manage plans, pricing, and orders.",
      window.location.href
    );

    // Simple auth state handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate("/plans");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/plans");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingIn(true);
    console.log("Attempting sign in with:", emailIn);
    const { error } = await supabase.auth.signInWithPassword({ 
      email: emailIn.trim(), 
      password: passwordIn 
    });
    console.log("Sign in result:", error);
    setLoadingIn(false);
    if (error) {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" as any });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingUp(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email: emailUp.trim(),
      password: passwordUp,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          company_name: company,
          contact_person: contact,
          phone,
          country,
        },
      },
    });
    setLoadingUp(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" as any });
    } else {
      toast({
        title: "Check your email",
        description: "We sent you a confirmation link to complete sign up.",
      });
    }
  };

  return (
    <main className="min-h-screen flex">
      {/* Left Panel - Branding & Value Proposition */}
      <section className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/80 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold">Journey eSIM</h1>
            </div>
            
            <div className="space-y-6">
              <h2 className="text-4xl font-bold leading-tight">
                Your Gateway to
                <br />
                Global Connectivity
              </h2>
              <p className="text-xl text-primary-foreground/90 leading-relaxed">
                Join our partner network and provide seamless eSIM solutions to travelers worldwide. 
                Manage plans, track orders, and grow your business with our comprehensive agent portal.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-primary-foreground/80" />
              <span className="text-primary-foreground/90">Global coverage in 190+ countries</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-primary-foreground/80" />
              <span className="text-primary-foreground/90">Competitive agent pricing</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-primary-foreground/80" />
              <span className="text-primary-foreground/90">24/7 dedicated support</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-primary-foreground/80" />
              <span className="text-primary-foreground/90">Real-time order management</span>
            </div>
          </div>
        </div>
      </section>

      {/* Right Panel - Authentication Forms */}
      <section className="flex-1 flex items-center justify-center p-4 lg:p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Journey eSIM</h1>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-2 pb-6">
              <CardTitle className="text-2xl font-bold text-center">Agent Portal</CardTitle>
              <CardDescription className="text-center">
                Sign in to your account or create a new agent profile
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-11">
                  <TabsTrigger value="signin" className="text-sm font-medium">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="text-sm font-medium">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-6">
                  <form onSubmit={handleSignIn} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="emailIn" className="text-sm font-medium">Email Address</Label>
                      <Input 
                        id="emailIn" 
                        type="email" 
                        autoComplete="email" 
                        value={emailIn} 
                        onChange={(e) => setEmailIn(e.target.value)} 
                        placeholder="your@company.com"
                        className="h-11"
                        required 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="passwordIn" className="text-sm font-medium">Password</Label>
                      <div className="relative">
                        <Input 
                          id="passwordIn" 
                          type={showPasswordIn ? "text" : "password"} 
                          autoComplete="current-password" 
                          value={passwordIn} 
                          onChange={(e) => setPasswordIn(e.target.value)} 
                          placeholder="Enter your password"
                          className="h-11 pr-10"
                          required 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordIn(!showPasswordIn)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPasswordIn ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full h-11 text-sm font-medium" 
                      disabled={loadingIn}
                    >
                      {loadingIn ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contact" className="text-sm font-medium">Contact Person</Label>
                        <Input 
                          id="contact" 
                          value={contact} 
                          onChange={(e) => setContact(e.target.value)} 
                          placeholder="John Doe"
                          className="h-10"
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company" className="text-sm font-medium">Company Name</Label>
                        <Input 
                          id="company" 
                          value={company} 
                          onChange={(e) => setCompany(e.target.value)} 
                          placeholder="Your Company Ltd"
                          className="h-10"
                          required 
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="emailUp" className="text-sm font-medium">Work Email</Label>
                      <Input 
                        id="emailUp" 
                        type="email" 
                        autoComplete="email" 
                        value={emailUp} 
                        onChange={(e) => setEmailUp(e.target.value)} 
                        placeholder="your@company.com"
                        className="h-10"
                        required 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="passwordUp" className="text-sm font-medium">Password</Label>
                      <div className="relative">
                        <Input 
                          id="passwordUp" 
                          type={showPasswordUp ? "text" : "password"} 
                          autoComplete="new-password" 
                          value={passwordUp} 
                          onChange={(e) => setPasswordUp(e.target.value)} 
                          placeholder="Create a strong password"
                          className="h-10 pr-10"
                          required 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordUp(!showPasswordUp)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPasswordUp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                        <Input 
                          id="phone" 
                          value={phone} 
                          onChange={(e) => setPhone(e.target.value)} 
                          placeholder="+1 (555) 123-4567"
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country" className="text-sm font-medium">Country</Label>
                        <Input 
                          id="country" 
                          value={country} 
                          onChange={(e) => setCountry(e.target.value)} 
                          placeholder="United States"
                          className="h-10"
                        />
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full h-11 text-sm font-medium mt-6" 
                      disabled={loadingUp}
                    >
                      {loadingUp ? "Creating account..." : "Create Agent Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {/* Trust Indicators */}
              <div className="pt-4 border-t border-border/50">
                <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    <span>Secure</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>Trusted by 1000+ agents</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    <span>Global coverage</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default Auth;
