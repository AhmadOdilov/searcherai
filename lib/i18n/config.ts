/**
 * Interfeys tili — umumiy sozlama.
 *
 * ── MUHIM FARQ: interfeys tili ≠ generatsiya tili ─────────────────────────
 * Bu yerdagi til FAQAT interfeysga tegishli: tugmalar, sarlavhalar, xato
 * xabarlari. Dars ishlanmasi, prezentatsiya va kalendar rejaning TILI esa
 * alohida tushuncha — u har bir generatsiya formasida tanlanadi va
 * `LessonPlan.language` kabi ustunlarda saqlanadi.
 *
 * Ya'ni o'qituvchi interfeysni ruscha ishlatib, dars ishlanmasini o'zbekcha
 * so'rashi mumkin. Shuning uchun bu ikkisi HECH QACHON bir-biriga
 * bog'lanmaydi.
 *
 * `server-only` belgisi YO'Q — bu fayl klient komponentlarida ham kerak.
 */

/** Interfeys tillari. Generatsiya tillari bundan KENGROQ (UZ/RU/EN). */
export const UI_LOCALES = ["uz", "ru"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export const DEFAULT_LOCALE: UiLocale = "uz";

/** Til almashtirgichda ko'rsatiladigan nomlar — har biri O'Z tilida. */
export const LOCALE_NAMES: Record<UiLocale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
};

/** Qisqa yorliq — tor joylarda (masalan header). */
export const LOCALE_SHORT_NAMES: Record<UiLocale, string> = {
  uz: "UZ",
  ru: "RU",
};

/** Sana formatlash uchun `Intl` locale kodi. */
export const INTL_LOCALES: Record<UiLocale, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
};

/** Kirmagan foydalanuvchi tanlovi shu cookie'da saqlanadi. */
export const LOCALE_COOKIE = "searcher_locale";

export function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === "string" && (UI_LOCALES as readonly string[]).includes(value);
}

/**
 * Prisma'dagi `Language` enum'ini interfeys tiliga o'giradi.
 *
 * `EN` — generatsiya tili sifatida mavjud, lekin interfeys hali ikki tilli.
 * Shuning uchun u standart tilga tushadi.
 */
export function localeFromLanguage(language: string): UiLocale {
  const lower = language.toLowerCase();
  return isUiLocale(lower) ? lower : DEFAULT_LOCALE;
}

/** Interfeys tilini Prisma `Language` enum qiymatiga o'giradi. */
export function languageFromLocale(locale: UiLocale): "UZ" | "RU" {
  return locale.toUpperCase() as "UZ" | "RU";
}

/**
 * `Accept-Language` sarlavhasidan mos tilni tanlaydi.
 *
 * Oddiy tahlil: sifat (q) qiymatlarini hisobga olib, birinchi mos kelgan
 * tilni qaytaradi. Hech biri mos kelmasa `null`.
 */
export function localeFromAcceptLanguage(header: string | null): UiLocale | null {
  if (!header) return null;

  const entries = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const quality = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      return {
        tag: tag.trim().toLowerCase(),
        quality: quality ? Number(quality.slice(2)) : 1,
      };
    })
    .filter((entry) => Number.isFinite(entry.quality))
    .sort((a, b) => b.quality - a.quality);

  for (const entry of entries) {
    // "ru-RU" → "ru"
    const base = entry.tag.split("-")[0];
    if (isUiLocale(base)) return base;
  }
  return null;
}
