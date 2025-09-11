import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";

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
  const [loadingIn, setLoadingIn] = useState(false);

  // Sign Up state
  const [emailUp, setEmailUp] = useState("");
  const [passwordUp, setPasswordUp] = useState("");
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
    <main className="min-h-screen bg-background">
      <section className="container mx-auto max-w-lg px-4 py-12">
        <Card className="border-border/50 relative">
          <CardHeader>
            <CardTitle className="text-2xl">Journey eSIM Agent Portal</CardTitle>
            <CardDescription>Sign in or create your agent account</CardDescription>
            <img 
              src="/illustrations/connection-new.png" 
              alt="Welcome illustration" 
              className="absolute top-3 right-3 w-20 h-20"
            />
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailIn">Email</Label>
                    <Input id="emailIn" type="email" autoComplete="email" value={emailIn} onChange={(e) => setEmailIn(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passwordIn">Password</Label>
                    <Input id="passwordIn" type="password" autoComplete="current-password" value={passwordIn} onChange={(e) => setPasswordIn(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loadingIn}>
                    {loadingIn ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailUp">Work Email</Label>
                    <Input id="emailUp" type="email" autoComplete="email" value={emailUp} onChange={(e) => setEmailUp(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passwordUp">Password</Label>
                    <Input id="passwordUp" type="password" autoComplete="new-password" value={passwordUp} onChange={(e) => setPasswordUp(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company Name</Label>
                    <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact Person</Label>
                    <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loadingUp}>
                    {loadingUp ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default Auth;
