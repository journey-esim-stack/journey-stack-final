import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  className?: string;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ 
  value, 
  size = 192, 
  className = "border rounded-lg" 
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const url = await QRCode.toDataURL(value, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeUrl(url);
        setError('');
      } catch (err) {
        console.error('Failed to generate QR code:', err);
        setError('Failed to generate QR code');
      }
    };

    if (value) {
      generateQRCode();
    }
  }, [value, size]);

  if (error) {
    return (
      <div className="flex items-center justify-center w-48 h-48 border rounded-lg bg-muted">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!qrCodeUrl) {
    return (
      <div className="flex items-center justify-center w-48 h-48 border rounded-lg bg-muted">
        <p className="text-sm text-muted-foreground">Generating QR code...</p>
      </div>
    );
  }

  return (
    <img 
      src={qrCodeUrl} 
      alt="Generated QR Code" 
      className={className}
      style={{ width: size, height: size }}
    />
  );
};

export default QRCodeGenerator;