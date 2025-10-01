import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, RefreshCw, Database, Zap, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExportPlanUuidsButton } from '@/components/ExportPlanUuidsButton';

interface PricingRule {
  id: string;
  airtable_record_id: string;
  rule_type: string;
  target_id: string | null;
  plan_id: string | null;
  markup_type: string;
  markup_value: number;
  min_order_amount: number;
  max_order_amount: number | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface PlanInfo {
  id: string;
  title: string;
  country_code: string;
}

export default function AdminPricingRules() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [planInfo, setPlanInfo] = useState<Record<string, PlanInfo>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;
      
      setRules(data || []);
      
      // Fetch plan info for plan rules
      const planIds = data?.filter(r => r.rule_type === 'plan' && r.plan_id).map(r => r.plan_id) || [];
      if (planIds.length > 0) {
        const { data: plans } = await supabase
          .from('esim_plans')
          .select('id, title, country_code')
          .in('id', planIds);
        
        if (plans) {
          const planMap: Record<string, PlanInfo> = {};
          plans.forEach(p => {
            planMap[p.id] = p;
          });
          setPlanInfo(planMap);
        }
      }
      
      toast.success(`Loaded ${data?.length || 0} pricing rules`);
    } catch (error) {
      console.error('Error fetching pricing rules:', error);
      toast.error('Failed to fetch pricing rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();

    // Setup real-time updates
    const channel = supabase
      .channel('admin_pricing_rules')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pricing_rules',
        },
        (payload) => {
          console.log('Real-time pricing rules update:', payload);
          fetchRules();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredRules = rules.filter(rule =>
    rule.rule_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.target_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.airtable_record_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRuleTypeColor = (type: string) => {
    switch (type) {
      case 'agent': return 'bg-blue-100 text-blue-800';
      case 'country': return 'bg-green-100 text-green-800';
      case 'plan': return 'bg-purple-100 text-purple-800';
      case 'default': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMarkupDisplay = (rule: PricingRule) => {
    if (rule.markup_type === 'percent') {
      return `+${rule.markup_value}%`;
    } else {
      return `+$${rule.markup_value}`;
    }
  };

  const rulesByType = {
    agent: filteredRules.filter(r => r.rule_type === 'agent'),
    country: filteredRules.filter(r => r.rule_type === 'country'),
    plan: filteredRules.filter(r => r.rule_type === 'plan'),
    default: filteredRules.filter(r => r.rule_type === 'default'),
  };

  const stats = {
    total: rules.length,
    active: rules.filter(r => r.is_active).length,
    agents: rules.filter(r => r.rule_type === 'agent').length,
    countries: rules.filter(r => r.rule_type === 'country').length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Airtable Pricing Rules</h1>
              <p className="text-muted-foreground">
                Manage dynamic pricing rules synced from Airtable
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Real-time Connected" : "Disconnected"}
            </Badge>
            <ExportPlanUuidsButton />
            <Button 
              onClick={fetchRules} 
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Rules</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Database className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Rules</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <Zap className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Agent Rules</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.agents}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Country Rules</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.countries}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <Input
            placeholder="Search rules by type, target, or Airtable ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Rules Tables */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Rules ({filteredRules.length})</TabsTrigger>
            <TabsTrigger value="agent">Agent ({rulesByType.agent.length})</TabsTrigger>
            <TabsTrigger value="country">Country ({rulesByType.country.length})</TabsTrigger>
            <TabsTrigger value="plan">Plan ({rulesByType.plan.length})</TabsTrigger>
            <TabsTrigger value="default">Default ({rulesByType.default.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <RulesTable rules={filteredRules} loading={loading} getRuleTypeColor={getRuleTypeColor} getMarkupDisplay={getMarkupDisplay} planInfo={planInfo} />
          </TabsContent>

          <TabsContent value="agent">
            <RulesTable rules={rulesByType.agent} loading={loading} getRuleTypeColor={getRuleTypeColor} getMarkupDisplay={getMarkupDisplay} planInfo={planInfo} />
          </TabsContent>

          <TabsContent value="country">
            <RulesTable rules={rulesByType.country} loading={loading} getRuleTypeColor={getRuleTypeColor} getMarkupDisplay={getMarkupDisplay} planInfo={planInfo} />
          </TabsContent>

          <TabsContent value="plan">
            <RulesTable rules={rulesByType.plan} loading={loading} getRuleTypeColor={getRuleTypeColor} getMarkupDisplay={getMarkupDisplay} planInfo={planInfo} />
          </TabsContent>

          <TabsContent value="default">
            <RulesTable rules={rulesByType.default} loading={loading} getRuleTypeColor={getRuleTypeColor} getMarkupDisplay={getMarkupDisplay} planInfo={planInfo} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function RulesTable({ 
  rules, 
  loading, 
  getRuleTypeColor, 
  getMarkupDisplay,
  planInfo 
}: { 
  rules: PricingRule[]; 
  loading: boolean;
  getRuleTypeColor: (type: string) => string;
  getMarkupDisplay: (rule: PricingRule) => string;
  planInfo?: Record<string, PlanInfo>;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading pricing rules...</div>
        </CardContent>
      </Card>
    );
  }

  if (rules.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No pricing rules found. Rules will appear here once synced from Airtable.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Rules</CardTitle>
        <CardDescription>
          Rules are applied in priority order (lower number = higher priority)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Priority</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Target</th>
                <th className="text-left p-2">Markup</th>
                <th className="text-left p-2">Min Amount</th>
                <th className="text-left p-2">Max Amount</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b hover:bg-muted/50">
                  <td className="p-2">
                    <Badge variant="outline">{rule.priority}</Badge>
                  </td>
                  <td className="p-2">
                    <Badge className={getRuleTypeColor(rule.rule_type)}>
                      {rule.rule_type}
                    </Badge>
                  </td>
                  <td className="p-2 text-sm">
                    {rule.rule_type === 'plan' && rule.plan_id && planInfo?.[rule.plan_id] ? (
                      <div>
                        <div className="font-semibold">{planInfo[rule.plan_id].title}</div>
                        <div className="text-xs text-muted-foreground font-mono">{planInfo[rule.plan_id].country_code}</div>
                      </div>
                    ) : (
                      <span className="font-mono">{rule.target_id || '-'}</span>
                    )}
                  </td>
                  <td className="p-2 font-semibold">
                    {getMarkupDisplay(rule)}
                  </td>
                  <td className="p-2">${rule.min_order_amount}</td>
                  <td className="p-2">
                    {rule.max_order_amount ? `$${rule.max_order_amount}` : 'No limit'}
                  </td>
                  <td className="p-2">
                    <Badge variant={rule.is_active ? "default" : "secondary"}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-2 text-sm text-muted-foreground">
                    {new Date(rule.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}