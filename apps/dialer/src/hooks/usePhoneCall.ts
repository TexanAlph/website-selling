"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { v4 as uuidv4 } from "uuid";
import { enableWakeLock, disableWakeLock } from "@/lib/wake-lock";
import { isTestDialerMode } from "@/lib/test-dialer";

export function usePhoneCall() {
  const testMode = isTestDialerMode();
  const [deviceReady, setDeviceReady] = useState(testMode);
  const [calling, setCalling] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const onDisconnectRef = useRef<
    ((endedSessionId: string | null) => void | Promise<void>) | null
  >(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const getSessionId = useCallback(() => sessionIdRef.current, []);

  useEffect(() => {
    if (testMode) return;

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
  }, [testMode]);

  const endCall = useCallback(
    async (after?: (endedSessionId: string | null) => void | Promise<void>) => {
      const endedSessionId = sessionIdRef.current;
      onDisconnectRef.current = null;
      if (activeCallRef.current) {
        activeCallRef.current.disconnect();
        activeCallRef.current = null;
      }
      setCalling(false);
      await disableWakeLock();
      setSessionId(null);
      sessionIdRef.current = null;
      if (after) await after(endedSessionId);
    },
    [],
  );

  const startCall = useCallback(
    async (
      phoneE164: string,
      opts?: {
        beforeConnect?: (sessionId: string) => Promise<void>;
        onDisconnect?: (endedSessionId: string | null) => void | Promise<void>;
      },
    ) => {
      if (calling) {
        await endCall();
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
          return;
        }

        if (!deviceRef.current) {
          throw new Error("Phone not ready — check Twilio settings");
        }

        if (opts?.beforeConnect) await opts.beforeConnect(sid);

        const call = await deviceRef.current.connect({
          params: { To: phoneE164, sessionId: sid },
        });

        activeCallRef.current = call;
        setCalling(true);
        call.on("disconnect", () => {
          const handler = onDisconnectRef.current;
          onDisconnectRef.current = null;
          void endCall(handler ?? undefined);
        });
      } catch (e) {
        onDisconnectRef.current = null;
        setError(e instanceof Error ? e.message : "Call failed");
        setCalling(false);
        await disableWakeLock();
        setSessionId(null);
        sessionIdRef.current = null;
      }
    },
    [calling, endCall, testMode],
  );

  return {
    testMode,
    deviceReady,
    calling,
    sessionId,
    getSessionId,
    error,
    setError,
    startCall,
    endCall,
  };
}
