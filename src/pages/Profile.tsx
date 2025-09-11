import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Building, Mail, Phone, MapPin } from "lucide-react";
import { countries } from "@/utils/countries";
import Layout from "@/components/Layout";

interface AgentProfile {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  country: string;
  business_license?: string;
  status: string;
}

interface UserData {
  email: string;
}

export default function Profile() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    contact_person: "",
    phone: "",
    country: "",
    business_license: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user email
      setUserData({ email: user.email || "" });

      // Load agent profile
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
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const updateData = {
        company_name: formData.company_name.trim(),
        contact_person: formData.contact_person.trim(),
        phone: formData.phone.trim(),
        country: formData.country,
        business_license: formData.business_license.trim(),
        updated_at: new Date().toISOString(),
      };

      let result;

      if (profile) {
        result = await supabase
          .from("agent_profiles")
          .update(updateData)
          .eq("user_id", user.id)
          .select();

        if (result.error) throw result.error;
      } else {
        result = await supabase
          .from("agent_profiles")
          .insert({
            ...updateData,
            user_id: user.id,
          })
          .select();

        if (result.error) throw result.error;
      }

      // Update local state with the returned data
      if (result.data && result.data[0]) {
        setProfile(result.data[0]);
        setFormData({
          company_name: result.data[0].company_name || "",
          contact_person: result.data[0].contact_person || "",
          phone: result.data[0].phone || "",
          country: result.data[0].country || "",
          business_license: result.data[0].business_license || "",
        });
      }

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error("Update error:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-yellow-100 text-yellow-800", text: "Pending Review" },
      approved: { color: "bg-green-100 text-green-800", text: "Approved" },
      rejected: { color: "bg-red-100 text-red-800", text: "Rejected" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8" />
            Profile Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your account and business information
          </p>
        </div>

        <Tabs defaultValue="business" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="business">Business Information</TabsTrigger>
            <TabsTrigger value="account">Account Details</TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Business Information
                    </CardTitle>
                    <CardDescription>
                      Update your company details and business information
                    </CardDescription>
                  </div>
                  {profile && (
                    <div>{getStatusBadge(profile.status)}</div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-6">
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
                    <Label htmlFor="business_license">Business License</Label>
                    <Textarea
                      id="business_license"
                      placeholder="Enter business license number or registration details"
                      value={formData.business_license}
                      onChange={(e) => setFormData(prev => ({ ...prev, business_license: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Profile"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Account Details
                </CardTitle>
                <CardDescription>
                  View your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input 
                    value={userData?.email || ""} 
                    disabled 
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">
                    Contact support to change your email address
                  </p>
                </div>
                
                {profile && (
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium">Profile Status</h3>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(profile.status)}
                    </div>
                    
                    {profile.status === "pending" && (
                      <p className="text-sm text-muted-foreground">
                        Your profile is currently under review. You'll be notified once approved.
                      </p>
                    )}
                    
                    {profile.status === "rejected" && (
                      <p className="text-sm text-red-600">
                        Your profile was rejected. Please update your information and resubmit.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}