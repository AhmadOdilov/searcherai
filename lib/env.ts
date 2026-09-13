import "server-only";
import { z } from "zod";

/**
 * Muhit o'zgaruvchilarini o'qish va tekshirish — YAGONA joy.
 *
 * Qoidalar:
 *  · `process.env` ga boshqa hech qaysi fayl to'g'ridan-to'g'ri murojaat
 *    qilmaydi. Shunda nima sozlanishi kerakligi bir qarashda ko'rinadi.
 *  · Tekshiruv DANGASA (lazy): modul import qilinganda emas, birinchi
 *    chaqiruvda bajariladi. Aks holda `next build` .env yo'q muhitda
 *    qulab tushardi.
 *  · Natija keshlanadi, lekin kalit o'zgarsa qayta hisoblanadi (sinovlar
 *    `process.env` ni import'dan keyin o'zgartiradi).
 *  · AI kaliti YO'Q bo'lishi xato EMAS — AI funksiyalari o'chadi, ilova
 *    ishlashda davom etadi (`lib/ai/provider.ts` dagi `aiEnabled()`).
 */

export const AI_PROVIDERS = ["openai", "anthropic"] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

/** Provider bo'yicha standart qiymatlar — .env da ko'rsatilmasa ishlatiladi. */
export const PROVIDER_DEFAULTS: Record<
  AiProviderName,
  { baseUrl: string; model: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    model: "claude-opus-5",
  },
};

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.url().default("http://localhost:3000"),

  /**
   * Sessiya JWT'larini imzolash kaliti.
   *
   * Kamida 32 belgi — HS256 uchun xavfsiz uzunlik. Yangi kalit yaratish:
   *   openssl rand -base64 48
   *
   * Kalit o'zgarsa BARCHA mavjud sessiyalar kuchdan qoladi (imzo mos kelmaydi)
   * — foydalanuvchilar qaytadan kirishi kerak bo'ladi.
   */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET kamida 32 belgidan iborat bo'lishi kerak"),

  /**
   * Bir IP'dan soatiga ruxsat etilgan ro'yxatdan o'tishlar soni.
   *
   * ── Nega sozlanadigan ─────────────────────────────────────────────────
   * To'g'ri qiymat DEPLOY sharoitiga bog'liq va u kod yozilayotganda
   * ma'lum emas:
   *
   *  · Ochiq ro'yxat (har kim kiradi) → 10 yetarli va himoya beradi.
   *  · Maktabda o'quv seminari: 30 o'qituvchi bitta wi-fi ostidan bir
   *    soatda ro'yxatdan o'tadi → 10 juda kam, o'n birinchisi bloklanadi.
   *
   * Sinovlarda yuqori qo'yiladi (ular yuzlab hisob yaratadi).
   */
  REGISTER_MAX_PER_IP: z.coerce.number().int().positive().default(10),

  AI_PROVIDER: z.enum(AI_PROVIDERS).default("openai"),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default(""),
  AI_BASE_URL: z.string().default(""),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(16_000),

  /**
   * Kalendar reja uchun ALOHIDA model (ixtiyoriy).
   *
   * Nega kerak: bu modul eng uzun ro'yxatni (20+ hafta) generatsiya
   * qiladi va modellar bu vazifada sezilarli farq qiladi — ba'zilari
   * "ANIQ 24 ta hafta yoz" ko'rsatmasiga rioya qilmay, qisqa ro'yxat
   * qaytaradi. Qolgan modullar uchun bunday muammo yo'q.
   *
   * Bo'sh qoldirilsa `AI_MODEL` ishlatiladi.
   */
  CALENDAR_PLAN_AI_MODEL: z.string().default(""),

  /**
   * AI qidiruv uchun ALOHIDA model (ixtiyoriy).
   *
   * Nega kerak: qidiruv — yagona modul bo'lib, u ERKIN MATN yozadi
   * (qolganlari qisqa, tayyor shakldagi maydonlarni to'ldiradi). Erkin
   * matnda modelning o'zbek tili sifati darhol ko'rinadi va modellar bu
   * jihatdan keskin farq qiladi: haqiqiy o'lchovda bir model "kislorod"
   * o'rniga "oksid gaz" deb yozdi, boshqasi esa tushunarli jumla tuzdi.
   *
   * Bo'sh qoldirilsa `AI_MODEL` ishlatiladi.
   */
  SEARCH_AI_MODEL: z.string().default(""),

  /**
   * Rasm tushunish (vision) uchun model.
   *
   * ── Nega ALOHIDA va nega standart qiymat YO'Q ─────────────────────────
   * Boshqa modul-modellaridan farqli o'laroq bu `AI_MODEL` ga
   * QAYTMAYDI. Sabab: oddiy matn modeli rasm kelgan so'rovni tushunmaydi
   * va 400 qaytaradi. "Standart modelga qaytamiz" degan mantiq bu yerda
   * foydalanuvchiga tushunarsiz xato ko'rsatardi.
   *
   * Bo'sh bo'lsa — vision funksiyasi butunlay o'chadi va interfeysda
   * tushunarli xabar chiqadi (ilova qulab tushmaydi).
   *
   * Yandex AI Studio namunasi:
   *   VISION_AI_MODEL="gpt://<folder-id>/qwen3.6-35b-a3b/latest"
   */
  VISION_AI_MODEL: z.string().default(""),

  // ── Fayl saqlagichi ──────────────────────────────────────────────────
  /**
   * Qaysi saqlagich ishlatilsin:
   *   "local" — disk (`storage/` papka). VPS va Docker uchun.
   *   "s3"    — S3-mos xizmat (Cloudflare R2 / AWS S3 / MinIO).
   *             Serverless (Vercel) uchun MAJBURIY, chunki u yerda fayl
   *             tizimi faqat o'qish uchun ochiq.
   */
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().default(""),
  S3_ENDPOINT: z.string().default(""),
  S3_ACCESS_KEY: z.string().default(""),
  S3_SECRET_KEY: z.string().default(""),
  S3_REGION: z.string().default("auto"),
});

