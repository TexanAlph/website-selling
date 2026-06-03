export type SttProvider = "webspeech" | "deepgram";
export type LlmProvider = "gemini" | "openrouter";

export type LabeledLine = {
  speaker: "prospect" | "rep" | "mixed";
  text: string;
  interim?: boolean;
};
