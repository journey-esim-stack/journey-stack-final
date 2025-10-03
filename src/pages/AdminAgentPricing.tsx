import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Upload, Plus, Pencil, Trash2, RefreshCw, Download } from "lucide-react";
import Papa from "papaparse";

interface AgentProfile {
  id: string;
  company_name: string;
  status: string;
}

interface EsimPlan {
  id: string;
  title: string;
  country_name: string;
  country_code: string;
  data_amount: string;
  validity_days: number;
  wholesale_price: number;
  supplier_plan_id: string;
}

interface AgentPricing {
  id: string;
  agent_id: string;
  plan_id: string;
  retail_price: number;
  created_at: string;
  updated_at: string;
}

interface PlanWithPricing extends EsimPlan {
  retail_price?: number;
  pricing_id?: string;
  has_custom_price: boolean;
}

export default function AdminAgentPricing() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [plans, setPlans] = useState<EsimPlan[]>([]);
  const [pricing, setPricing] = useState<AgentPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanWithPricing | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAgents();
    fetchPlans();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      fetchPricing(selectedAgentId);
    }
  }, [selectedAgentId]);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("id, company_name, status")
        .eq("status", "approved")
        .order("company_name");

      if (error) throw error;
      setAgents(data || []);
      
      if (data && data.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching agents:", err);
      toast({ title: "Error", description: "Failed to load agents", variant: "destructive" });
    }
  };

  const fetchPlans = async () => {
    try {
      let allPlans: EsimPlan[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("esim_plans")
          .select("*")
          .eq("is_active", true)
          .order("country_name, title")
          .range(from, from + pageSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allPlans = [...allPlans, ...data];
          hasMore = data.length === pageSize;
          from += pageSize;
        } else {
          hasMore = false;
        }
      }

      setPlans(allPlans);
    } catch (err) {
      console.error("Error fetching plans:", err);
      toast({ title: "Error", description: "Failed to load plans", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchPricing = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from("agent_pricing")
        .select("*")
        .eq("agent_id", agentId);

      if (error) throw error;
      setPricing(data || []);
    } catch (err) {
      console.error("Error fetching pricing:", err);
      toast({ title: "Error", description: "Failed to load pricing", variant: "destructive" });
    }
  };

  const plansWithPricing = useMemo(() => {
    const pricingMap = new Map(pricing.map(p => [p.plan_id, p]));
    
    return plans
      .map(plan => {
        const customPricing = pricingMap.get(plan.id);
        const defaultRetail = plan.wholesale_price * 4; // 300% markup = 4x
        
        return {
          ...plan,
          retail_price: customPricing?.retail_price || defaultRetail,
          pricing_id: customPricing?.id,
          has_custom_price: !!customPricing,
        };
      })
      .filter(plan => 
        search === "" ||
        plan.title.toLowerCase().includes(search.toLowerCase()) ||
        plan.country_name.toLowerCase().includes(search.toLowerCase()) ||
        plan.country_code.toLowerCase().includes(search.toLowerCase())
      );
  }, [plans, pricing, search]);

  const stats = useMemo(() => {
    const total = plans.length;
    const customPriced = pricing.length;
    const defaultPriced = total - customPriced;
    
    return { total, customPriced, defaultPriced };
  }, [plans, pricing]);

  const handleAddPricing = async (planId: string, retailPrice: number) => {
    if (!selectedAgentId) return;

    try {
      const { error } = await supabase
        .from("agent_pricing")
        .insert({
          agent_id: selectedAgentId,
          plan_id: planId,
          retail_price: retailPrice,
        });

      if (error) throw error;

      toast({ title: "Success", description: "Custom pricing added" });
      await fetchPricing(selectedAgentId);
      setAddDialogOpen(false);
    } catch (err: any) {
      console.error("Error adding pricing:", err);
      toast({ 
        title: "Error", 
        description: err.message || "Failed to add pricing", 
        variant: "destructive" 
      });
    }
  };

  const handleUpdatePricing = async (pricingId: string, retailPrice: number) => {
    try {
      const { error } = await supabase
        .from("agent_pricing")
        .update({ retail_price: retailPrice })
        .eq("id", pricingId);

      if (error) throw error;

      toast({ title: "Success", description: "Pricing updated" });
      await fetchPricing(selectedAgentId);
      setEditDialogOpen(false);
    } catch (err) {
      console.error("Error updating pricing:", err);
      toast({ title: "Error", description: "Failed to update pricing", variant: "destructive" });
    }
  };

  const handleDeletePricing = async (pricingId: string) => {
    if (!confirm("Remove custom pricing? This plan will revert to the default 300% markup.")) return;

    try {
      const { error } = await supabase
        .from("agent_pricing")
        .delete()
        .eq("id", pricingId);

      if (error) throw error;

      toast({ title: "Success", description: "Custom pricing removed" });
      await fetchPricing(selectedAgentId);
    } catch (err) {
      console.error("Error deleting pricing:", err);
      toast({ title: "Error", description: "Failed to delete pricing", variant: "destructive" });
    }
  };

  const handleBulkUpload = async (file: File) => {
    if (!selectedAgentId) {
      toast({ title: "Error", description: "Please select an agent first", variant: "destructive" });
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
      transform: (value) => (typeof value === "string" ? value.trim() : value),
      complete: async (results) => {
        try {
          console.log("CSV parsing complete. Total rows:", results.data.length);
          console.log("Total plans available for validation:", plans.length);
          console.log("Sample plan IDs from database:", plans.slice(0, 3).map(p => p.id));
          
          const records = results.data as any[];
          const validRecords = [];
          const errors = [];

          // Validate CSV data
          for (let i = 0; i < records.length; i++) {
            const row = records[i] as Record<string, any>;
            const rowNum = i + 2; // +2 because: 1 for header, 1 for 0-index

            // Normalize/clean values from potential Excel exports
            const rawPlanIdInput = String(
              row.plan_id ?? row["plan_id"] ?? row["plan id"] ?? row["plan-id"] ?? row["Plan ID"] ?? ""
            ).trim();
            
            // Skip Excel error values
            if (/^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!)$/i.test(rawPlanIdInput)) {
              console.log(`Row ${rowNum}: Skipping Excel error value "${rawPlanIdInput}"`);
              continue;
            }
            
            const uuidMatch = rawPlanIdInput.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
            const planId = uuidMatch ? uuidMatch[0] : rawPlanIdInput.replace(/^#/, "");

            const rawPriceInput = String(
              row.retail_price ?? row["retail_price"] ?? row["retail price"] ?? row["Retail Price"] ?? ""
            ).trim();
            
            // Skip Excel error values in price column too
            if (/^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!)$/i.test(rawPriceInput)) {
              console.log(`Row ${rowNum}: Skipping Excel error value in price "${rawPriceInput}"`);
              continue;
            }
            
            const priceStr = rawPriceInput
              .replace(/,/g, "")
              .replace(/^[^\d-]*/, "") // strip currency symbols at start
              .replace(/\s+/g, "");
            const price = parseFloat(priceStr);

            if (!planId || !rawPriceInput) {
              errors.push(`Row ${rowNum}: Missing plan_id or retail_price`);
              continue;
            }

            const planExists = plans.find((p) => p.id === planId);
            if (!planExists) {
              errors.push(`Row ${rowNum}: Invalid plan_id "${rawPlanIdInput}"`);
              continue;
            }

            if (isNaN(price) || price <= 0) {
              errors.push(`Row ${rowNum}: Invalid retail_price "${rawPriceInput}"`);
              continue;
            }

            const minPrice = Number(planExists.wholesale_price) * 1.05;
            if (price < minPrice) {
              errors.push(
                `Row ${rowNum}: Price $${price.toFixed(2)} below minimum $${minPrice.toFixed(2)}`
              );
              continue;
            }

            validRecords.push({
              agent_id: selectedAgentId,
              plan_id: planId,
              retail_price: price,
            });
          }

          // We won't block the whole import on errors; we'll import valid rows and report skips
          const skippedCount = errors.length;
          if (skippedCount > 0) {
            const firstFiveErrors = errors.slice(0, 5).join("; ");
            console.warn("CSV validation errors (skipped):", errors);
            toast({
              title: "Some rows will be skipped",
              description: `${skippedCount} invalid rows detected. First: ${firstFiveErrors}`,
            });
          }

          if (validRecords.length === 0) {
            toast({ title: "No valid rows", description: "0 rows to import. Check errors in console.", variant: "destructive" });
            return;
          }

          // Deduplicate by (agent_id, plan_id) to avoid ON CONFLICT updating same row twice
          const uniqueMap = new Map<string, { agent_id: string; plan_id: string; retail_price: number }>();
          for (const rec of validRecords) {
            uniqueMap.set(`${rec.agent_id}:${rec.plan_id}`, rec); // last one wins
          }
          const uniqueRecords = Array.from(uniqueMap.values());
          const duplicateCount = validRecords.length - uniqueRecords.length;
          if (duplicateCount > 0) {
            toast({ title: "Duplicates collapsed", description: `${duplicateCount} duplicate plan entries consolidated.` });
          }

          // Delete all existing pricing for this agent, then insert fresh records
          const { error: delErr } = await supabase
            .from("agent_pricing")
            .delete()
            .eq("agent_id", selectedAgentId);

          if (delErr) {
            console.error("Delete error:", delErr);
            throw delErr;
          }

          // Insert fresh records in batches
          const insertBatchSize = 500;
          for (let i = 0; i < uniqueRecords.length; i += insertBatchSize) {
            const batch = uniqueRecords.slice(i, i + insertBatchSize);
            const { error: insErr } = await supabase
              .from("agent_pricing")
              .insert(batch);
            if (insErr) {
              console.error("Insert error:", insErr);
              throw insErr;
            }
          }

          toast({
            title: "Import complete",
            description: `Imported ${uniqueRecords.length} pricing records. Skipped ${skippedCount}${duplicateCount ? `, Duplicates ${duplicateCount}` : ""}.`,
          });
          await fetchPricing(selectedAgentId);
          setBulkUploadOpen(false);
        } catch (err: any) {
          console.error("Error importing CSV:", err);
          toast({
            title: "Error",
            description: err.message || "Failed to import CSV",
            variant: "destructive",
          });
        }
      },
      error: (err) => {
        toast({
          title: "Error",
          description: `Failed to parse CSV: ${err.message}`,
          variant: "destructive",
        });
      },
    });
  };

  const downloadTemplate = () => {
    const csv = `plan_id,retail_price\n# Example rows:\n# ${plans[0]?.id || 'plan-uuid-here'},50.00\n# ${plans[1]?.id || 'another-plan-uuid'},75.00`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricing-template-${selectedAgentId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <Layout>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Agent Pricing Manager</h1>
          <p className="text-muted-foreground">
            Configure custom pricing per plan for each agent. Default: 300% markup on wholesale.
          </p>
        </header>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Custom Priced</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.customPriced}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Default (300%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.defaultPriced}</div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select agent..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map(agent => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Search plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />

          <div className="flex gap-2">
            <Button onClick={() => fetchPricing(selectedAgentId)} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <AddPricingDialog
              plans={plansWithPricing.filter(p => !p.has_custom_price)}
              onAdd={handleAddPricing}
              open={addDialogOpen}
              onOpenChange={setAddDialogOpen}
            />

            <BulkUploadDialog
              onUpload={handleBulkUpload}
              onDownloadTemplate={downloadTemplate}
              open={bulkUploadOpen}
              onOpenChange={setBulkUploadOpen}
            />
          </div>
        </div>

        {/* Plans Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead>Plan Title</TableHead>
                      <TableHead>Data / Validity</TableHead>
                      <TableHead className="text-right">Wholesale</TableHead>
                      <TableHead className="text-right">Retail Price</TableHead>
                      <TableHead className="text-right">Markup</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plansWithPricing.map(plan => {
                      const markupPercent = ((plan.retail_price! - plan.wholesale_price) / plan.wholesale_price * 100).toFixed(0);
                      
                      return (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">
                            {plan.country_code} {plan.country_name}
                          </TableCell>
                          <TableCell>{plan.title}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {plan.data_amount} • {plan.validity_days}d
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${plan.wholesale_price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            ${plan.retail_price!.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={plan.has_custom_price ? "text-green-600" : "text-orange-600"}>
                              +{markupPercent}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-xs px-2 py-1 rounded ${plan.has_custom_price ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                              {plan.has_custom_price ? "Custom" : "Default"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {plan.has_custom_price ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedPlan(plan);
                                    setEditDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeletePricing(plan.pricing_id!)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPlan(plan);
                                  setAddDialogOpen(true);
                                }}
                              >
                                Set Price
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {plansWithPricing.length === 0 && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            No plans found matching your search.
          </div>
        )}

        {/* Edit Dialog */}
        {selectedPlan && (
          <EditPricingDialog
            plan={selectedPlan}
            onUpdate={(price) => handleUpdatePricing(selectedPlan.pricing_id!, price)}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
          />
        )}
      </div>
    </Layout>
  );
}

