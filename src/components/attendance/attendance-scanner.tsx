"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, CheckCircle2, Keyboard, RefreshCw, ScanLine } from "lucide-react";

import {
  AttendanceConfirmationDialog,
  type ConfirmPhase,
} from "@/components/attendance/attendance-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  lookupRegistrationForCheckIn,
  recordAttendance,
  type AttendeePreview,
} from "@/lib/actions/attendance";

export function AttendanceScanner({ eventId }: { eventId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const startingRef = useRef(false);
  const stoppedRef = useRef(false);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [preview, setPreview] = useState<AttendeePreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phase, setPhase] = useState<ConfirmPhase>("review");
  const [dialogMessage, setDialogMessage] = useState<string | null>(null);
  const [lastCheckedIn, setLastCheckedIn] = useState<string | null>(null);

  const [deviceId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}`,
  );

  const openPreview = useCallback((data: AttendeePreview) => {
    setPreview(data);
    if (data.registrationStatus === "cancelled") {
      // The record_attendance RPC would reject this anyway; surface it before
      // the confirm button instead of after.
      setDialogMessage("This registration was cancelled.");
      setPhase("error");
    } else {
      setDialogMessage(
        data.alreadyCheckedIn ? "This attendee is already checked in." : null,
      );
      setPhase(data.alreadyCheckedIn ? "already" : "review");
    }
    setDialogOpen(true);
  }, []);

  const runLookup = useCallback(
    async (args: { token?: string; code?: string }) => {
      busyRef.current = true;
      setLookingUp(true);
      setLookupError(null);
      try {
        const result = await lookupRegistrationForCheckIn({ eventId, ...args });
        if (!result.ok) {
          setLookupError(result.error);
          busyRef.current = false;
          return;
        }
        openPreview(result.data);
      } catch {
        // Network/server failure must never leave the scanner stuck busy.
        setLookupError("Connection problem. Check your network and scan again.");
        busyRef.current = false;
      } finally {
        setLookingUp(false);
      }
    },
    [eventId, openPreview],
  );

  const handleDetected = useCallback(
    (text: string) => {
      if (busyRef.current || dialogOpen) return;
      const value = text.trim();
      const now = Date.now();
      if (value === lastScanRef.current.value && now - lastScanRef.current.at < 3000) {
        return;
      }
      lastScanRef.current = { value, at: now };
      // Signed tokens start with "v1."; anything else is treated as a pass code.
      void runLookup(value.startsWith("v1.") ? { token: value } : { code: value });
    },
    [dialogOpen, runLookup],
  );

  // Keep the zxing callback identity stable so the camera stream survives
  // re-renders (dialog open/close) instead of restarting on every scan.
  const detectRef = useRef(handleDetected);
  useEffect(() => {
    detectRef.current = handleDetected;
  }, [handleDetected]);

  const startCamera = useCallback(async () => {
    const video = videoRef.current;
    if (!video || controlsRef.current || startingRef.current) return;
    startingRef.current = true;
    setCameraError(null);
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        video,
        (result) => {
          if (result) detectRef.current(result.getText());
        },
      );
      if (stoppedRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
    } catch {
      setCameraError("Camera unavailable. Grant camera access or use manual code entry.");
    } finally {
      startingRef.current = false;
    }
  }, []);

  const restartCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    stoppedRef.current = false;
    void startCamera();
  }, [startCamera]);

  useEffect(() => {
    stoppedRef.current = false;
    void startCamera();
    return () => {
      stoppedRef.current = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [startCamera]);

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current || !manualCode.trim()) return;
    void runLookup({ code: manualCode.trim() });
  };

  const onConfirm = async () => {
    if (!preview) return;
    setPhase("saving");
    setDialogMessage(null);
    let result: Awaited<ReturnType<typeof recordAttendance>>;
    try {
      result = await recordAttendance({
        eventId,
        registrationId: preview.registrationId,
        deviceId,
      });
    } catch {
      setPhase("error");
      setDialogMessage(
        "Connection problem — the check-in may not have saved. Scan again to verify.",
      );
      return;
    }
    if (!result.ok) {
      setPhase("error");
      setDialogMessage(result.error);
      return;
    }
    if (result.data.status === "already") {
      setPhase("already");
      setDialogMessage("This attendee was already checked in.");
    } else {
      setPhase("success");
      setDialogMessage(`${preview.attendeeName} is checked in.`);
      setLastCheckedIn(preview.attendeeName);
      router.refresh();
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setPreview(null);
    setPhase("review");
    setDialogMessage(null);
    setManualCode("");
    busyRef.current = false;
  };

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden p-0">
        <div className="relative aspect-square w-full bg-black">
          <video
            ref={videoRef}
            className="size-full object-cover"
            muted
            playsInline
            autoPlay
          />
          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted p-6 text-center">
              <CameraOff className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-semibold text-muted-foreground">{cameraError}</p>
              <Button type="button" variant="outline" size="sm" onClick={restartCamera}>
                <RefreshCw aria-hidden="true" />
                Retry camera
              </Button>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-56 rounded-3xl border-4 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/35%)]" />
              <ScanLine
                className="absolute size-10 text-white/90"
                aria-hidden="true"
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <ScanLine className="size-4" aria-hidden="true" />
            {lookingUp ? "Checking registration…" : "Point the camera at the attendee's QR"}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={restartCamera}>
            <RefreshCw aria-hidden="true" />
            Restart
          </Button>
        </div>
        {lastCheckedIn ? (
          <p
            className="flex items-center gap-2 border-t border-border/70 px-4 py-2.5 text-sm font-bold text-success"
            aria-live="polite"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Last checked in: {lastCheckedIn}
          </p>
        ) : null}
      </Card>

      <Card className="p-4">
        <form onSubmit={onManualSubmit} className="grid gap-3">
          <Field
            label="Manual code entry"
            htmlFor="manualCode"
            hint="Enter the attendee's confirmation/pass code if the QR won't scan."
            error={lookupError ?? undefined}
          >
            <div className="flex gap-2">
              <Input
                id="manualCode"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. GEMA-7F3A9C21"
                autoCapitalize="characters"
                className="font-mono uppercase"
              />
              <Button type="submit" variant="brand" disabled={lookingUp || !manualCode.trim()}>
                <Keyboard aria-hidden="true" />
                Find
              </Button>
            </div>
          </Field>
        </form>
      </Card>

      <AttendanceConfirmationDialog
        open={dialogOpen}
        preview={preview}
        phase={phase}
        message={dialogMessage}
        onConfirm={onConfirm}
        onClose={closeDialog}
      />
    </div>
  );
}
