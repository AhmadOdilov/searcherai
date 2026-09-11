import { z } from "zod";

/**
 * Barcha modullar uchun umumiy zod bo'laklari.
 *
 * Keyingi modullar shu yerdan qurilma sifatida foydalanadi — masalan
 * `subject`, `grade`, `language` har joyda bir xil qoidaga bo'ysunadi.
 */

/** Interfeys va generatsiya tili — Prisma'dagi `Language` enum'iga mos. */
export const languageSchema = z.enum(["UZ", "RU", "EN"]);
export type LanguageCode = z.infer<typeof languageSchema>;

/** AI promptida til nomini yozish uchun. */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  UZ: "o'zbek",
  RU: "rus",
  EN: "ingliz",
};

/** Fan nomi — "Matematika", "Ona tili va adabiyot". */
export const subjectSchema = z
  .string()
  .trim()
  .min(2, "Fan nomi kamida 2 belgidan iborat bo'lishi kerak")
  .max(100, "Fan nomi juda uzun");

/** Sinf/daraja — "7-sinf", "1-kurs". Raqam emas, chunki shakllar xilma-xil. */
export const gradeSchema = z
  .string()
  .trim()
  .min(1, "Sinfni kiriting")
  .max(50, "Sinf nomi juda uzun");

/** Dars mavzusi. */
export const topicSchema = z
  .string()
  .trim()
  .min(3, "Mavzu kamida 3 belgidan iborat bo'lishi kerak")
  .max(300, "Mavzu juda uzun");

/** Dars davomiyligi, daqiqada. */
export const durationMinutesSchema = z.coerce
  .number()
  .int("Davomiylik butun son bo'lishi kerak")
  .min(10, "Dars kamida 10 daqiqa bo'lishi kerak")
  .max(240, "Dars 240 daqiqadan oshmasligi kerak");

/** Dars turi — Prisma'dagi `LessonType` enum'iga mos. */
export const lessonTypeSchema = z.enum(["NEW_TOPIC", "REINFORCEMENT", "ASSESSMENT"]);
export type LessonTypeCode = z.infer<typeof lessonTypeSchema>;

/** cuid — Prisma `@default(cuid())` bilan yaratilgan identifikatorlar. */
export const idSchema = z.string().min(1, "ID ko'rsatilmagan");

/** Ro'yxatlarni sahifalash uchun. */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
