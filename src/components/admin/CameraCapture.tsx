"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, dataUrl: string) => void;
  facingMode?: "environment" | "user";
};

export function CameraCapture({
  open,
  onClose,
  onCapture,
  facingMode = "environment",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      void Promise.resolve().then(stop);
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setError(null);
    });

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not supported in this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not open camera. Allow camera permission and try again.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facingMode, stop]);

  function capture() {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file, dataUrl);
        onClose();
      },
      "image/jpeg",
      0.88,
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg border border-line bg-forest-deep p-4 text-charcoal shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">Capture photo</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink-soft hover:text-charcoal"
          >
            Close
          </button>
        </div>
        <div className="relative mt-4 aspect-[4/3] overflow-hidden bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {!ready && !error && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft">
              Starting camera…
            </p>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-ember">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!ready}
            onClick={capture}
            className="bg-ember px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Take photo
          </button>
          <label className="cursor-pointer border border-line px-5 py-2.5 text-sm text-charcoal/80 hover:bg-white">
            Choose file
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  onCapture(file, String(reader.result));
                  onClose();
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
