import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const ExportPlanUuidsButton = () => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      toast.info('Generating CSV export...');

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('export-plan-uuids', {
        method: 'GET',
      });

      if (error) throw error;

      // The function returns CSV as text, convert to blob and download
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plan-uuid-mapping.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('CSV downloaded successfully!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      variant="outline"
      size="sm"
    >
      <Download className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
      {loading ? 'Generating...' : 'Export Plan UUIDs CSV'}
    </Button>
  );
};
