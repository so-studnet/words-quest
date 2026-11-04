import type { ChatMessage } from "@/lib/domain/prompt";

/** Anything that can answer a chat prompt with text (Groq today, maybe Gemini later). */
export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(messages: ChatMessage[], opts?: { signal?: AbortSignal }): Promise<string>;
}

export type AiProviderErrorCode = "rate_limited" | "not_configured" | "upstream_error";

export class AiProviderError extends Error {
  constructor(
    readonly code: AiProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
