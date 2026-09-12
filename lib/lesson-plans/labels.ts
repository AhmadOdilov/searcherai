/**
 * Dars ishlanmasiga xos UI qiymatlari.
 *
 * Matnlar `messages/*.json` ga ko'chirilgan (`lessonPlans.*`) — bu yerda
 * faqat tarjima talab qilmaydigan qiymatlar qoldi.
 */

/** Formada tanlash uchun tayyor davomiylik variantlari. */
export const DURATION_OPTIONS = [40, 45, 60, 90] as const;

/**
 * Generatsiya bosqichlarining tarjima kalitlari.
 *
 * `GenerationProgress` komponenti o'tgan vaqtga qarab birin-ketin
 * ko'rsatadi — jarayon "tirik" ko'rinsin.
 */
export const PROGRESS_KEYS = [
  "progress.sent",
  "progress.objective",
  "progress.stages",
  "progress.resources",
  "progress.finishing",
] as const;

/** Odatdagi davomiylik, soniyada — kutish matnida ko'rsatiladi. */
export const TYPICAL_SECONDS = 20;
