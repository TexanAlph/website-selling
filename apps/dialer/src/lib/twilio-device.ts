import { Device, Call } from "@twilio/voice-sdk";
import { isIosDevice } from "@/lib/phone";

export function isTokenError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("20101") || m.includes("access token") || m.includes("invalid token");
}

export async function applySpeakerRoute(
  device: Device,
  speakerOn: boolean,
): Promise<boolean> {
  const audio = device.audio;
  if (!audio?.speakerDevices) return false;
  try {
    if (speakerOn) {
      await audio.speakerDevices.set("default");
    } else {
      const devices = Array.from(audio.speakerDevices.get());
      const earpiece = devices.find(
        (d) =>
          d.deviceId !== "default" &&
          /ear|receiver|phone/i.test(d.label ?? ""),
      );
      if (earpiece) {
        await audio.speakerDevices.set(earpiece.deviceId);
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function detectSpeakerSupport(device: Device | null): {
  supported: boolean;
  iosAudioRoute: boolean;
} {
  const ios = isIosDevice();
  const hasSdk = Boolean(device?.audio?.speakerDevices);
  return {
    supported: hasSdk || ios,
    iosAudioRoute: ios && !hasSdk,
  };
}

export function speakerHint(iosAudioRoute: boolean, on: boolean): string {
  if (!iosAudioRoute) return on ? "Speaker on" : "Earpiece";
  return on
    ? "Speaker — if quiet, tap the audio icon in the green call bar at the top of the screen"
    : "Earpiece — tap the audio icon in the call bar to switch to speaker";
}

export function createTwilioDevice(token: string): Device {
  return new Device(token, {
    codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
    closeProtection: true,
  });
}

/** Hang up and release WebRTC mic routes (helps iOS Safari after a call). */
export async function releaseTwilioAudio(device: Device | null): Promise<void> {
  if (!device) return;
  try {
    device.disconnectAll();
  } catch {
    /* ignore */
  }
  try {
    const audio = device.audio as {
      unsetInputDevice?: () => Promise<void>;
    } | null;
    await audio?.unsetInputDevice?.();
  } catch {
    /* ignore */
  }
}
