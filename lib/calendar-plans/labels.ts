import { INTL_LOCALES, type UiLocale } from "@/lib/i18n/config";

/**
 * Kalendar rejaga xos UI qiymatlari.
 *
 * Davr nomlari endi tarjima kalitlari orqali keladi — `PERIOD_PRESETS`
 * faqat KALIT va hafta sonini saqlaydi, ko'rsatiladigan matn esa
 * `calendarPlans.periods.*` dan olinadi.
 */

/**
 * Davr variantlari: tarjima kaliti + standart hafta soni.
 *
 * DIQQAT: "O'quv yili" (34 hafta) ATAYLAB yo'q. Model 24 haftadan uzun
 * rejani ishonchli generatsiya qila olmaydi (o'lchangan) — shuning uchun
 * chegara `MAX_WEEKS = 24`. Yarim yil variantlari eng uzuni.
 */
export const PERIOD_PRESETS = [
  { key: "quarter1", weeks: 9 },
  { key: "quarter2", weeks: 7 },
  { key: "quarter3", weeks: 10 },
  { key: "quarter4", weeks: 8 },
  { key: "halfYear1", weeks: 16 },
  { key: "halfYear2", weeks: 18 },
] as const;

export type PeriodPresetKey = (typeof PERIOD_PRESETS)[number]["key"];

/** Haftalik soat variantlari. */
export const HOURS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

/** Sanani `<input type="date">` uchun "YYYY-MM-DD" ko'rinishida. */
export function toDateInputValue(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toISOString().slice(0, 10);
}

/** Sanani o'qish uchun — interfeys tiliga qarab. */
export function formatShortDate(date: Date | string, locale: UiLocale): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

/** Generatsiya bosqichlarining tarjima kalitlari. */
export const PROGRESS_KEYS = [
  "progress.sent",
  "progress.sequence",
  "progress.distribute",
  "progress.hours",
  "progress.file",
  "progress.finishing",
] as const;

/**
 * Odatdagi davomiylik, soniyada.
 *
 * Bu eng sekin modul. Qiymat HAQIQIY o'lchovdan olingan: kalendar reja
 * uchun ishlatiladigan model (qwen3-235b) 18-24 haftalik rejani 52-82
 * soniyada tuzadi.
 */
export const TYPICAL_SECONDS = 70;