// Add Pricing Dialog Component
function AddPricingDialog({ 
  plans, 
  onAdd, 
  open, 
  onOpenChange 
}: { 
  plans: PlanWithPricing[]; 
  onAdd: (planId: string, price: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [price, setPrice] = useState("");

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const minPrice = selectedPlan ? selectedPlan.wholesale_price * 1.05 : 0;

  const handleSubmit = () => {
    const priceNum = parseFloat(price);
    if (!selectedPlanId || !priceNum || priceNum < minPrice) {
      return;
    }
    onAdd(selectedPlanId, priceNum);
    setSelectedPlanId("");
    setPrice("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Pricing
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Pricing</DialogTitle>
          <DialogDescription>
            Set a custom retail price for a specific plan. Minimum 5% above wholesale.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Plan</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a plan..." />
              </SelectTrigger>
              <SelectContent>
                {plans.map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.country_code} - {plan.title} (${plan.wholesale_price})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPlan && (
            <>
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                <div>Wholesale: ${selectedPlan.wholesale_price.toFixed(2)}</div>
                <div>Minimum Price: ${minPrice.toFixed(2)} (5% markup)</div>
                <div>Default Price: ${(selectedPlan.wholesale_price * 4).toFixed(2)} (300% markup)</div>
              </div>

              <div>
                <Label>Retail Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={minPrice}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Enter retail price..."
                />
              </div>

              <Button onClick={handleSubmit} className="w-full" disabled={!price || parseFloat(price) < minPrice}>
                Add Pricing
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Pricing Dialog Component
function EditPricingDialog({
  plan,
  onUpdate,
  open,
  onOpenChange,
}: {
  plan: PlanWithPricing;
  onUpdate: (price: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [price, setPrice] = useState(plan.retail_price?.toString() || "");
  const minPrice = plan.wholesale_price * 1.05;

  const handleSubmit = () => {
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum < minPrice) return;
    onUpdate(priceNum);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Pricing</DialogTitle>
          <DialogDescription>
            Update retail price for: {plan.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
            <div>Plan: {plan.country_code} - {plan.title}</div>
            <div>Wholesale: ${plan.wholesale_price.toFixed(2)}</div>
            <div>Minimum: ${minPrice.toFixed(2)}</div>
            <div>Current: ${plan.retail_price?.toFixed(2)}</div>
          </div>

          <div>
            <Label>New Retail Price ($)</Label>
            <Input
              type="number"
              step="0.01"
              min={minPrice}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={!price || parseFloat(price) < minPrice}>
            Update Price
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Bulk Upload Dialog Component
function BulkUploadDialog({
  onUpload,
  onDownloadTemplate,
  open,
  onOpenChange,
}: {
  onUpload: (file: File) => void;
  onDownloadTemplate: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (file) {
      onUpload(file);
      setFile(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Upload Pricing</DialogTitle>
          <DialogDescription>
            Upload a CSV file with plan_id and retail_price columns.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm bg-muted p-4 rounded space-y-2">
            <div className="font-medium">CSV Format Requirements:</div>
            <code className="block text-xs">plan_id,retail_price</code>
            <div className="text-muted-foreground">
              • plan_id: UUID from esim_plans table<br />
              • retail_price: Must be ≥ wholesale × 1.05<br />
              • Duplicates will update existing records
            </div>
          </div>

          <Button onClick={onDownloadTemplate} variant="outline" className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          <div>
            <Label>Upload CSV File</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={!file}>
            <Upload className="h-4 w-4 mr-2" />
            Upload & Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
