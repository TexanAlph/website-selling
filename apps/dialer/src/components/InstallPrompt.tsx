"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "dialer-install-prompt-dismissed";

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

type IosBrowser = "safari" | "chrome" | "firefox" | "other" | null;

function detectIosBrowser(): IosBrowser {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent;
  if (!/iPhone|iPad|iPod/i.test(ua)) return null;
  if (/CriOS/i.test(ua)) return "chrome";
  if (/FxiOS/i.test(ua)) return "firefox";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "safari";
  if (/Chrome/i.test(ua)) return "chrome";
  return "other";
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [browser, setBrowser] = useState<IosBrowser>(null);

  useEffect(() => {
    if (isStandalonePwa()) return;
    const b = detectIosBrowser();
    if (!b) return;
    setBrowser(b);
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    setVisible(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible || !browser) return null;

  return (
    <aside className="install-prompt glass" role="dialog" aria-label="Add to Home Screen">
      <button
        type="button"
        className="install-prompt__close"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
      <p className="install-prompt__title">Install Dialer on your iPhone</p>

      {browser === "safari" ? (
        <ol className="install-prompt__steps">
          <li>
            Tap <strong>Share</strong>{" "}
            <span className="install-prompt__icon" aria-hidden>
              ⎋
            </span>{" "}
            at the bottom
          </li>
          <li>
            Tap <strong>Add to Home Screen</strong>
          </li>
          <li>
            Tap <strong>Add</strong>, then open <strong>Dialer</strong> from your
            home screen
          </li>
        </ol>
      ) : browser === "chrome" ? (
        <ol className="install-prompt__steps">
          <li>
            Tap <strong>Share</strong> (or the menu ⋯) in Chrome
          </li>
          <li>
            Tap <strong>Add to Home Screen</strong>
          </li>
          <li>
            For best calling, use the home screen icon (not a browser tab)
          </li>
        </ol>
      ) : (
        <ol className="install-prompt__steps">
          <li>
            For the most reliable calls, open this site in <strong>Safari</strong>
          </li>
          <li>
            In Safari: Share → <strong>Add to Home Screen</strong> → Add
          </li>
        </ol>
      )}

      <button type="button" className="install-prompt__btn" onClick={dismiss}>
        Got it
      </button>
    </aside>
  );
}
