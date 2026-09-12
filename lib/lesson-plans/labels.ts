import type { LessonTypeCode } from "@/lib/validations/common";

/**
 * Dars ishlanmasiga XOS interfeys yorliqlari.
 *
 * Modullar orasida umumiy bo'lganlar (holat, til, sana formatlash)
 * `lib/ui/labels.ts` ga ko'chirilgan — prezentatsiya moduli ham shulardan
 * foydalanadi.
 */

/** Dars turi — formada va ro'yxatda ko'rsatish uchun (o'zbekcha). */
export const LESSON_TYPE_LABELS: Record<LessonTypeCode, string> = {
  NEW_TOPIC: "Yangi mavzu",
  REINFORCEMENT: "Mustahkamlash",
  ASSESSMENT: "Nazorat / baholash",
};

/** Formada tanlash uchun tayyor davomiylik variantlari. */
export const DURATION_OPTIONS = [40, 45, 60, 90] as const;

/** Qulaylik uchun qayta eksport — chaqiruvchilar bitta joydan oladi. */
export {
  LANGUAGE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  formatDate,
  formatFileSize,
} from "@/lib/ui/labels";
