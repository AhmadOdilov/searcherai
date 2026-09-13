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
 * OpenAI-mos `/chat/completions` transporti.
 *
 * Bitta kod bilan bir nechta xizmat ishlaydi — faqat AI_BASE_URL o'zgaradi:
 * OpenAI, OpenRouter, Gemini compat-endpoint, Groq, Together, Ollama.
 */

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

/**
 * Yangi OpenAI modellari `max_tokens` ni rad etib, `max_completion_tokens`
 * talab qiladi. Qaysi endpoint qaysi nomni kutayotganini oldindan bilmaymiz,
 * shuning uchun avval `max_tokens` bilan urinamiz va aynan shu sabab bilan
 * 400 kelsa, ikkinchi nom bilan qayta yuboramiz.
 */
function wantsMaxCompletionTokens(error: AiError): boolean {
  return (
    error.kind === "bad_request" &&
    /max_completion_tokens|max_tokens.*not supported|unsupported.*max_tokens/i.test(
      error.message,
    )
  );
}

function buildBody(
  input: GenerateTextInput,
  context: TransportContext,
  tokenField: "max_tokens" | "max_completion_tokens",
): Record<string, unknown> {
  const systemParts: string[] = [];
  if (input.systemPrompt) systemParts.push(input.systemPrompt);
  if (input.jsonMode) systemParts.push(JSON_MODE_INSTRUCTION);

  const messages: Array<{ role: string; content: unknown }> = [];
  if (systemParts.length > 0) {
    messages.push({ role: "system", content: systemParts.join("\n\n") });
  }

  /*
    ── Rasm bo'lsa `content` MASSIV bo'ladi ────────────────────────────────
    OpenAI-mos API'da matn-only so'rovda `content` oddiy satr, rasm bilan
    esa bo'laklar massivi. Ikkalasini ham bir xil (massiv) qilib yuborish
    mumkin edi, lekin ba'zi eski endpointlar faqat satrni qabul qiladi —
    shuning uchun rasm YO'Q bo'lsa eski shakl saqlanadi.

    Rasm `data:` URI ko'rinishida beriladi — Yandex AI Studio, OpenAI va
    Gemini compat-endpointi uchalasi ham shu shaklni kutadi.
  */
  if (input.images !== undefined && input.images.length > 0) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: input.prompt },
        ...input.images.map((image) => ({
          type: "image_url",
          image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
        })),
      ],
    });
  } else {
    messages.push({ role: "user", content: input.prompt });
  }

  const body: Record<string, unknown> = {
    model: context.model,
    messages,
    [tokenField]: context.maxTokens,
  };

  // Faqat ataylab berilganda yuboramiz — ba'zi modellar standart qiymatdan
  // boshqasini qabul qilmaydi.
  if (input.temperature !== undefined) {
    body.temperature = input.temperature;
  }

  // Native JSON rejimi — qo'llab-quvvatlamaydigan endpointlar buni
  // e'tiborsiz qoldiradi, promptdagi ko'rsatma esa har holda ishlaydi.
  if (input.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  return body;
}

async function callOnce(
  input: GenerateTextInput,
  context: TransportContext,
  tokenField: "max_tokens" | "max_completion_tokens",
): Promise<ChatCompletionResponse> {
  return postJson<ChatCompletionResponse>({
    url: `${context.baseUrl}/chat/completions`,
    headers: { authorization: `Bearer ${context.apiKey}` },
    body: buildBody(input, context, tokenField),
    signal: context.signal,
    provider: "openai",
  });
}

export const openAiCompatibleTransport: AiTransport = {
  provider: "openai",

  async generateText(
    input: GenerateTextInput,
    context: TransportContext,
  ): Promise<Omit<GenerateTextResult, "durationMs" | "attempts">> {
    let data: ChatCompletionResponse;
    try {
      data = await callOnce(input, context, "max_tokens");
    } catch (error) {
      if (error instanceof AiError && wantsMaxCompletionTokens(error)) {
        data = await callOnce(input, context, "max_completion_tokens");
      } else {
        throw error;
      }
    }

    const choice = data.choices?.[0];
    const content = choice?.message?.content;

    if (typeof content !== "string" || content.trim() === "") {
      throw new AiError({
        kind: "bad_response",
        provider: "openai",
        detail:
          `openai bo'sh javob qaytardi ` +
          `(finish_reason: ${choice?.finish_reason ?? "yo'q"}). ` +
          `Javob: ${preview(JSON.stringify(data))}`,
      });
    }

    return {
      text: content,
      provider: "openai",
      model: data.model ?? context.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      finishReason: choice?.finish_reason ?? null,
    };
  },
};
