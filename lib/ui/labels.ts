import { INTL_LOCALES, type UiLocale } from "@/lib/i18n/config";

/**
 * Modullar orasida umumiy formatlash yordamchilari.
 *
 * ── Matnlar bu yerdan KO'CHIRILDI ─────────────────────────────────────────
 * Ilgari bu faylda `STATUS_LABELS`, `LANGUAGE_LABELS` kabi tayyor o'zbekcha
 * matnlar turardi. Endi ular `messages/*.json` da (`status.*`,
 * `languages.*`) va `useTranslations()` orqali olinadi.
 *
 * Bu yerda faqat FORMATLASH qoldi — u tarjima emas, `Intl` ishi.
 */

/** Holat nishonining rangi — bu tarjima emas, shuning uchun shu yerda. */
export const STATUS_STYLES = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  READY: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
} as const;

/**
 * Sanani o'qilishi qulay ko'rinishda — INTERFEYS tiliga qarab.
 *
 * `uz-UZ` va `ru-RU` sana tartibini bir xil (kun.oy.yil) beradi, lekin
 * oy nomlari va ajratgichlar farq qilishi mumkin — shuning uchun locale
 * uzatiladi.
 */
export function formatDate(value: Date | string, locale: UiLocale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Fayl hajmi.
 *
 * Birliklar (B, KB, MB) xalqaro — tarjima qilinmaydi. Son formati esa
 * tilga qarab o'zgaradi (masalan kasr ajratgichi).
 */
export function formatFileSize(bytes: number, locale: UiLocale): string {
  if (bytes < 1024) return `${bytes} B`;

  const format = (value: number, digits: number) =>
    new Intl.NumberFormat(INTL_LOCALES[locale], {
      maximumFractionDigits: digits,
    }).format(value);

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${format(kilobytes, 0)} KB`;
  return `${format(kilobytes / 1024, 1)} MB`;
}
