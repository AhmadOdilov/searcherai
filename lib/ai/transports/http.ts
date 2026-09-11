import { AiError, type AiErrorKind } from "@/lib/ai/types";
import type { AiProviderName } from "@/lib/env";
import { preview } from "@/lib/ai/json";

/**
 * Ikkala transport uchun umumiy HTTP qatlami: so'rov yuborish va
 * HAR QANDAY nosozlikni `AiError` ga aylantirish.
 */

/** HTTP status kodini xatolik turiga o'giradi. */
export function kindFromStatus(status: number, body: string): AiErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status === 400 || status === 404 || status === 422) {
    // Ba'zi providerlar balans tugaganini ham 400 bilan qaytaradi.
    if (/quota|billing|credit|insufficient|balance/i.test(body)) return "quota";
    return "bad_request";
  }
  if (status === 402) return "quota";
  if (status >= 500) return "server";
  return "unknown";
}

/** `Retry-After` sarlavhasini millisekundga o'giradi (bo'lsa). */
function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get("retry-after");
  if (!raw) return undefined;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  // HTTP-date ko'rinishi
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    return delta > 0 ? delta : undefined;
  }
  return undefined;
}

/**
 * Provider javobidagi xato matnini topadi. Har bir provider boshqa joyda
 * saqlaydi, shuning uchun eng ehtimolli yo'llarni ketma-ket tekshiramiz.
 */
function extractProviderMessage(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const error = obj.error;
      if (typeof error === "string") return error;
      if (error && typeof error === "object") {
        const message = (error as Record<string, unknown>).message;
        if (typeof message === "string") return message;
      }
      if (typeof obj.message === "string") return obj.message;
    }
  } catch {
    // JSON emas — xom matnni ishlatamiz.
  }
  return preview(body);
}

export interface PostJsonOptions {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  signal: AbortSignal;
  provider: AiProviderName;
}

/**
 * JSON POST so'rovi. Muvaffaqiyatda tahlil qilingan javobni qaytaradi,
 * aks holda `AiError` tashlaydi.
 */
export async function postJson<T>(options: PostJsonOptions): Promise<T> {
  const { url, headers, body, signal, provider } = options;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal,
      // Next.js AI javoblarini keshlamasligi kerak.
      cache: "no-store",
    });
  } catch (cause) {
    throw fromFetchError(cause, provider);
  }

  const text = await response.text();

  if (!response.ok) {
    const kind = kindFromStatus(response.status, text);
    throw new AiError({
      kind,
      status: response.status,
      provider,
      retryAfterMs: parseRetryAfter(response.headers),
      detail: `${provider} ${response.status}: ${extractProviderMessage(text)}`,
      cause: undefined,
    });
  }

  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new AiError({
      kind: "bad_response",
      provider,
      detail: `${provider} JSON bo'lmagan javob qaytardi: ${preview(text)}`,
      cause,
    });
  }
}

/**
 * `fetch` tashlagan xatolikni turlaydi.
 *
 * Muhim nuqta: timeout `AbortSignal.timeout()` orqali amalga oshadi va u
 * ham `AbortError` beradi — foydalanuvchi bekor qilganidan farqlash uchun
 * `TimeoutError` nomini tekshiramiz.
 */
export function fromFetchError(cause: unknown, provider: AiProviderName): AiError {
  if (cause instanceof AiError) return cause;

  if (cause instanceof Error) {
    if (cause.name === "TimeoutError") {
      return new AiError({
        kind: "timeout",
        provider,
        detail: `${provider}: belgilangan vaqtda javob kelmadi`,
        cause,
      });
    }
    if (cause.name === "AbortError") {
      return new AiError({
        kind: "aborted",
        provider,
        detail: `${provider}: so'rov bekor qilindi`,
        cause,
      });
    }
    return new AiError({
      kind: "network",
      provider,
      detail: `${provider} ga ulanib bo'lmadi: ${cause.message}`,
      cause,
    });
  }

  return new AiError({
    kind: "unknown",
    provider,
    detail: `${provider}: kutilmagan xatolik`,
    cause,
  });
}
