import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAgentPreview } from '@/contexts/AgentPreviewContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Eye } from 'lucide-react';

interface Agent {
  id: string;
  company_name: string;
}

export const AgentPreviewSelector = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const { previewAgentId, setPreviewAgentId } = useAgentPreview();

  useEffect(() => {
    checkAdminAndLoadAgents();
  }, []);

  const checkAdminAndLoadAgents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) return;
      
      setIsAdmin(true);

      // Load approved agents
      const { data: agentsData } = await supabase
        .from('agent_profiles')
        .select('id, company_name')
        .eq('status', 'approved')
        .order('company_name');

      if (agentsData) {
        setAgents(agentsData);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  if (!isAdmin || agents.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
      <Eye className="h-5 w-5 text-orange-600" />
      <div className="flex-1">
        <Label className="text-sm font-medium text-orange-900">
          Admin Preview Mode
        </Label>
        <Select 
          value={previewAgentId || 'none'} 
          onValueChange={(value) => setPreviewAgentId(value === 'none' ? null : value)}
        >
          <SelectTrigger className="mt-1 bg-white">
            <SelectValue placeholder="Preview as agent..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">My Agent View (Default)</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
