"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { v4 as uuidv4 } from "uuid";
import { enableWakeLock, disableWakeLock } from "@/lib/wake-lock";
import {
  applySpeakerRoute,
  createTwilioDevice,
  detectSpeakerSupport,
  isTokenError,
  releaseTwilioAudio,
  speakerHint,
} from "@/lib/twilio-device";

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

const TOKEN_REFRESH_MS = 4 * 60 * 1000;

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
  const [iosAudioRoute, setIosAudioRoute] = useState(false);
  const [muted, setMuted] = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const onDisconnectRef = useRef<
    ((endedSessionId: string | null) => void | Promise<void>) | null
  >(null);
  const sessionIdRef = useRef<string | null>(null);
  const speakerOnRef = useRef(true);
  const iosRouteRef = useRef(false);
  const initLockRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    speakerOnRef.current = speakerOn;
  }, [speakerOn]);

  useEffect(() => {
    iosRouteRef.current = iosAudioRoute;
  }, [iosAudioRoute]);

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

  const fetchAccessToken = useCallback(async () => {
    const res = await fetch("/api/twilio/token", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Token failed");
    }
    return json.token as string;
  }, []);

  const refreshDeviceToken = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) return;
    try {
      const token = await fetchAccessToken();
      device.updateToken(token);
    } catch {
      /* next connect will reinit */
    }
  }, [fetchAccessToken]);

  const bindDeviceEvents = useCallback(
    (device: Device) => {
      device.on("registered", () => {
        setDeviceReady(true);
        setError((prev) =>
          prev && isTokenError(prev) ? null : prev,
        );
      });
      device.on("unregistered", () => {
        setDeviceReady(false);
      });
      device.on("error", (e) => {
        const msg = e.message || "Twilio device error";
        if (isTokenError(msg)) {
          setDeviceReady(false);
          void reinitializeDevice();
          return;
        }
        setError(msg);
      });
      device.on("tokenWillExpire", () => {
        void refreshDeviceToken();
      });
    },
    [refreshDeviceToken],
  );

  const reinitializeDevice = useCallback(async (): Promise<Device | null> => {
    if (initLockRef.current) {
      await new Promise((r) => setTimeout(r, 400));
      return deviceRef.current;
    }
    initLockRef.current = true;
    try {
      try {
        deviceRef.current?.destroy();
      } catch {
        /* ignore */
      }
      deviceRef.current = null;
      setDeviceReady(false);

      const token = await fetchAccessToken();
      const device = createTwilioDevice(token);
      bindDeviceEvents(device);
      await device.register();
      deviceRef.current = device;

      const spk = detectSpeakerSupport(device);
      setSpeakerSupported(spk.supported);
      setIosAudioRoute(spk.iosAudioRoute);
      if (spk.supported) {
        const ok = await applySpeakerRoute(device, true);
        setSpeakerOn(ok || spk.iosAudioRoute);
      }
      return device;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Phone reconnect failed");
      return null;
    } finally {
      initLockRef.current = false;
    }
  }, [bindDeviceEvents, fetchAccessToken]);

  const ensureDeviceReady = useCallback(async (): Promise<Device> => {
    let device = deviceRef.current;
    if (!device) {
      const created = await reinitializeDevice();
      if (!created) {
        throw new Error("Phone not ready — check connection and try again");
      }
      return created;
    }

    try {
      const token = await fetchAccessToken();
      device.updateToken(token);
    } catch {
      const recreated = await reinitializeDevice();
      if (!recreated) {
        throw new Error("Could not refresh phone connection");
      }
      return recreated;
    }

    if (device.state !== Device.State.Registered) {
      try {
        await device.register();
      } catch {
        const recreated = await reinitializeDevice();
        if (!recreated) {
          throw new Error("Phone not registered — retrying connection");
        }
        return recreated;
      }
    }
    return device;
  }, [fetchAccessToken, reinitializeDevice]);

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

      await releaseTwilioAudio(deviceRef.current);

      setCalling(false);
      setCallPhase("idle");
      setCallStatusLabel("");
      setMuted(false);
      await disableWakeLock();
      setSessionId(null);
      sessionIdRef.current = null;
      if (after) await after(endedSessionId);
    },
    [],
  );

  const attachCallHandlers = useCallback(
    (call: Call, device: Device) => {
      call.on("accept", () => {
        setCallPhase("connected");
        void applySpeakerRoute(device, speakerOnRef.current).then((ok) => {
          setCallStatusLabel(
            speakerHint(iosRouteRef.current, speakerOnRef.current),
          );
          if (!ok && iosRouteRef.current) {
            setCallStatusLabel(speakerHint(true, true));
          }
        });
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
          msg.toLowerCase().includes("verified")
            ? `${msg} — Twilio trial can only call numbers you verified in the Twilio console.`
            : msg,
        );
        void endCallInternal();
      });
    },
    [endCallInternal],
  );

  const connectCall = useCallback(
    async (device: Device, phoneE164: string, sid: string) => {
      try {
        return await device.connect({
          params: { To: phoneE164, sessionId: sid },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Connect failed";
        if (!isTokenError(msg)) throw err;
        const fresh = await reinitializeDevice();
        if (!fresh) throw err;
        return fresh.connect({
          params: { To: phoneE164, sessionId: sid },
        });
      }
    },
    [reinitializeDevice],
  );

  useEffect(() => {
    if (config === null || testMode) return;

    void reinitializeDevice();

    const tokenInterval = window.setInterval(() => {
      void refreshDeviceToken();
    }, TOKEN_REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshDeviceToken();
      if (!deviceRef.current) {
        void reinitializeDevice();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(tokenInterval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      try {
        deviceRef.current?.destroy();
      } catch {
        /* ignore */
      }
      deviceRef.current = null;
    };
  }, [config, testMode, reinitializeDevice, refreshDeviceToken]);

  const toggleMute = useCallback(() => {
    const call = activeCallRef.current;
    const next = !muted;
    if (call && call.status() !== Call.State.Closed) {
      call.mute(next);
    }
    setMuted(next);
    setCallStatusLabel(next ? "Muted — they cannot hear you" : "On call");
  }, [muted]);

  const toggleSpeaker = useCallback(async () => {
    const device = deviceRef.current;
    const next = !speakerOn;
    if (device) {
      const ok = await applySpeakerRoute(device, next);
      setSpeakerOn(next);
      setCallStatusLabel(speakerHint(iosAudioRoute, next));
      if (!ok && iosAudioRoute) {
        setCallStatusLabel(speakerHint(true, next));
      }
      return;
    }
    setSpeakerOn(next);
    setCallStatusLabel(speakerHint(iosAudioRoute, next));
  }, [speakerOn, iosAudioRoute]);

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

        setCalling(true);
        setCallPhase("connecting");
        setCallStatusLabel("Connecting…");
        setMuted(false);

        const device = await Promise.all([
          ensureDeviceReady(),
          opts?.beforeConnect?.(sid) ?? Promise.resolve(),
        ]).then(([d]) => d);

        const call = await connectCall(device, phoneE164, sid);

        activeCallRef.current = call;
        attachCallHandlers(call, device);

        if (call.status() === Call.State.Open) {
          setCallPhase("connected");
          setCallStatusLabel(speakerHint(iosAudioRoute, speakerOn));
        } else {
          setCallStatusLabel("Dialing…");
        }
      } catch (e) {
        onDisconnectRef.current = null;
        const message = e instanceof Error ? e.message : "Call failed";
        setError(
          isTokenError(message)
            ? "Phone connection expired — reconnecting. Tap Call again."
            : message,
        );
        if (isTokenError(message)) {
          void reinitializeDevice();
        }
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
      ensureDeviceReady,
      connectCall,
      iosAudioRoute,
      speakerOn,
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
    muted,
    toggleMute,
    reinitializePhone: reinitializeDevice,
  };
}
