"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { v4 as uuidv4 } from "uuid";
import { enableWakeLock, disableWakeLock } from "@/lib/wake-lock";

export type CallPhase =
  | "idle"
  | "connecting"
  | "ringing"
  | "connected"
  | "disconnecting";

export type DialerRuntimeConfig = {
  testMode: boolean;
  storageConfigured: boolean;
  twilioConfigured: boolean;
};

export function usePhoneCall() {
  const [config, setConfig] = useState<DialerRuntimeConfig | null>(null);
  const testMode = config?.testMode ?? true;

  const [deviceReady, setDeviceReady] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [callStatusLabel, setCallStatusLabel] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [speakerSupported, setSpeakerSupported] = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const onDisconnectRef = useRef<
    ((endedSessionId: string | null) => void | Promise<void>) | null
  >(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    void fetch("/api/dialer/config")
      .then((r) => r.json())
      .then((json) => {
        setConfig({
          testMode: Boolean(json.testMode),
          storageConfigured: Boolean(json.storageConfigured),
          twilioConfigured: Boolean(json.twilioConfigured),
        });
      })
      .catch(() => {
        setConfig({
          testMode: true,
          storageConfigured: false,
          twilioConfigured: false,
        });
      });
  }, []);

  const getSessionId = useCallback(() => sessionIdRef.current, []);

  const attachCallHandlers = useCallback(
    (call: Call) => {
      call.on("accept", () => {
        setCallPhase("connected");
        setCallStatusLabel("Connected — use speaker for prospect audio");
      });

      call.on("ringing", () => {
        setCallPhase("ringing");
        setCallStatusLabel("Ringing…");
      });

      call.on("disconnect", () => {
        const handler = onDisconnectRef.current;
        onDisconnectRef.current = null;
        void endCallInternal(handler ?? undefined);
      });

      call.on("cancel", () => {
        setError("Call cancelled");
        void endCallInternal();
      });

      call.on("reject", () => {
        setError("Call declined or busy");
        void endCallInternal();
      });

      call.on("error", (e) => {
        const msg = e.message || "Call error";
        setError(
          msg.includes("verified")
            ? `${msg} — Twilio trial accounts can only call verified numbers.`
            : msg,
        );
        void endCallInternal();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- endCallInternal stable via refs
    [],
  );

  const endCallInternal = useCallback(
    async (after?: (endedSessionId: string | null) => void | Promise<void>) => {
      setCallPhase("disconnecting");
      setCallStatusLabel("Ending call…");

      const endedSessionId = sessionIdRef.current;
      onDisconnectRef.current = null;

      const call = activeCallRef.current;
      if (call && call.status() !== Call.State.Closed) {
        call.disconnect();
      }
      activeCallRef.current = null;

      try {
        deviceRef.current?.disconnectAll();
      } catch {
        /* ignore */
      }

      setCalling(false);
      setCallPhase("idle");
      setCallStatusLabel("");
      await disableWakeLock();
      setSessionId(null);
      sessionIdRef.current = null;
      if (after) await after(endedSessionId);
    },
    [],
  );

  useEffect(() => {
    if (config === null || testMode) return;

    let cancelled = false;

    async function initDevice() {
      try {
        const res = await fetch("/api/twilio/token");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Token failed");

        const device = new Device(json.token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          closeProtection: true,
        });

        device.on("registered", () => {
          if (!cancelled) setDeviceReady(true);
        });
        device.on("error", (e) => {
          if (!cancelled) setError(e.message);
        });

        await device.register();
        deviceRef.current = device;

        const audio = device.audio;
        if (audio?.speakerDevices) {
          setSpeakerSupported(true);
          try {
            await audio.speakerDevices.set("default");
            setSpeakerOn(true);
          } catch {
            setSpeakerSupported(false);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Twilio init failed");
        }
      }
    }

    void initDevice();

    return () => {
      cancelled = true;
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, [config, testMode]);

  const toggleSpeaker = useCallback(async () => {
    const device = deviceRef.current;
    if (!device?.audio?.speakerDevices) {
      setCallStatusLabel("On iPhone: tap the audio icon in the call bar for speaker");
      return;
    }
    try {
      const next = !speakerOn;
      if (next) {
        await device.audio.speakerDevices.set("default");
      } else {
        const earpiece = Array.from(device.audio.speakerDevices.get()).find(
          (d) => d.deviceId !== "default",
        );
        if (earpiece) {
          await device.audio.speakerDevices.set(earpiece.deviceId);
        }
      }
      setSpeakerOn(next);
    } catch {
      setCallStatusLabel("Use Control Center audio picker for speakerphone");
    }
  }, [speakerOn]);

  const endCall = endCallInternal;

  const startCall = useCallback(
    async (
      phoneE164: string,
      opts?: {
        beforeConnect?: (sessionId: string) => Promise<void>;
        onDisconnect?: (endedSessionId: string | null) => void | Promise<void>;
      },
    ) => {
      if (calling) {
        await endCallInternal();
        return;
      }

      setError(null);
      const sid = uuidv4();
      setSessionId(sid);
      sessionIdRef.current = sid;
      onDisconnectRef.current = opts?.onDisconnect ?? null;

      try {
        await enableWakeLock();

        if (testMode) {
          if (opts?.beforeConnect) await opts.beforeConnect(sid);
          setCalling(true);
          setCallPhase("connected");
          setCallStatusLabel(
            "Test mode — no real call. Set STORAGE_API_* on Vercel for live dialing.",
          );
          return;
        }

        if (!config?.twilioConfigured) {
          throw new Error(
            "Twilio not configured on server — add TWILIO_* env vars on Vercel",
          );
        }

        if (!deviceRef.current) {
          throw new Error("Phone not ready — allow mic access and refresh");
        }

        setCalling(true);
        setCallPhase("connecting");
        setCallStatusLabel("Connecting…");

        if (opts?.beforeConnect) await opts.beforeConnect(sid);

        const call = await deviceRef.current.connect({
          params: { To: phoneE164, sessionId: sid },
        });

        activeCallRef.current = call;
        attachCallHandlers(call);

        if (call.status() === Call.State.Open) {
          setCallPhase("connected");
          setCallStatusLabel("Connected");
        } else {
          setCallStatusLabel("Dialing…");
        }
      } catch (e) {
        onDisconnectRef.current = null;
        const message = e instanceof Error ? e.message : "Call failed";
        setError(message);
        setCalling(false);
        setCallPhase("idle");
        setCallStatusLabel("");
        await disableWakeLock();
        setSessionId(null);
        sessionIdRef.current = null;
      }
    },
    [
      calling,
      testMode,
      config?.twilioConfigured,
      endCallInternal,
      attachCallHandlers,
    ],
  );

  return {
    config,
    testMode,
    deviceReady,
    calling,
    callPhase,
    callStatusLabel,
    sessionId,
    getSessionId,
    error,
    setError,
    startCall,
    endCall,
    speakerOn,
    speakerSupported,
    toggleSpeaker,
  };
}
