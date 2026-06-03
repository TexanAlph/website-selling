"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SttProvider, LabeledLine } from "@/lib/coach/types";
import { hasObjectionCue } from "@/lib/coach/objection-cues";
import {
  buildCoachTranscriptFromLines,
  coachTranscriptFingerprint,
} from "@/lib/coach/transcript-turn";
import {
  releaseSpeechRecognition,
  stopMediaStream,
} from "@/lib/coach/release-speech";

type CoachStack = {
  stt: SttProvider;
  mediaStreamsEnabled: boolean;
  companyName: string;
  labels: { stt: string; liveLlm: string; batchLlm: string };
};

const SPEECH_PAUSE_MS = 550;
const SPEECH_PAUSE_OBJECTION_MS = 320;
const COACH_MIN_GAP_MS = 500;
const COACH_MIN_GAP_OBJECTION_MS = 320;
const COACH_MIN_GAP_BOOTSTRAP_FOLLOW_MS = 250;
const DEEPGRAM_CHUNK_MS = 2000;
const MEDIA_POLL_MS = 1200;

export function useCoachListening(
  sessionId: string | null,
  leadId: string | null,
  active: boolean,
) {
  const [stack, setStack] = useState<CoachStack | null>(null);
  const [listening, setListening] = useState(false);
  const [sayNow, setSayNow] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [labeledLines, setLabeledLines] = useState<LabeledLine[]>([]);

  const lastCoachAt = useRef(0);
  const bootstrapDoneAt = useRef(0);
  const lastFingerprint = useRef("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const warmedRef = useRef(false);
  const lastMediaSig = useRef("");
  /** True only while a call session should keep mic / speech capture alive. */
  const captureActiveRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const stopCoachCapture = useCallback(() => {
    captureActiveRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    releaseSpeechRecognition(recognitionRef.current);
    recognitionRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    stopMediaStream(mediaStreamRef.current);
    mediaStreamRef.current = null;
  }, []);

  useEffect(() => {
    void fetch("/api/coach/config")
      .then((r) => r.json())
      .then((json) => {
        setStack({
          stt: json.stt,
          mediaStreamsEnabled: Boolean(json.mediaStreamsEnabled),
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
          mediaStreamsEnabled: false,
          companyName: "Apex Build Partners",
          labels: {
            stt: "Safari speech (free)",
            liveLlm: "Live coach",
            batchLlm: "OpenRouter batch",
          },
        });
      });
  }, []);

  useEffect(() => {
    if (!active || !sessionId) {
      stopCoachCapture();
      setListening(false);
      setSayNow("");
      setStreaming(false);
      setCoachError(null);
      setLabeledLines([]);
      warmedRef.current = false;
      lastFingerprint.current = "";
      lastMediaSig.current = "";
      bootstrapDoneAt.current = 0;
      return;
    }
    captureActiveRef.current = true;
    setListening(true);
  }, [active, sessionId, stopCoachCapture]);

  const streamToCoach = useCallback(
    async (
      transcript: string,
      objection: boolean,
      opts?: { bootstrap?: boolean; prospectOnly?: string },
    ) => {
      if (!sessionId) return;
      if (!opts?.bootstrap && !transcript.trim()) return;

      const bootstrap = opts?.bootstrap;
      const fp = bootstrap
        ? "bootstrap"
        : coachTranscriptFingerprint(transcript, opts?.prospectOnly);
      if (!bootstrap && fp === lastFingerprint.current) return;

      const minGap = objection ? COACH_MIN_GAP_OBJECTION_MS : COACH_MIN_GAP_MS;
      const now = Date.now();
      const sinceBootstrap = now - bootstrapDoneAt.current;
      if (
        !bootstrap &&
        sinceBootstrap > 0 &&
        sinceBootstrap < COACH_MIN_GAP_BOOTSTRAP_FOLLOW_MS
      ) {
        /* allow quick follow-up right after opening when prospect answers */
      } else if (!bootstrap && now - lastCoachAt.current < minGap) {
        return;
      }

      if (!bootstrap) lastFingerprint.current = fp;
      lastCoachAt.current = now;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setStreaming(true);
      setCoachError(null);
      if (!bootstrap) setSayNow("");

      try {
        const res = await fetch("/api/coach/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            leadId,
            transcript: transcript.slice(-900),
            prospectOnly: opts?.prospectOnly?.slice(-500),
            bootstrap: opts?.bootstrap,
          }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          const errJson = await res.json().catch(() => ({}));
          setCoachError(
            (errJson as { error?: string }).error ?? "Coach unavailable",
          );
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
                message?: string;
              };
              if (event.type === "error" && event.message) {
                setCoachError(event.message);
              }
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
        setCoachError("Coach connection failed");
      } finally {
        setStreaming(false);
      }
    },
    [sessionId, leadId],
  );

  const scheduleCoach = useCallback(
    (
      transcript: string,
      prospectOnly: string | undefined,
      objection: boolean,
    ) => {
      const pauseMs = objection ? SPEECH_PAUSE_OBJECTION_MS : SPEECH_PAUSE_MS;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void streamToCoach(transcript, objection, { prospectOnly });
      }, pauseMs);
    },
    [streamToCoach],
  );

  useEffect(() => {
    if (!active || !sessionId || warmedRef.current) return;
    warmedRef.current = true;
    void fetch("/api/coach/warmup", { method: "POST" });
    void streamToCoach("", false, { bootstrap: true }).then(() => {
      bootstrapDoneAt.current = Date.now();
    });
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
      setCoachError(null);
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
                const text = match?.[1]?.trim() ?? event.content;
                setSayNow(text);
                lastFingerprint.current = coachTranscriptFingerprint(text);
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
      if (!captureActiveRef.current) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (!captureActiveRef.current) {
          stopMediaStream(stream);
          return;
        }
        mediaStreamRef.current = stream;
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) void sendAudioChunk(e.data);
        };
        recorder.start(DEEPGRAM_CHUNK_MS);
      } catch {
        setCoachError("Mic blocked — use Media Streams or Safari speech");
      }
    }

    void start();
    return () => {
      stopCoachCapture();
    };
  }, [active, sessionId, stack?.stt, sendAudioChunk, stopCoachCapture]);

  useEffect(() => {
    if (!active || !sessionId || !stack?.mediaStreamsEnabled) return;

    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/calls/media-lines?sessionId=${encodeURIComponent(sessionId)}`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as { lines?: LabeledLine[] };
        const lines = json.lines ?? [];
        if (!lines.length) return;

        const sig = lines
          .map((l) => `${l.speaker}:${l.text}`)
          .join("|");
        if (sig === lastMediaSig.current) return;
        lastMediaSig.current = sig;

        setLabeledLines(lines);
        const { transcript, prospectOnly } = buildCoachTranscriptFromLines(lines);
        const trigger = prospectOnly.trim() || transcript.trim();
        if (!trigger) return;

        scheduleCoach(
          transcript || trigger,
          prospectOnly.trim() || undefined,
          hasObjectionCue(prospectOnly || trigger),
        );
      } catch {
        /* media stream optional */
      }
    }, MEDIA_POLL_MS);

    return () => clearInterval(poll);
  }, [active, sessionId, stack?.mediaStreamsEnabled, scheduleCoach]);

  useEffect(() => {
    if (!active || !sessionId || stack?.stt !== "webspeech") return;
    if (stack.mediaStreamsEnabled && labeledLines.length > 0) return;

    const Win = window as Window & {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      SpeechRecognition?: new () => SpeechRecognitionLike;
    };

    const SR = Win.SpeechRecognition ?? Win.webkitSpeechRecognition;
    if (!SR) {
      setCoachError(
        stack.mediaStreamsEnabled
          ? "Waiting for call audio…"
          : "Speech recognition not supported in this browser",
      );
      return;
    }

    captureActiveRef.current = true;
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalBuffer = "";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      if (!captureActiveRef.current) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalBuffer += ` ${t}`;
        else interim += t;
      }
      const snippet = (finalBuffer + interim).trim();
      if (!snippet) return;

      setLabeledLines([
        { speaker: "mixed", text: snippet, interim: Boolean(interim.trim()) },
      ]);

      const objection = hasObjectionCue(snippet);
      scheduleCoach(snippet, undefined, objection);
    };

    recognition.onerror = () => {
      if (!captureActiveRef.current) return;
      if (!stack.mediaStreamsEnabled) {
        setCoachError("Could not hear call — check mic permission");
      }
    };

    recognition.onend = () => {
      if (!captureActiveRef.current) return;
      try {
        recognition.start();
      } catch {
        /* iOS may stop recognition mid-call — restart only while captureActive */
      }
    };

    try {
      recognition.start();
    } catch {
      setCoachError("Could not start speech recognition");
    }

    return () => {
      stopCoachCapture();
    };
  }, [
    active,
    sessionId,
    stack?.stt,
    stack?.mediaStreamsEnabled,
    scheduleCoach,
    labeledLines.length,
    stopCoachCapture,
  ]);

  return {
    stack,
    companyName: stack?.companyName ?? "Apex Build Partners",
    listening: active && listening,
    sayNow,
    streaming,
    coachError,
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
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};