/**
 * `.env` da `AI_TIMEOUT_MS=""` kabi BO'SH qiymat uchraydi. zod uchun bo'sh
 * satr 0 ga aylanadi va `.positive()` dan o'tmaydi — shuning uchun bo'sh
 * satrlarni "ko'rsatilmagan" deb hisoblaymiz va standart qiymat ishlaydi.
 */
function readRaw(): Record<string, string | undefined> {
  const keys = Object.keys(envSchema.shape);
  const raw: Record<string, string | undefined> = {};
  for (const key of keys) {
    const value = process.env[key];
    raw[key] = value === undefined || value.trim() === "" ? undefined : value;
  }
  return raw;
}

export type AppEnv = z.infer<typeof envSchema> & {
  /** AI_MODEL bo'sh bo'lsa provider standarti bilan to'ldirilgan model. */
  aiModel: string;
  /** AI_BASE_URL bo'sh bo'lsa provider standarti bilan to'ldirilgan manzil. */
  aiBaseUrl: string;
  /** Kalendar reja uchun model — belgilanmasa `aiModel`. */
  calendarPlanAiModel: string;
  /** Qidiruv uchun model — belgilanmasa `aiModel`. */
  searchAiModel: string;
  /** Rasm tahlili uchun model. Bo'sh bo'lsa vision o'chiq. */
  visionAiModel: string;
  /** Rasm tahlili yoqilganmi — kalit ham, model ham sozlanganmi. */
  visionConfigured: boolean;
  /** Kalit mavjudmi — AI funksiyalarini yoqish/o'chirish uchun. */
  aiConfigured: boolean;
};

/** Sozlama xatosi — ishlab chiquvchi uchun, foydalanuvchiga ko'rsatilmaydi. */
export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

let cached: AppEnv | null = null;
let cachedFingerprint = "";

function fingerprint(raw: Record<string, string | undefined>): string {
  return JSON.stringify(raw);
}

export function getEnv(): AppEnv {
  const raw = readRaw();
  const fp = fingerprint(raw);
  if (cached && fp === cachedFingerprint) return cached;

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new EnvError(
      `Muhit o'zgaruvchilari to'g'ri sozlanmagan.\n` +
        `.env.example ni .env ga nusxalab to'ldirganingizni tekshiring.\n\n` +
        z.prettifyError(parsed.error),
    );
  }

  const data = parsed.data;
  const defaults = PROVIDER_DEFAULTS[data.AI_PROVIDER];

  /*
    S3 tanlangan bo'lsa, majburiy sozlamalar borligini DARHOL tekshiramiz.

    Aks holda xato faqat birinchi fayl saqlanganda — ya'ni generatsiya
    tugagandan KEYIN — chiqardi va butun ish bekorga ketardi.
  */
  if (data.STORAGE_DRIVER === "s3") {
    const missing = (
      [
        ["S3_BUCKET", data.S3_BUCKET],
        ["S3_ACCESS_KEY", data.S3_ACCESS_KEY],
        ["S3_SECRET_KEY", data.S3_SECRET_KEY],
      ] as const
    )
      .filter(([, value]) => value === "")
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new EnvError(
        `STORAGE_DRIVER="s3" tanlangan, lekin quyidagilar sozlanmagan: ` +
          `${missing.join(", ")}.\n` +
          `.env.example dagi S3 bo'limiga qarang.`,
      );
    }
  }

  cached = {
    ...data,
    aiModel: data.AI_MODEL || defaults.model,
    calendarPlanAiModel: data.CALENDAR_PLAN_AI_MODEL || data.AI_MODEL || defaults.model,
    searchAiModel: data.SEARCH_AI_MODEL || data.AI_MODEL || defaults.model,
    visionAiModel: data.VISION_AI_MODEL,
    visionConfigured: data.AI_API_KEY.length > 0 && data.VISION_AI_MODEL.length > 0,
    // Oxiridagi "/" ni olib tashlaymiz — URL yig'ishda ikkilanish bo'lmasin.
    aiBaseUrl: (data.AI_BASE_URL || defaults.baseUrl).replace(/\/+$/, ""),
    aiConfigured: data.AI_API_KEY.length > 0,
  };
  cachedFingerprint = fp;
  return cached;
}
