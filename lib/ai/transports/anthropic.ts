import { JSON_MODE_INSTRUCTION, preview } from "@/lib/ai/json";
import { postJson } from "@/lib/ai/transports/http";
import {
  AiError,
  type AiTransport,
  type GenerateTextInput,
  type GenerateTextResult,
  type TransportContext,
} from "@/lib/ai/types";

/**
 * Anthropic Messages API transporti (`POST /v1/messages`).
 *
 * Zamonaviy Claude modellariga xos ikki nuqta — ikkalasi ham 400 xatoga
 * olib keladigan tuzoq:
 *
 *  1. `temperature` (va top_p/top_k) OLIB TASHLANGAN — claude-opus-5,
 *     sonnet-5 va 4.7+ oilasida yuborilsa so'rov rad etiladi. Shuning uchun
 *     bu transport `temperature` ni HECH QACHON yubormaydi.
 *  2. Assistant "prefill" (javobni `{` bilan boshlab berish) ham olib
 *     tashlangan. Shuning uchun JSON rejimi faqat system prompt orqali
 *     amalga oshadi.
 *
 * `max_tokens` — majburiy maydon.
 */

const ANTHROPIC_VERSION = "2023-06-01";

interface MessagesResponse {
  model?: string;
  content?: Array<{ type?: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  stop_reason?: string | null;
  stop_details?: { type?: string; category?: string | null } | null;
}

export const anthropicTransport: AiTransport = {
  provider: "anthropic",

  async generateText(
    input: GenerateTextInput,
    context: TransportContext,
  ): Promise<Omit<GenerateTextResult, "durationMs" | "attempts">> {
    const systemParts: string[] = [];
    if (input.systemPrompt) systemParts.push(input.systemPrompt);
    if (input.jsonMode) systemParts.push(JSON_MODE_INSTRUCTION);

    /*
      Anthropic rasmni OpenAI'dan BOSHQACHA kutadi: `image_url` emas,
      `{ type: "image", source: { type: "base64", media_type, data } }`.
      Aynan shu farq uchun transport qatlami bor — yuqoridagi kod
      (lib/vision/service.ts) ikkalasini ham bilmaydi.
    */
    const userContent =
      input.images !== undefined && input.images.length > 0
        ? [
            { type: "text", text: input.prompt },
            ...input.images.map((image) => ({
              type: "image",
              source: {
                type: "base64",
                media_type: image.mimeType,
                data: image.base64,
              },
            })),
          ]
        : input.prompt;

    const body: Record<string, unknown> = {
      model: context.model,
      max_tokens: context.maxTokens,
      messages: [{ role: "user", content: userContent }],
    };
    if (systemParts.length > 0) {
      body.system = systemParts.join("\n\n");
    }
    // DIQQAT: `temperature` ataylab yuborilmaydi — yuqoridagi izohga qara.

    const data = await postJson<MessagesResponse>({
      url: `${context.baseUrl}/v1/messages`,
      headers: {
        "x-api-key": context.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body,
      signal: context.signal,
      provider: "anthropic",
    });

    // Xavfsizlik klassifikatori so'rovni rad etsa, HTTP 200 keladi —
    // shuning uchun `stop_reason` ni matndan OLDIN tekshiramiz.
    if (data.stop_reason === "refusal") {
      throw new AiError({
        kind: "bad_request",
        provider: "anthropic",
        detail:
          `anthropic so'rovni rad etdi ` +
          `(kategoriya: ${data.stop_details?.category ?? "ko'rsatilmagan"})`,
      });
    }

    // Javob bir nechta blokdan iborat bo'lishi mumkin (masalan thinking +
    // text) — faqat matnli bloklarni birlashtiramiz.
    const text = (data.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("")
      .trim();

    if (text === "") {
      throw new AiError({
        kind: "bad_response",
        provider: "anthropic",
        detail:
          `anthropic bo'sh matn qaytardi ` +
          `(stop_reason: ${data.stop_reason ?? "yo'q"}). ` +
          `Javob: ${preview(JSON.stringify(data))}`,
      });
    }

    return {
      text,
      provider: "anthropic",
      model: data.model ?? context.model,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      finishReason: data.stop_reason ?? null,
    };
  },
};
