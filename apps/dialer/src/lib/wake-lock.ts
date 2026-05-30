/**
 * Safari-friendly screen wake lock (NoSleep-style fallback).
 * Keeps the display on during active calls so Twilio WebRTC stays connected.
 */

type WakeLockSentinel = {
  release: () => Promise<void>;
};

let sentinel: WakeLockSentinel | null = null;
let videoFallback: HTMLVideoElement | null = null;

async function requestNativeWakeLock(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    return false;
  }
  try {
    sentinel = (await (
      navigator as Navigator & {
        wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> };
      }
    ).wakeLock.request("screen")) as WakeLockSentinel;
    sentinel &&
      document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible" && !sentinel) {
          await enableWakeLock();
        }
      });
    return true;
  } catch {
    return false;
  }
}

function startVideoFallback(): void {
  if (videoFallback) return;
  const video = document.createElement("video");
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  video.muted = true;
  video.loop = true;
  video.style.cssText =
    "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;";
  video.src =
    "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAD21hdmYAAAABAAEAAAAAAAB0";
  document.body.appendChild(video);
  void video.play().catch(() => {});
  videoFallback = video;
}

function stopVideoFallback(): void {
  if (videoFallback) {
    videoFallback.pause();
    videoFallback.remove();
    videoFallback = null;
  }
}

export async function enableWakeLock(): Promise<void> {
  const ok = await requestNativeWakeLock();
  if (!ok) startVideoFallback();
}

export async function disableWakeLock(): Promise<void> {
  if (sentinel) {
    try {
      await sentinel.release();
    } catch {
      /* ignore */
    }
    sentinel = null;
  }
  stopVideoFallback();
}
