import type { LanguageCode } from "@/lib/validations/common";

/**
 * Modullar ORASIDA umumiy bo'lgan UI yorliqlari.
 *
 * Dars ishlanmasi, prezentatsiya va (keyinchalik) Excel reja — hammasi
 * bir xil `GenerationStatus` oqimidan foydalanadi, shuning uchun holat
 * yorliqlari shu yerda. Modulga XOS yorliqlar esa o'z papkasida qoladi
 * (masalan `lib/lesson-plans/labels.ts` dagi dars turlari).
 *
 * DIQQAT: matnlar hozircha faqat o'zbek tilida — interfeys tarjimasi (i18n)
 * keyingi bosqichda qo'shiladi va bu qiymatlar tarjima kalitlariga ko'chadi.
 */

export const STATUS_LABELS = {
  PENDING: "Yaratilmoqda",
  READY: "Tayyor",
  FAILED: "Xatolik",
} as const;

export const STATUS_STYLES = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  READY: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
} as const;

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  UZ: "O'zbek",
  RU: "Rus",
  EN: "Ingliz",
};

/** Sanani o'qilishi qulay ko'rinishda. */
export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Fayl hajmi — yuklab olish tugmasida ko'rsatish uchun. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
