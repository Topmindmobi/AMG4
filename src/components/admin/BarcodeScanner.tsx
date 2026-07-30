"use client";

import { Html5Qrcode, type Html5QrcodeCameraScanConfig } from "html5-qrcode";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
};

export function BarcodeScanner({ open, onClose, onScan }: Props) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const handled = useRef(false);

  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    handled.current = false;
    setError(null);
    let cancelled = false;

    async function start() {
      try {
        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) {
          throw new Error("No camera found for barcode scanning.");
        }
        const back =
          cameras.find((c) => /back|rear|environment/i.test(c.label)) ??
          cameras[cameras.length - 1];

        const config: Html5QrcodeCameraScanConfig = {
          fps: 10,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.333,
        };

        await scanner.start(
          back.id,
          config,
          (decoded) => {
            if (handled.current || cancelled) return;
            handled.current = true;
            onScanRef.current(decoded.trim());
            onCloseRef.current();
          },
          () => {
            /* ignore frame failures */
          },
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not start barcode scanner.",
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner?.isScanning) {
        void scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      } else {
        try {
          scanner?.clear();
        } catch {
          /* ignore */
        }
      }
    };
  }, [open, regionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg border border-white/15 bg-forest-deep p-4 text-sand-light shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">Scan barcode</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-sand/60 hover:text-sand"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-xs text-sand/55">
          Point the camera at a barcode or QR code. EAN, UPC, Code 128, and QR are supported.
        </p>
        <div
          id={regionId}
          className="mt-4 overflow-hidden rounded-sm bg-black [&_video]:max-h-72 [&_video]:w-full [&_video]:object-cover"
        />
        {error && <p className="mt-3 text-sm text-ember">{error}</p>}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!manual.trim()) return;
            onScan(manual.trim());
            onClose();
          }}
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Or type barcode manually"
            className="min-w-0 flex-1 border border-white/15 bg-white/5 px-3 py-2 text-sm text-sand"
          />
          <button
            type="submit"
            className="bg-ember px-4 py-2 text-sm font-semibold text-white"
          >
            Use
          </button>
        </form>
      </div>
    </div>
  );
}
