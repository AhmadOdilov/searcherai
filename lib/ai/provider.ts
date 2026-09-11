import "server-only";
import type { z } from "zod";
import { getEnv, type AiProviderName } from "@/lib/env";
import { extractJsonText, preview } from "@/lib/ai/json";
import { anthropicTransport } from "@/lib/ai/transports/anthropic";
import { openAiCompatibleTransport } from "@/lib/ai/transports/openai-compatible";
import { fromFetchError } from "@/lib/ai/transports/http";
import {
  AiError,
  type AiTransport,
  type GenerateTextInput,
  type GenerateTextResult,
} from "@/lib/ai/types";

/**
 * AI qatlamining YAGONA kirish nuqtasi.
 *
 * Keyingi modullar (dars ishlanmasi, prezentatsiya, Excel, tarjima) shu
 * fayldagi `generateText` / `generateJson` ni chaqiradi va providerdan
 * bexabar ishlaydi. Provider almashtirish = .env dagi bir qatorni o'zgartirish.
 *
 * Bu qatlamning javobgarligi:
 *   · .env dan sozlamani o'qish va transport tanlash
 *   · timeout qo'yish
 *   · vaqtinchalik xatolarda qayta urinish (eksponensial kutish bilan)
 *   · har qanday nosozlikni `AiError` ga aylantirish
 */

const TRANSPORTS: Record<AiProviderName, AiTransport> = {
  openai: openAiCompatibleTransport,
  anthropic: anthropicTransport,
};

/** AI yoqilganmi — UI'da generatsiya tugmalarini ko'rsatish uchun. */
export function aiEnabled(): boolean {
  return getEnv().aiConfigured;
}

/** Diagnostika uchun: nima sozlangan. Kalit HECH QACHON qaytarilmaydi. */
export function aiInfo(): {
  provider: AiProviderName;
  model: string;
  baseUrl: string;
  configured: boolean;
} {
  const env = getEnv();
  return {
    provider: env.AI_PROVIDER,
    model: env.aiModel,
    baseUrl: env.aiBaseUrl,
    configured: env.aiConfigured,
  };
}

/**
 * Bir nechta AbortSignal'ni birlashtiradi: timeout VA chaqiruvchining
 * bekor qilishi — ikkisidan qaysi biri birinchi ishga tushsa, so'rov to'xtaydi.
 */
function combineSignals(signals: AbortSignal[]): AbortSignal {
  // `AbortSignal.any` Node 20+ da mavjud; yo'q bo'lsa birinchisiga qaytamiz.
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }
  return signals[0];
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new AiError({ kind: "aborted", detail: "kutish vaqtida bekor qilindi" }));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Qayta urinishdan oldin qancha kutish kerak.
 *
 * Eksponensial o'sish + tasodifiy qo'shimcha ("jitter"): bir vaqtda ko'p
 * foydalanuvchi rate limit'ga urilsa, hammasi bir paytda qayta urinib
 * limitni yana buzmasligi uchun.
 */
function backoffMs(attempt: number, error: AiError): number {
  if (error.retryAfterMs !== undefined) {
    // Provider aniq aytgan bo'lsa — hurmat qilamiz (lekin 30s dan oshirmaymiz).
    return Math.min(error.retryAfterMs, 30_000);
  }
  const base = 500 * 2 ** attempt; // 500ms, 1s, 2s, ...
  const jitter = Math.random() * 250;
  return Math.min(base + jitter, 8_000);
}

/**
 * Matn generatsiyasi — asosiy funksiya.
 *
 * @throws {AiError} Har qanday nosozlikda. `error.userMessage` foydalanuvchiga
 *   ko'rsatish uchun xavfsiz, `error.message` esa log uchun.
 */
