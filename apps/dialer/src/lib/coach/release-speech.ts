type StoppableRecognition = {
  onend: (() => void) | null;
  onresult: ((...args: never[]) => void) | null;
  onerror: (() => void) | null;
  stop: () => void;
  abort?: () => void;
};

/** Detach handlers and stop Safari / Chrome speech recognition (releases mic). */
export function releaseSpeechRecognition(
  recognition: StoppableRecognition | null,
): void {
  if (!recognition) return;
  recognition.onend = null;
  recognition.onresult = null;
  recognition.onerror = null;
  try {
    recognition.abort?.();
  } catch {
    /* ignore */
  }
  try {
    recognition.stop();
  } catch {
    /* ignore */
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}
