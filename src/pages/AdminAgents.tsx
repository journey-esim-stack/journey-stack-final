import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface AgentProfileRow {
  id: string;
  user_id: string;
  company_name: string;
  contact_person: string;
  country: string;
  status: string;
  wallet_balance: number;
  markup_type: "percent" | "flat";
  markup_value: number;
}

export default function AdminAgents() {
  const [agents, setAgents] = useState<AgentProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("id, user_id, company_name, contact_person, country, status, wallet_balance, markup_type, markup_value")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAgents((data as any) || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load agents", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return agents.filter(a =>
      a.company_name.toLowerCase().includes(q) ||
      a.contact_person.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const saveAgent = async (agent: AgentProfileRow) => {
    try {
      const { error } = await supabase
        .from("agent_profiles")
        .update({ markup_type: agent.markup_type, markup_value: agent.markup_value })
        .eq("id", agent.id);
      if (error) throw error;
      
      toast({ title: "Saved", description: `Updated ${agent.company_name} markup` });
      
      // Refresh the data to ensure UI reflects the changes
      await fetchAgents();
    } catch (err) {
      console.error("Save error:", err);
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Admin: Agent Markups</h1>
          <p className="text-muted-foreground">Manage per-agent markup settings used to compute their costs.</p>
        </header>

        <div className="flex gap-3 max-w-md">
          <Input placeholder="Search company, contact, country" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <CardTitle className="text-lg">{agent.company_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{agent.contact_person} • {agent.country} • Status: {agent.status}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label>Markup Type</Label>
                      <Select value={agent.markup_type} onValueChange={(v: "percent" | "flat") => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, markup_type: v } : a))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percent</SelectItem>
                          <SelectItem value="flat">Flat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Markup Value</Label>
                      <Input type="number" step="0.01" value={agent.markup_value}
                        onChange={(e) => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, markup_value: Number(e.target.value) } : a))}
                      />
                    </div>

                    <div className="pt-2">
                      <Button onClick={() => saveAgent(agent)}>Save</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
