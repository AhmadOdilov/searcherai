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
 * Foydalanuvchiga ko'rsatiladigan xabarlar — o'zbek tilida, texnik
 * tafsilotlarsiz. API kaliti yoki ichki manzillar hech qachon bu
 * xabarlarga tushmaydi.
 */
const USER_MESSAGES: Record<AiErrorKind, string> = {
  not_configured: "AI xizmati hozircha sozlanmagan. Administrator bilan bog'laning.",
  auth: "AI xizmatiga ulanishda muammo bor. Administrator bilan bog'laning.",
  rate_limit:
    "Hozir so'rovlar juda ko'p. Iltimos, bir daqiqadan so'ng qayta urinib ko'ring.",
  quota: "AI xizmatining limiti tugagan. Administrator bilan bog'laning.",
  timeout:
    "AI javobi juda uzoq kutildi. Iltimos, qayta urinib ko'ring yoki mavzuni qisqartiring.",
  network:
    "AI xizmatiga ulanib bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.",
  bad_request:
    "So'rov AI xizmati tomonidan qabul qilinmadi. Kiritilgan ma'lumotlarni tekshirib ko'ring.",
  server:
    "AI xizmatida vaqtinchalik nosozlik. Iltimos, birozdan so'ng qayta urinib ko'ring.",
  bad_response: "AI kutilgan formatda javob bermadi. Iltimos, qayta urinib ko'ring.",
  aborted: "So'rov bekor qilindi.",
  unknown: "Kutilmagan xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
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
    // `message` — log uchun; foydalanuvchiga `userMessage` ketadi.
    super(options.detail ?? USER_MESSAGES[options.kind], {
      cause: options.cause,
    });
    this.name = "AiError";
    this.kind = options.kind;
    this.status = options.status;
    this.provider = options.provider;
    this.retryAfterMs = options.retryAfterMs;
  }

  /** Foydalanuvchiga ko'rsatish uchun xavfsiz xabar. */
  get userMessage(): string {
    return USER_MESSAGES[this.kind];
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
