"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SttProvider } from "@/lib/coach/types";
import { hasObjectionCue } from "@/lib/coach/objection-cues";

type CoachStack = {
  stt: SttProvider;
  companyName: string;
  labels: { stt: string; liveLlm: string; batchLlm: string };
};

const SPEECH_PAUSE_MS = 400;
const SPEECH_PAUSE_OBJECTION_MS = 280;
const COACH_MIN_GAP_MS = 700;
const COACH_MIN_GAP_OBJECTION_MS = 350;
const DEEPGRAM_CHUNK_MS = 2000;

export type LabeledLine = {
  speaker: "prospect" | "rep" | "mixed";
  text: string;
  interim?: boolean;
};

export function useCoachListening(
  sessionId: string | null,
  leadId: string | null,
  active: boolean,
) {
  const [stack, setStack] = useState<CoachStack | null>(null);
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isInterim, setIsInterim] = useState(false);
  const [sayNow, setSayNow] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [labeledLines, setLabeledLines] = useState<LabeledLine[]>([]);

  const lastCoachAt = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const warmedRef = useRef(false);

  useEffect(() => {
    void fetch("/api/coach/config")
      .then((r) => r.json())
      .then((json) => {
        setStack({
          stt: json.stt,
          companyName:
            typeof json.companyName === "string"
              ? json.companyName
              : "Apex Build Partners",
          labels: json.labels,
        });
      })
      .catch(() => {
        setStack({
          stt: "webspeech",
          companyName: "Apex Build Partners",
          labels: {
            stt: "Safari speech (free)",
            liveLlm: "Live coach",
            batchLlm: "Gemini batch",
          },
        });
      });
  }, []);

  useEffect(() => {
    if (!active || !sessionId) {
      setListening(false);
      setLiveTranscript("");
      setSayNow("");
      setLabeledLines([]);
      warmedRef.current = false;
      return;
    }
    setListening(true);
  }, [active, sessionId]);

  const streamToCoach = useCallback(
    async (
      transcript: string,
      objection: boolean,
      opts?: { bootstrap?: boolean },
    ) => {
      if (!sessionId) return;
      if (!opts?.bootstrap && !transcript.trim()) return;

      const bootstrap = opts?.bootstrap;
      const minGap = objection ? COACH_MIN_GAP_OBJECTION_MS : COACH_MIN_GAP_MS;
      const now = Date.now();
      if (!bootstrap && now - lastCoachAt.current < minGap) return;
      lastCoachAt.current = now;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setStreaming(true);
      if (!bootstrap) setSayNow("");

      try {
        const res = await fetch("/api/coach/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            leadId,
            transcript: transcript.slice(-800),
            bootstrap: opts?.bootstrap,
          }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const event = JSON.parse(payload) as {
                type: string;
                text?: string;
                content?: string;
              };
              if (event.type === "token" && event.text) {
                setSayNow((prev) => prev + event.text);
              }
              if (event.type === "done" && event.content) {
                const match = event.content.match(/^\[[^\]]+\]\s*([\s\S]*)$/);
                setSayNow(match?.[1]?.trim() ?? event.content);
              }
            } catch {
              /* ignore parse errors */
            }
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      } finally {
        setStreaming(false);
      }
    },
    [sessionId, leadId],
  );

  const scheduleCoach = useCallback(
    (snippet: string) => {
      const objection = hasObjectionCue(snippet);
      const pauseMs = objection ? SPEECH_PAUSE_OBJECTION_MS : SPEECH_PAUSE_MS;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void streamToCoach(snippet, objection);
      }, pauseMs);
    },
    [streamToCoach],
  );

  useEffect(() => {
    if (!active || !sessionId || warmedRef.current) return;
    warmedRef.current = true;
    void fetch("/api/coach/warmup", { method: "POST" });
    void streamToCoach("", false, { bootstrap: true });
  }, [active, sessionId, streamToCoach]);

  const sendAudioChunk = useCallback(
    async (blob: Blob) => {
      if (!sessionId || blob.size < 1000) return;
      const now = Date.now();
      if (now - lastCoachAt.current < COACH_MIN_GAP_MS) return;
      lastCoachAt.current = now;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const form = new FormData();
      form.append("sessionId", sessionId);
      if (leadId) form.append("leadId", leadId);
      form.append("audio", blob, "chunk.webm");

      setStreaming(true);
      try {
        const res = await fetch("/api/coach/stream", {
          method: "POST",
          body: form,
          signal: ac.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const event = JSON.parse(payload) as {
                type: string;
                text?: string;
                content?: string;
              };
              if (event.type === "token" && event.text) {
                acc += event.text;
                setSayNow(acc);
              }
              if (event.type === "done" && event.content) {
                const match = event.content.match(/^\[[^\]]+\]\s*([\s\S]*)$/);
                setSayNow(match?.[1]?.trim() ?? event.content);
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* ignore */
      } finally {
        setStreaming(false);
      }
    },
    [sessionId, leadId],
  );

  useEffect(() => {
    if (!active || !sessionId || stack?.stt !== "deepgram") return;

    let recorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
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
        recorder.start(DEEPGRAM_CHUNK_MS);
      } catch {
        /* mic denied */
      }
    }

    void start();
    return () => {
      if (recorder?.state !== "inactive") recorder?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, sessionId, stack?.stt, sendAudioChunk]);

  useEffect(() => {
    if (!active || !sessionId) return;

    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/calls/media-lines?sessionId=${encodeURIComponent(sessionId)}`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as { lines?: LabeledLine[] };
        if (json.lines?.length) {
          setLabeledLines(json.lines);
          const prospectText = json.lines
            .filter((l) => l.speaker === "prospect")
            .map((l) => l.text)
            .join(" ");
          if (prospectText.trim()) {
            setLiveTranscript(prospectText);
            setIsInterim(false);
            scheduleCoach(prospectText);
          }
        }
      } catch {
        /* media stream optional */
      }
    }, 1500);

    return () => clearInterval(poll);
  }, [active, sessionId, scheduleCoach]);

  useEffect(() => {
    if (!active || !sessionId || stack?.stt !== "webspeech") return;
    if (labeledLines.length > 0) return;

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

      setLiveTranscript(snippet);
      setIsInterim(Boolean(interim.trim()));
      setLabeledLines([
        { speaker: "mixed", text: snippet, interim: Boolean(interim.trim()) },
      ]);
      scheduleCoach(snippet);
    };

    recognition.onerror = () => {};
    recognition.start();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      recognition.stop();
    };
  }, [active, sessionId, stack?.stt, scheduleCoach, labeledLines.length]);

  return {
    stack,
    companyName: stack?.companyName ?? "Apex Build Partners",
    listening: active && listening,
    sayNow,
    streaming,
  };
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
