"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SttProvider } from "@/lib/coach/types";

type CoachStack = {
  stt: SttProvider;
  labels: { stt: string; llm: string };
};

const COACH_DEBOUNCE_MS = 4000;
const CHUNK_MS = 3500;

export function useCoachListening(
  sessionId: string | null,
  leadId: string | null,
  active: boolean,
) {
  const [stack, setStack] = useState<CoachStack | null>(null);
  const lastCoachAt = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetch("/api/coach/config")
      .then((r) => r.json())
      .then((json) => {
        setStack({
          stt: json.stt,
          labels: json.labels,
        });
      })
      .catch(() => {
        setStack({
          stt: "webspeech",
          labels: { stt: "Safari speech (free)", llm: "Gemini" },
        });
      });
  }, []);

  const sendToCoach = useCallback(
    async (transcript: string) => {
      if (!sessionId || !transcript.trim()) return;
      const now = Date.now();
      if (now - lastCoachAt.current < COACH_DEBOUNCE_MS) return;
      lastCoachAt.current = now;

      await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          leadId,
          transcript: transcript.slice(-800),
        }),
      });
    },
    [sessionId, leadId],
  );

  const sendAudioChunk = useCallback(
    async (blob: Blob) => {
      if (!sessionId || blob.size < 1000) return;
      const now = Date.now();
      if (now - lastCoachAt.current < COACH_DEBOUNCE_MS) return;
      lastCoachAt.current = now;

      const form = new FormData();
      form.append("sessionId", sessionId);
      if (leadId) form.append("leadId", leadId);
      form.append("audio", blob, "chunk.webm");

      await fetch("/api/coach", { method: "POST", body: form });
    },
    [sessionId, leadId],
  );

  // Deepgram path: mic chunks via MediaRecorder (works on Vercel; no WebSocket server)
  useEffect(() => {
    if (!active || !sessionId || stack?.stt !== "deepgram") return;

    let recorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) void sendAudioChunk(e.data);
        };

        recorder.start(CHUNK_MS);
      } catch {
        /* mic denied — coach stays on webspeech fallback in UI */
      }
    }

    void start();

    return () => {
      if (recorder?.state !== "inactive") recorder?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, sessionId, stack?.stt, sendAudioChunk]);

  // Web Speech path: $0, built into Safari/Chrome
  useEffect(() => {
    if (!active || !sessionId || stack?.stt !== "webspeech") return;

    const Win = window as Window & {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      SpeechRecognition?: new () => SpeechRecognitionLike;
    };

    const SR = Win.SpeechRecognition ?? Win.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let buffer = "";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) buffer += ` ${t}`;
        else interim += t;
      }
      const snippet = (buffer + interim).trim();
      if (!snippet) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void sendToCoach(snippet);
      }, 1500);
    };

    recognition.onerror = () => {};
    recognition.start();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      recognition.stop();
    };
  }, [active, sessionId, stack?.stt, sendToCoach]);

  return stack;
}

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; [j: number]: { transcript: string } };
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
