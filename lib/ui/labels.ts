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
