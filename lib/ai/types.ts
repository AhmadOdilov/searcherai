import type { AiProviderName } from "@/lib/env";

/**
 * AI qatlamining umumiy shartnomasi.
 *
 * Keyingi modullar (dars ishlanmasi, prezentatsiya matni, tarjima) FAQAT
 * shu tiplar bilan ishlaydi va qaysi provider ishlatilayotganini bilmaydi.
 */

export interface GenerateTextInput {
  /** Foydalanuvchi so'rovi / asosiy topshiriq. */
  prompt: string;
  /** Modelning roli va qoidalari. */
  systemPrompt?: string;
  /**
   * true bo'lsa model faqat JSON qaytarishi so'raladi va javobdan JSON
   * ajratib olinadi (```json ... ``` ramkalari tozalanadi).
   */
  jsonMode?: boolean;
  /** Javobdagi maksimal token soni. Standart: AI_MAX_TOKENS. */
  maxTokens?: number;
  /**
   * Tasodifiylik darajasi. DIQQAT: zamonaviy Claude modellari (opus-5,
   * sonnet-5 va h.k.) bu parametrni QABUL QILMAYDI — 400 xato qaytaradi.
   * Shuning uchun anthropic transportida u ataylab yuborilmaydi.
   */
  temperature?: number;
  /** .env dagi AI_MODEL ni bitta chaqiruv uchun almashtirish. */
  model?: string;
  /** Tashqaridan bekor qilish (masalan foydalanuvchi sahifani yopdi). */
  signal?: AbortSignal;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateTextResult {
  /** Modelning matnli javobi. jsonMode'da — tozalangan JSON satri. */
  text: string;
  provider: AiProviderName;
  model: string;
  usage: AiUsage;
  /** Model nega to'xtaganini bildiradi (provider terminologiyasida). */
  finishReason: string | null;
  /** Qancha davom etgani — Step 5 (performance) o'lchovlari uchun. */
  durationMs: number;
  /** Necha marta qayta urinilgani (0 = birinchi urinishda muvaffaqiyat). */
  attempts: number;
}

/** Xatolik turlari — har biri foydalanuvchiga boshqacha xabar beradi. */
export type AiErrorKind =
  | "not_configured" // AI_API_KEY sozlanmagan
  | "auth" // 401/403 — kalit noto'g'ri yoki muddati o'tgan
  | "rate_limit" // 429 — limit tugagan
  | "quota" // to'lov/balans muammosi
  | "timeout" // belgilangan vaqtda javob kelmadi
  | "network" // internetga ulanish yo'q, DNS xatosi
  | "bad_request" // 400 — so'rov noto'g'ri (model nomi, parametr)
  | "server" // 5xx — provider tomonidagi nosozlik
  | "bad_response" // javob kutilgan shaklda emas / JSON buzuq
  | "aborted" // chaqiruvchi bekor qildi
  | "unknown";

/** Qayta urinish ma'noli bo'lgan xatolik turlari. */
const RETRYABLE: ReadonlySet<AiErrorKind> = new Set<AiErrorKind>([
  "rate_limit",
  "timeout",
  "network",
  "server",
]);

/**
 * Xatolik turining TARJIMA KALITI.
 *
 * ── Nega matn emas, kalit ─────────────────────────────────────────────────
 * Ilgari bu yerda tayyor o'zbekcha matnlar turardi. Interfeys ikki tilli
 * bo'lgach bu ishlamay qoldi: AI qatlami so'rov qaysi tilda ekanini
 * bilmaydi va bilishi ham shart emas — uning ishi AI bilan gaplashish.
 *
 * Endi u faqat KALIT qaytaradi, tarjima esa javob shakllanadigan joyda
 * (`withErrorHandling`) qilinadi — o'sha yerda foydalanuvchi tili ma'lum.
 *
 * Kalitlar `messages/*.json` dagi `errors.ai.*` bo'limiga mos keladi.
 */
const MESSAGE_KEYS: Record<AiErrorKind, string> = {
  not_configured: "errors.ai.not_configured",
  auth: "errors.ai.auth",
  rate_limit: "errors.ai.rate_limit",
  quota: "errors.ai.quota",
  timeout: "errors.ai.timeout",
  network: "errors.ai.network",
  bad_request: "errors.ai.bad_request",
  server: "errors.ai.server",
  bad_response: "errors.ai.bad_response",
  aborted: "errors.ai.aborted",
  unknown: "errors.ai.unknown",
};

export interface AiErrorOptions {
  kind: AiErrorKind;
  /** Log uchun texnik tafsilot — foydalanuvchiga ko'rsatilmaydi. */
  detail?: string;
  status?: number;
  provider?: AiProviderName;
  /** 429 javobidagi Retry-After — qayta urinishni shunga moslash uchun. */
  retryAfterMs?: number;
  cause?: unknown;
}

/**
 * AI qatlamidan chiqadigan YAGONA xatolik turi. Chaqiruvchi kod boshqa
 * xatolikni kutmaydi — transportlar hamma narsani shunga aylantiradi.
 */
export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status?: number;
  readonly provider?: AiProviderName;
  readonly retryAfterMs?: number;

  constructor(options: AiErrorOptions) {
    // `message` — FAQAT log uchun. Foydalanuvchiga `messageKey` tarjimasi
    // ketadi (`withErrorHandling` da).
    super(options.detail ?? options.kind, { cause: options.cause });
    this.name = "AiError";
    this.kind = options.kind;
    this.status = options.status;
    this.provider = options.provider;
    this.retryAfterMs = options.retryAfterMs;
  }

  /**
   * Foydalanuvchiga ko'rsatiladigan xabarning TARJIMA KALITI.
   *
   * Bu qiymat ikki joyda ishlatiladi:
   *  1. `withErrorHandling` — HTTP javobini shakllantirishda
   *  2. Servis qatlami — `errorMessage` ustuniga YOZILADI, shunda yozuv
   *     keyinroq foydalanuvchining JORIY tilida ko'rsatiladi
   */
  get messageKey(): string {
    return MESSAGE_KEYS[this.kind];
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }

  /** HTTP javobida qaytarish uchun mos status kodi. */
  get httpStatus(): number {
    switch (this.kind) {
      case "not_configured":
        return 503;
      case "auth":
      case "quota":
        return 502;
      case "rate_limit":
        return 429;
      case "timeout":
        return 504;
      case "bad_request":
        return 400;
      case "aborted":
        return 499;
      default:
        return 502;
    }
  }
}

/** Transport — bitta provider bilan qanday gaplashish kerakligini biladi. */
export interface AiTransport {
  readonly provider: AiProviderName;
  generateText(
    input: GenerateTextInput,
    context: TransportContext,
  ): Promise<Omit<GenerateTextResult, "durationMs" | "attempts">>;
}

export interface TransportContext {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  /** Bitta urinish uchun allaqachon timeout qo'yilgan signal. */
  signal: AbortSignal;
}
