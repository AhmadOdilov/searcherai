import type { LanguageCode, LessonTypeCode } from "@/lib/validations/common";

/**
 * Interfeys yorliqlari.
 *
 * DIQQAT: hozircha faqat o'zbek tilida — interfeys tarjimasi alohida modul
 * (i18n) sifatida keyingi bosqichda qo'shiladi. O'sha paytda bu fayldagi
 * qiymatlar tarjima kalitlariga ko'chiriladi. Shu sababli ular bitta joyda
 * yig'ilgan, komponentlar ichiga sochib yuborilmagan.
 */

export const STATUS_LABELS = {
  PENDING: "Yaratilmoqda",
  READY: "Tayyor",
  FAILED: "Xatolik",
} as const;

/** Holat rangi — Tailwind sinflari. */
export const STATUS_STYLES = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  READY: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
} as const;

/** Dars turi — formada va ro'yxatda ko'rsatish uchun (o'zbekcha). */
export const LESSON_TYPE_LABELS: Record<LessonTypeCode, string> = {
  NEW_TOPIC: "Yangi mavzu",
  REINFORCEMENT: "Mustahkamlash",
  ASSESSMENT: "Nazorat / baholash",
};

/** Generatsiya tili — formada tanlash uchun. */
export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  UZ: "O'zbek",
  RU: "Rus",
  EN: "Ingliz",
};

/** Formada tanlash uchun tayyor davomiylik variantlari. */
export const DURATION_OPTIONS = [40, 45, 60, 90] as const;

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
