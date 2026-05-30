const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";

export async function transcribeAudio(
  audio: Blob,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY not configured");
  }

  const params = new URLSearchParams({
    model: process.env.DEEPGRAM_MODEL?.trim() || "nova-2",
    smart_format: "true",
    punctuate: "true",
    language: "en",
  });

  const buffer = Buffer.from(await audio.arrayBuffer());

  const res = await fetch(`${DEEPGRAM_URL}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": mimeType || "audio/webm",
    },
    body: buffer,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Deepgram error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };

  return (
    json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ""
  );
}
