import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { Eye, EyeOff, Shield, Users, Globe, CheckCircle, Smartphone, ArrowLeft } from "lucide-react";


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
  const { user, initialized } = useAuthState();

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

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loadingReset, setLoadingReset] = useState(false);

  useEffect(() => {
    setSEO(
      "Journey Stack | Unrivaled eSIM Platform - Auth",
      "Login or sign up to the Journey eSIM Agent Portal to manage plans, pricing, and orders.",
      window.location.href
    );
  }, []);

  useEffect(() => {
    if (initialized && user) {
      navigate("/dashboard");
    }
  }, [user, initialized, navigate]);

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
    const redirectUrl = `${window.location.origin}/auth/confirm`;
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth`
    });
    setLoadingReset(false);
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" as any });
    } else {
      toast({
        title: "Check your email",
        description: "We sent you a password reset link.",
      });
      setShowForgotPassword(false);
      setResetEmail("");
    }
  };

  return (
    <main className="min-h-screen flex">
      {/* Left Panel - Authentication Forms */}
      <section className="flex-1 flex items-center justify-center p-4 lg:p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
            <img 
              src="/lovable-uploads/2b7a0f76-4c0f-4c77-a157-7ac3b6ad5a06.png" 
              alt="Journey Stack Logo" 
              className="h-12 object-contain"
            />
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-2 pb-6">
              <CardTitle className="text-2xl font-bold text-center">Welcome to Journey Stack!</CardTitle>
              <CardDescription className="text-center">
                Sign in or create your account
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-11">
                  <TabsTrigger value="signin" className="text-sm font-medium">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="text-sm font-medium">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-6">
                  {!showForgotPassword ? (
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
                        <div className="flex items-center justify-between">
                          <Label htmlFor="passwordIn" className="text-sm font-medium">Password</Label>
                          <button
                            type="button"
                            onClick={() => setShowForgotPassword(true)}
                            className="text-xs text-primary hover:underline"
                          >
                            Forgot password?
                          </button>
                        </div>
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
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-5">
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(false)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <h3 className="text-lg font-semibold">Reset Password</h3>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="resetEmail" className="text-sm font-medium">Email Address</Label>
                        <Input 
                          id="resetEmail" 
                          type="email" 
                          value={resetEmail} 
                          onChange={(e) => setResetEmail(e.target.value)} 
                          placeholder="your@company.com"
                          className="h-11"
                          required 
                        />
                        <p className="text-xs text-muted-foreground">
                          We'll send you a link to reset your password
                        </p>
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full h-11 text-sm font-medium" 
                        disabled={loadingReset}
                      >
                        {loadingReset ? "Sending..." : "Send Reset Link"}
                      </Button>
                    </form>
                  )}
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

        {/* Right Panel - Video Background */}
        <section className="hidden lg:block lg:w-1/2 relative">
          
          {/* Video Background */}
          <video 
            autoPlay 
            muted 
            loop 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              console.log('Video failed to load:', e);
              e.currentTarget.style.display = 'none';
            }}
          >
            <source src="/auth-video-new.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-l from-primary/20 via-transparent to-background/20"></div>
        </section>
      </main>
  );
};

export default Auth;
