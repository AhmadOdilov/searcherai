import { z } from "zod";
import { stripTags } from "@/lib/validations/sanitize";

/**
 * Barcha modullar uchun umumiy zod bo'laklari.
 *
 * Modullar shu yerdan qurilma sifatida foydalanadi — masalan `subject`,
 * `grade`, `language` har joyda bir xil qoidaga bo'ysunadi.
 *
 * ── Xato xabarlari TARJIMA KALITI ─────────────────────────────────────────
 * Sxemalar modul darajasida bir marta yaratiladi, foydalanuvchi tili esa
 * faqat so'rov paytida ma'lum bo'ladi. Shuning uchun bu yerda xabar
 * o'rniga KALIT yoziladi (`errors.validation.*`), tarjima esa javob
 * shakllanadigan joyda (`withErrorHandling`) qilinadi.
 *
 * DIQQAT: bu FAQAT kirish (forma) sxemalariga tegishli. AI qaytaradigan
 * kontent sxemalarining xabarlari TABIIY MATN bo'lib qoladi — ular
 * `generateJson` da modelga qayta so'rov bilan yuboriladi va model kalit
 * emas, tushunarli matnni o'qiydi.
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

/*
  ── Nega `transform` tekshiruvdan OLDIN ────────────────────────────────────
  Tozalash uzunlikni o'zgartiradi: `<b>x</b>` — 9 belgi, tozalangach 1 ta.
  Tekshiruv oldin bo'lsa, "<b></b>" kabi bo'm-bo'sh qiymat uzunlik
  tekshiruvidan o'tib ketardi va bazaga bo'sh mavzu tushardi.
*/

/** Fan nomi — "Matematika", "Ona tili va adabiyot". */
export const subjectSchema = z
  .string()
  .trim()
  .transform(stripTags)
  .pipe(
    z
      .string()
      .min(2, "errors.validation.subjectTooShort")
      .max(100, "errors.validation.subjectTooLong"),
  );

/** Sinf/daraja — "7-sinf", "1-kurs". Raqam emas, chunki shakllar xilma-xil. */
export const gradeSchema = z
  .string()
  .trim()
  .transform(stripTags)
  .pipe(
    z
      .string()
      .min(1, "errors.validation.gradeRequired")
      .max(50, "errors.validation.gradeTooLong"),
  );

/** Dars mavzusi. */
export const topicSchema = z
  .string()
  .trim()
  .transform(stripTags)
  .pipe(
    z
      .string()
      .min(3, "errors.validation.topicTooShort")
      .max(300, "errors.validation.topicTooLong"),
  );

/** Dars davomiyligi, daqiqada. */
export const durationMinutesSchema = z.coerce
  .number()
  .int("errors.validation.durationNotInteger")
  .min(10, "errors.validation.durationTooShort")
  .max(240, "errors.validation.durationTooLong");

/** Dars turi — Prisma'dagi `LessonType` enum'iga mos. */
export const lessonTypeSchema = z.enum(["NEW_TOPIC", "REINFORCEMENT", "ASSESSMENT"]);
export type LessonTypeCode = z.infer<typeof lessonTypeSchema>;

/** cuid — Prisma `@default(cuid())` bilan yaratilgan identifikatorlar. */
export const idSchema = z.string().min(1, "errors.validation.idRequired");

/**
 * Ro'yxatlarni sahifalash.
 *
 * Standart 20 — birinchi yuklanish tez bo'lsin. Ro'yxat sahifalari
 * "Ko'proq yuklash" tugmasi bilan davomini oladi (`nextCursor`).
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
