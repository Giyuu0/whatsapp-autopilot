"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Records a voice note with the browser mic and hands the parent the raw audio
 * (base64 + mimetype). The parent is responsible for actually sending it (the
 * server transcodes to Ogg/Opus for a proper WhatsApp voice note).
 *
 * Idle → a round mic button. Recording → an inline pill with a live timer, a
 * cancel (✕) and a send (arrow) button.
 */
export function VoiceRecorder({
  onSend,
  disabled,
  size = "md",
}: {
  onSend: (base64: string, mimetype: string) => Promise<void> | void;
  disabled?: boolean;
  size?: "md" | "sm";
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);

  const dim = size === "sm" ? "h-9 w-9" : "h-11 w-11";

  useEffect(() => {
    return () => {
      // Cleanup on unmount — stop any live recording/stream.
      try {
        recRef.current?.state === "recording" && recRef.current.stop();
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function stopTimerAndStream() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start() {
    if (disabled || recording || busy) return;
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      cancelRef.current = false;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stopTimerAndStream();
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (cancelRef.current || blob.size < 400) return; // cancelled or too short
        setBusy(true);
        try {
          const base64 = await blobToBase64(blob);
          await onSend(base64, blob.type || "audio/webm");
        } catch (e: any) {
          setErr(e?.message || "Failed to send");
        } finally {
          setBusy(false);
        }
      };
      rec.start();
      setRecording(true);
      setSecs(0);
      timerRef.current = setInterval(() => {
        setSecs((s) => {
          if (s >= 299) stop(); // hard cap at 5 min
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      setErr(e?.name === "NotAllowedError" ? "Mic permission denied" : "Mic unavailable");
      stopTimerAndStream();
    }
  }

  function stop() {
    if (recRef.current && recRef.current.state !== "inactive") {
      try {
        recRef.current.stop();
      } catch {}
    }
  }

  function cancel() {
    cancelRef.current = true;
    stop();
  }

  if (recording) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-1 ring-1 ring-inset ring-red-400/30">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="min-w-[34px] text-center text-xs font-medium tabular-nums text-red-300">
          {fmt(secs)}
        </span>
        <button
          type="button"
          onClick={cancel}
          title="Cancel"
          aria-label="Cancel recording"
          className="flex h-10 w-10 items-center justify-center rounded-full text-fg/60 transition hover:bg-fg/10 hover:text-fg/90 active:scale-95 md:h-8 md:w-8"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={stop}
          title="Send voice note"
          aria-label="Send voice note"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-wa-green text-ink-950 transition active:scale-95 md:h-8 md:w-8"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled || busy}
      title={err || "Record a voice note"}
      aria-label="Record a voice note"
      className={`btn-ghost ${dim} shrink-0 rounded-full !p-0 transition active:scale-95 ${
        err ? "text-red-300" : ""
      }`}
    >
      {busy ? (
        <span className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-fg/20 border-t-wa-green" />
      ) : (
        <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
        </svg>
      )}
    </button>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
