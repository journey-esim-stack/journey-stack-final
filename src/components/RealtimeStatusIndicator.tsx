import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useRealtimeESimStatus } from '@/hooks/useRealtimeESimStatus';

const RealtimeStatusIndicator: React.FC = () => {
  const { isConnected, lastSync, triggerSync } = useRealtimeESimStatus();

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/80 backdrop-blur-sm p-3 rounded-lg border">
      <div className="flex items-center gap-2">
        {isConnected ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        <Badge variant={isConnected ? "default" : "destructive"}>
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Last sync: {formatLastSync(lastSync)}
      </div>
      
      <Button
        size="sm"
        variant="outline"
        onClick={triggerSync}
        className="h-8 w-8 p-0"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default RealtimeStatusIndicator;