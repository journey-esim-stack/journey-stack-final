import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Copy, Download, QrCode, Smartphone, Calendar, Globe, Edit, Save, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import QRCodeLib from "qrcode";

// QR Code Display Component
const QRCodeDisplay = ({ qrText, size = 256 }: { qrText: string; size?: number }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateQR = async () => {
      if (!qrText) return;
      
      try {
        setIsLoading(true);
        // Generate QR code from text
        const dataUrl = await QRCodeLib.toDataURL(qrText, {
          margin: 1,
          scale: 6,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateQR();
  }, [qrText]);

  if (!qrText) {
    return (
      <div className="flex items-center justify-center bg-white p-4 rounded-lg shadow-sm border" style={{ width: size, height: size }}>
        <div className="text-center">
          <QrCode className="h-12 w-12 mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">No QR Code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ width: size, height: size }}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : qrDataUrl ? (
          <img 
            src={qrDataUrl} 
            alt="eSIM QR Code"
            style={{ width: size, height: size }}
            className="object-contain"
          />
        ) : (
          <div className="flex items-center justify-center" style={{ width: size, height: size }}>
            <div className="text-center">
              <QrCode className="h-12 w-12 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Failed to generate QR</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ESimDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    esim_iccid: string;
    esim_qr_code?: string;
    activation_code?: string;
    manual_code?: string;
    smdp_address?: string;
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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({
    customer_name: order.customer_name,
    customer_email: order.customer_email,
  });

  // Reset edit data when order changes
  React.useEffect(() => {
    setEditData({
      customer_name: order.customer_name,
      customer_email: order.customer_email,
    });
    setIsEditing(false);
  }, [order.id, order.customer_name, order.customer_email]);

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

  const saveCustomerInfo = async () => {
    if (!editData.customer_name.trim() || !editData.customer_email.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editData.customer_email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          customer_name: editData.customer_name.trim(),
          customer_email: editData.customer_email.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) {
        console.error('Error updating customer info:', error);
        toast({
          title: "Update Failed",
          description: "Failed to update customer information",
          variant: "destructive",
        });
        return;
      }

      // Update the order object locally
      order.customer_name = editData.customer_name.trim();
      order.customer_email = editData.customer_email.trim();

      toast({
        title: "Updated!",
        description: "Customer information updated successfully",
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating customer info:', error);
      toast({
        title: "Update Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditData({
      customer_name: order.customer_name,
      customer_email: order.customer_email,
    });
    setIsEditing(false);
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
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-sm text-muted-foreground">Customer Information</h4>
                {!isEditing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="h-8 px-2 text-xs"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelEdit}
                      disabled={isSaving}
                      className="h-8 px-2 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={saveCustomerInfo}
                      disabled={isSaving}
                      className="h-8 px-2 text-xs"
                    >
                      {isSaving ? (
                        <div className="h-3 w-3 mr-1 animate-spin rounded-full border border-current border-t-transparent" />
                      ) : (
                        <Check className="h-3 w-3 mr-1" />
                      )}
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
              
              {!isEditing ? (
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
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Customer Name</label>
                    <Input
                      value={editData.customer_name}
                      onChange={(e) => setEditData(prev => ({ ...prev, customer_name: e.target.value }))}
                      placeholder="Enter customer name"
                      className="h-8"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Email</label>
                    <Input
                      type="email"
                      value={editData.customer_email}
                      onChange={(e) => setEditData(prev => ({ ...prev, customer_email: e.target.value }))}
                      placeholder="Enter email address"
                      className="h-8"
                    />
                  </div>
                </div>
              )}
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
                  
                   <QRCodeDisplay qrText={order.esim_qr_code} size={192} />

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

          {/* Manual Activation Details */}
          {(order.manual_code || order.activation_code) && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <label className="text-sm font-medium text-muted-foreground">
                    Manual Setup Information
                  </label>
                  
                  {/* Manual Code */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Activation Code</label>
                    <div className="bg-muted p-3 rounded-md">
                      <p className="font-mono text-sm break-all">
                        {order.manual_code || order.activation_code}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(order.manual_code || order.activation_code!, 'Manual Code')}
                      className="w-full"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Manual Code
                    </Button>
                  </div>

                  {/* SMDP Address */}
                  {order.smdp_address && (
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">SM-DP+ Address</label>
                      <div className="bg-muted p-3 rounded-md">
                        <p className="font-mono text-sm break-all">{order.smdp_address}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(order.smdp_address!, 'SM-DP+ Address')}
                        className="w-full"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy SM-DP+ Address
                      </Button>
                    </div>
                  )}
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