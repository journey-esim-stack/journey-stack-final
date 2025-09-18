import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

interface AgentProfileRow {
  id: string;
  user_id: string;
  company_name: string;
  contact_person: string;
  country: string;
  phone: string;
  email?: string;
  status: Database["public"]["Enums"]["agent_status"];
  wallet_balance: number;
  markup_type: "percent" | "flat" | "fixed";
  markup_value: number;
  created_at: string;
  business_license?: string;
  lifetime_revenue?: number;
}

export default function AdminAgents() {
  const [agents, setAgents] = useState<AgentProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      // First get agents with their basic data and email from auth.users
      const { data: agentData, error: agentError } = await supabase
        .from("agent_profiles")
        .select(`
          *,
          user_id
        `)
        .order("created_at", { ascending: false });
      
      if (agentError) throw agentError;

      // Get user emails from auth admin endpoint via edge function
      const { data: usersData } = await supabase.functions.invoke('get-admin-users', {
        body: { user_ids: agentData?.map(agent => agent.user_id) || [] }
      });

      // Map emails to agents
      const emailMap = new Map();
      if (usersData?.users) {
        usersData.users.forEach((user: any) => {
          emailMap.set(user.id, user.email);
        });
      }

      if (agentError) throw agentError;

      // Then calculate lifetime revenue for each agent (sum of topups)
      const agentsWithRevenue = await Promise.all(
        (agentData || []).map(async (agent) => {
          const { data: topups, error: topupError } = await supabase
            .from("esim_topups")
            .select("amount")
            .eq("agent_id", agent.id)
            .eq("status", "completed");

          if (topupError) {
            console.error("Error fetching topups for agent:", agent.id, topupError);
          }

          const lifetimeRevenue = topups?.reduce((sum, topup) => sum + Number(topup.amount), 0) || 0;

          return {
            ...agent,
            email: emailMap.get(agent.user_id) || 'Unknown',
            markup_type: (agent.markup_type === "fixed" ? "flat" : agent.markup_type) as "percent" | "flat",
            lifetime_revenue: lifetimeRevenue
          } as AgentProfileRow;
        })
      );

      setAgents(agentsWithRevenue);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load agents", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = agents.filter(a =>
      a.company_name.toLowerCase().includes(q) ||
      a.contact_person.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q) ||
      a.phone.toLowerCase().includes(q)
    );

    if (statusFilter !== "all") {
      result = result.filter(a => a.status === statusFilter);
    }

    return result;
  }, [agents, search, statusFilter]);

  const saveAgent = async (agent: AgentProfileRow) => {
    try {
      const updateData: any = { 
        markup_type: agent.markup_type, 
        markup_value: agent.markup_value 
      };
      
      // If this is for admin editing profile fields
      if (agent.company_name || agent.contact_person || agent.phone || agent.country) {
        updateData.company_name = agent.company_name;
        updateData.contact_person = agent.contact_person;
        updateData.phone = agent.phone;
        updateData.country = agent.country;
      }
      
      const { error } = await supabase
        .from("agent_profiles")
        .update(updateData)
        .eq("id", agent.id);
      if (error) throw error;
      
      toast({ title: "Saved", description: `Updated ${agent.company_name}` });
      
      // Refresh the data to ensure UI reflects the changes
      await fetchAgents();
    } catch (err) {
      console.error("Save error:", err);
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    }
  };

  const updateAgentStatus = async (agentId: string, newStatus: AgentProfileRow["status"]) => {
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({ status: newStatus })
        .eq("id", agentId);

      if (error) throw error;
      
      toast({ title: "Success", description: `Agent ${newStatus} successfully` });
      await fetchAgents(); // Refresh the list
    } catch (error) {
      console.error("Error updating agent status:", error);
      toast({ title: "Error", description: "Failed to update agent status", variant: "destructive" });
    }
  };

  const getStatusBadgeVariant = (status: AgentProfileRow["status"]) => {
    switch (status) {
      case "approved": return "default";
      case "pending": return "secondary";
      case "suspended": return "destructive";
      default: return "outline";
    }
  };

  const getPerformanceLabel = (revenue: number) => {
    if (revenue > 1000) return "High Performer";
    if (revenue > 100) return "Active";
    return "New/Low Activity";
  };

  const pendingCount = agents.filter(a => a.status === "pending").length;

  return (
    <Layout>
      <section className="space-y-6">
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Agent Management</h1>
            <p className="text-muted-foreground">Manage agent approvals, markups, and track performance</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>Total Agents: {agents.length}</div>
            {pendingCount > 0 && (
              <div className="text-orange-600 font-medium">
                Pending Approval: {pendingCount}
              </div>
            )}
          </div>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
          <Input 
            placeholder="Search by company, contact, country, or phone..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent) => (
              <Card key={agent.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{agent.company_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{agent.contact_person}</p>
                      <p className="text-xs text-muted-foreground">{agent.email}</p>
                      <p className="text-xs text-muted-foreground">{agent.phone} • {agent.country}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(agent.status)}>
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Joined</div>
                      <div>{new Date(agent.created_at).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Wallet</div>
                      <div className="font-medium">${agent.wallet_balance.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Lifetime Revenue</div>
                      <div className="font-bold text-green-600">${(agent.lifetime_revenue || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Performance</div>
                      <div className="text-xs">{getPerformanceLabel(agent.lifetime_revenue || 0)}</div>
                    </div>
                  </div>

                  {agent.status === "pending" && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => updateAgentStatus(agent.id, "approved")}
                        className="flex-1"
                      >
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => updateAgentStatus(agent.id, "suspended")}
                        className="flex-1"
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {agent.status === "approved" && (
                    <div className="grid gap-3 pt-3 border-t">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Company Name</Label>
                          <Input value={agent.company_name}
                            onChange={(e) => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, company_name: e.target.value } : a))}
                          />
                        </div>
                        <div>
                          <Label>Contact Person</Label>
                          <Input value={agent.contact_person}
                            onChange={(e) => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, contact_person: e.target.value } : a))}
                          />
                        </div>
                        <div>
                          <Label>Phone</Label>
                          <Input value={agent.phone}
                            onChange={(e) => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, phone: e.target.value } : a))}
                          />
                        </div>
                        <div>
                          <Label>Country</Label>
                          <Input value={agent.country}
                            onChange={(e) => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, country: e.target.value } : a))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Markup Type</Label>
                          <Select value={agent.markup_type} onValueChange={(v: "percent" | "flat") => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, markup_type: v } : a))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent">Percent</SelectItem>
                              <SelectItem value="flat">Flat (Fixed amount)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Markup Value</Label>
                          <Input type="number" step="0.01" value={agent.markup_value}
                            onChange={(e) => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, markup_value: Number(e.target.value) } : a))}
                          />
                        </div>
                      </div>

                      <Button onClick={() => saveAgent(agent)} size="sm">
                        Save Changes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            No agents found matching your search criteria.
          </div>
        )}
      </section>
    </Layout>
  );
}