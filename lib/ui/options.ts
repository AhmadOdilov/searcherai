/**
 * Formalardagi tanlov ro'yxatlari — KALITLAR, matn emas.
 *
 * Ko'rsatiladigan matn `useTranslations()` orqali olinadi. Bu yerda
 * faqat qiymatlar tartibi saqlanadi.
 */

/** Dars turlari — Prisma `LessonType` enum'iga mos. */
export const LESSON_TYPES = ["NEW_TOPIC", "REINFORCEMENT", "ASSESSMENT"] as const;

/**
 * GENERATSIYA tillari — Prisma `Language` enum'iga mos.
 *
 * DIQQAT: bu INTERFEYS tillari (`UI_LOCALES`) bilan bir xil emas.
 * Interfeys hozircha ikki tilli (uz/ru), generatsiya esa uch tilli —
 * o'qituvchi inglizcha dars ishlanmasini ham so'rashi mumkin.
 */
export const GENERATION_LANGUAGES = ["UZ", "RU", "EN"] as const;
