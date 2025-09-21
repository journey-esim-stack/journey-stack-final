import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

export default function QrView() {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  const code = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("code") || "";
  }, []);

  useEffect(() => {
    if (!code) {
      setError("Missing QR code data.");
      return;
    }
    (async () => {
      try {
        const url = await QRCode.toDataURL(code, {
          margin: 1,
          scale: 8,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        setDataUrl(url);
      } catch (e) {
        console.error("QR render failed", e);
        setError("Failed to render QR code.");
      }
    })();
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold mb-4">eSIM Activation QR</h1>
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : dataUrl ? (
          <img
            src={dataUrl}
            alt="eSIM Activation QR Code"
            className="w-full h-auto border rounded-lg"
          />
        ) : (
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        )}
        {code && (
          <p className="mt-4 text-sm text-muted-foreground break-all">
            LPA: {code}
          </p>
        )}
      </div>
    </div>
  );
}
