import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Download, QrCode, Smartphone, Calendar, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ESimDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    esim_iccid: string;
    esim_qr_code?: string;
    activation_code?: string;
    status: string;
    created_at: string;
    customer_name: string;
    customer_email: string;
    esim_plans?: {
      title: string;
      country_name: string;
      data_amount: string;
      validity_days: number;
    };
  };
}

export const ESimDetailModal: React.FC<ESimDetailModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const { toast } = useToast();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const downloadQR = () => {
    if (!order.esim_qr_code) return;
    
    const link = document.createElement('a');
    link.href = order.esim_qr_code;
    link.download = `esim-qr-${order.esim_iccid}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            eSIM Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status & Basic Info */}
          <div className="flex items-center justify-between">
            <Badge className={getStatusColor(order.status)}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created {new Date(order.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Customer Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Customer</label>
                  <p className="text-sm">{order.customer_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{order.customer_email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium">{order.esim_plans?.title || 'N/A'}</h4>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {order.esim_plans?.validity_days || 'N/A'} days
                    </div>
                    <div>
                      <span className="font-medium">{order.esim_plans?.data_amount || 'N/A'}</span> data
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {order.esim_plans?.country_name || 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ICCID */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ICCID</label>
                  <p className="font-mono text-sm break-all">{order.esim_iccid}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(order.esim_iccid, 'ICCID')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* QR Code */}
          {order.esim_qr_code && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <QrCode className="h-4 w-4" />
                    QR Code for Installation
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                      <img
                        src={order.esim_qr_code}
                        alt="eSIM QR Code"
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(order.esim_qr_code!, 'QR Code URL')}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadQR}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activation Code */}
          {order.activation_code && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    Activation Code (Manual Setup)
                  </label>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="font-mono text-sm break-all">{order.activation_code}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(order.activation_code!, 'Activation Code')}
                    className="w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Activation Code
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card className="bg-blue-50/50 border-blue-200">
            <CardContent className="pt-6">
              <h4 className="font-medium text-blue-900 mb-2">Installation Instructions</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Scan the QR code with your device's camera</li>
                <li>Follow the on-screen prompts to install the eSIM</li>
                <li>Enable the eSIM when prompted</li>
                <li>Your eSIM will be ready to use!</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};