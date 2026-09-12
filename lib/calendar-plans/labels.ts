/**
 * Kalendar rejaga XOS interfeys yorliqlari.
 *
 * Umumiy yorliqlar (holat, til, sana) `lib/ui/labels.ts` da.
 */

/** Formada tanlash uchun tayyor davr variantlari. */
export const PERIOD_PRESETS = [
  { label: "1-chorak", weeks: 9 },
  { label: "2-chorak", weeks: 7 },
  { label: "3-chorak", weeks: 10 },
  { label: "4-chorak", weeks: 8 },
  { label: "1-yarim yil", weeks: 16 },
  { label: "2-yarim yil", weeks: 18 },
  { label: "O'quv yili", weeks: 34 },
] as const;

/** Haftalik soat variantlari. */
export const HOURS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

/** Sanani `<input type="date">` uchun "YYYY-MM-DD" ko'rinishida. */
export function toDateInputValue(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toISOString().slice(0, 10);
}

/** Sanani o'qish uchun "14.09.2026" ko'rinishida. */
export function formatShortDate(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${value.getUTCFullYear()}`;
}