export async function generateText(
  input: GenerateTextInput,
): Promise<GenerateTextResult> {
  const env = getEnv();

  if (!env.aiConfigured) {
    throw new AiError({
      kind: "not_configured",
      detail: "AI_API_KEY sozlanmagan — .env faylini tekshiring",
    });
  }

  if (input.prompt.trim() === "") {
    throw new AiError({
      kind: "bad_request",
      detail: "bo'sh prompt bilan chaqirilgan",
    });
  }

  const transport = TRANSPORTS[env.AI_PROVIDER];
  const model = input.model || env.aiModel;
  const maxTokens = input.maxTokens ?? env.AI_MAX_TOKENS;

  const startedAt = Date.now();
  let lastError: AiError | null = null;

  // 0-urinish + AI_MAX_RETRIES qayta urinish
  for (let attempt = 0; attempt <= env.AI_MAX_RETRIES; attempt++) {
    // Timeout HAR URINISHGA alohida qo'yiladi — birinchi urinish osilib
    // qolsa, ikkinchisiga vaqt qolishi uchun.
    const timeoutSignal = AbortSignal.timeout(env.AI_TIMEOUT_MS);
    const signal = input.signal
      ? combineSignals([timeoutSignal, input.signal])
      : timeoutSignal;

    try {
      const result = await transport.generateText(input, {
        apiKey: env.AI_API_KEY,
        baseUrl: env.aiBaseUrl,
        model,
        maxTokens,
        signal,
      });

      return {
        ...result,
        durationMs: Date.now() - startedAt,
        attempts: attempt,
      };
    } catch (caught) {
      const error =
        caught instanceof AiError ? caught : fromFetchError(caught, env.AI_PROVIDER);

      // Chaqiruvchi bekor qilgan bo'lsa — qayta urinmaymiz.
      if (input.signal?.aborted) {
        throw new AiError({
          kind: "aborted",
          provider: env.AI_PROVIDER,
          detail: "so'rov chaqiruvchi tomonidan bekor qilindi",
          cause: caught,
        });
      }

      lastError = error;

      const hasAttemptsLeft = attempt < env.AI_MAX_RETRIES;
      if (!error.retryable || !hasAttemptsLeft) throw error;

      await sleep(backoffMs(attempt, error), input.signal);
    }
  }

  // Mantiqan bu yerga yetib kelmaydi, lekin TypeScript uchun kerak.
  throw lastError ?? new AiError({ kind: "unknown", detail: "qayta urinishlar tugadi" });
}

/**
 * JSON generatsiyasi — natijani zod sxemasi bilan tekshiradi.
 *
 * Keyingi modullar (dars ishlanmasi, slaydlar, kalendar reja) aynan shuni
 * chaqiradi: model qaytargan JSON kutilgan shaklda ekanini kafolatlaydi.
 *
 * Sxemadan o'tmasa bir marta qayta urinadi — modellar ba'zan bir maydonni
 * tushirib qoldiradi, ikkinchi urinishda to'g'ri qaytaradi.
 */
export async function generateJson<TSchema extends z.ZodType>(
  input: Omit<GenerateTextInput, "jsonMode"> & { schema: TSchema },
): Promise<{ data: z.infer<TSchema>; meta: GenerateTextResult }> {
  const { schema, ...rest } = input;
  let lastIssue = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const meta = await generateText({
      ...rest,
      jsonMode: true,
      // Ikkinchi urinishda modelga nima xato bo'lganini aytamiz.
      prompt:
        attempt === 0
          ? rest.prompt
          : `${rest.prompt}\n\nOLDINGI JAVOB XATO EDI. Sabab: ${lastIssue}\nIltimos, to'g'ri JSON qaytar.`,
    });

    // DIQQAT: `extractJsonText` ham shu try ichida — model JSON o'rniga
    // oddiy matn qaytarsa, aynan shu holat qayta urinishga arziydi.
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(extractJsonText(meta.text));
    } catch (cause) {
      lastIssue =
        cause instanceof AiError
          ? "javobda JSON topilmadi (matn qaytarilgan)"
          : "JSON sintaksisi buzuq";
      if (attempt === 1) {
        throw new AiError({
          kind: "bad_response",
          detail: `JSON tahlil qilinmadi (${lastIssue}): ${preview(meta.text)}`,
          cause,
        });
      }
      continue;
    }

    const validated = schema.safeParse(parsedJson);
    if (validated.success) {
      return { data: validated.data as z.infer<TSchema>, meta };
    }

    lastIssue = validated.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(ildiz)"}: ${issue.message}`)
      .join("; ");

    if (attempt === 1) {
      throw new AiError({
        kind: "bad_response",
        detail: `AI javobi kutilgan shaklda emas — ${lastIssue}`,
      });
    }
  }

  // Yetib kelmaydi.
  throw new AiError({ kind: "bad_response", detail: lastIssue });
}
