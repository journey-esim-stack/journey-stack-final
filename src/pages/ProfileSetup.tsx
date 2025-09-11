import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { countries } from "@/utils/countries";

interface AgentProfile {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  country: string;
  business_license?: string;
  status: string;
}

export default function ProfileSetup() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    contact_person: "",
    phone: "",
    country: "",
    business_license: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkProfile();
  }, []);

  const checkProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profileData, error } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Profile fetch error:", error);
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        });
        return;
      }

      if (profileData) {
        setProfile(profileData);
        setFormData({
          company_name: profileData.company_name || "",
          contact_person: profileData.contact_person || "",
          phone: profileData.phone || "",
          country: profileData.country || "",
          business_license: profileData.business_license || "",
        });

        // If profile is complete and approved, redirect to plans
        if (profileData.status === "approved") {
          navigate("/plans");
          return;
        }
      }
    } catch (error) {
      console.error("Error in checkProfile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const updateData = {
        company_name: formData.company_name,
        contact_person: formData.contact_person,
        phone: formData.phone,
        country: formData.country,
        business_license: formData.business_license,
        updated_at: new Date().toISOString(),
      };

      if (profile) {
        // Update existing profile
        const { error } = await supabase
          .from("agent_profiles")
          .update(updateData)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from("agent_profiles")
          .insert({
            ...updateData,
            user_id: user.id,
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully. Awaiting approval.",
      });

      // Refresh profile data
      await checkProfile();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusMessage = () => {
    if (!profile) return null;
    
    switch (profile.status) {
      case "pending":
        return (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-800">Profile Under Review</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Your agent profile is being reviewed. You'll be notified once approved.
            </p>
          </div>
        );
      case "rejected":
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-medium text-red-800">Profile Rejected</h3>
            <p className="text-sm text-red-700 mt-1">
              Please update your information and resubmit for review.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Complete Your Agent Profile</h1>
          <p className="text-muted-foreground mt-2">
            Provide your business information to access the eSIM agent portal
          </p>
        </div>

        {getStatusMessage()}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>
              Enter your company details for verification and onboarding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person *</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg max-h-60 overflow-y-auto z-50">
                        {countries.map((country) => (
                          <SelectItem key={country} value={country} className="hover:bg-accent">
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_license">Business License (Optional)</Label>
                <Textarea
                  id="business_license"
                  placeholder="Enter business license number or registration details"
                  value={formData.business_license}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_license: e.target.value }))}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {profile ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  profile ? "Update Profile" : "Create Profile"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}