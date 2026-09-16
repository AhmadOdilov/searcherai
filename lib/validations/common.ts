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
 * ── Nega har bir sxemada `{ error: ... }` bor ────────────────────────────
 * `.min()` / `.max()` xabarlari faqat qiymat KELGANDA ishlaydi. Maydon
 * umuman yuborilmasa yoki boshqa turda kelsa, zod o'zining inglizcha
 * matnini qaytaradi: "Invalid input: expected string, received undefined".
 * Bu matn `fieldErrors` orqali to'g'ri foydalanuvchiga chiqardi.
 *
 * Sxema darajasidagi `error` AYNAN shu holatni (tip xatosini) qamrab
 * oladi va `.min()` xabarlarini BOSMAYDI — ikkisi alohida ishlaydi.
 *
 * DIQQAT: bu FAQAT kirish (forma) sxemalariga tegishli. AI qaytaradigan
 * kontent sxemalarining xabarlari TABIIY MATN bo'lib qoladi — ular
 * `generateJson` da modelga qayta so'rov bilan yuboriladi va model kalit
 * emas, tushunarli matnni o'qiydi.
 */

/** Interfeys va generatsiya tili — Prisma'dagi `Language` enum'iga mos. */
export const languageSchema = z.enum(["UZ", "RU", "EN"], {
  error: "errors.validation.invalidValue",
});
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
  .string({ error: "errors.validation.subjectTooShort" })
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
  .string({ error: "errors.validation.gradeRequired" })
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
  .string({ error: "errors.validation.topicTooShort" })
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
  .number({ error: "errors.validation.durationNotInteger" })
  .int("errors.validation.durationNotInteger")
  .min(10, "errors.validation.durationTooShort")
  .max(240, "errors.validation.durationTooLong");

/** Dars turi — Prisma'dagi `LessonType` enum'iga mos. */
export const lessonTypeSchema = z.enum(["NEW_TOPIC", "REINFORCEMENT", "ASSESSMENT"], {
  error: "errors.validation.invalidValue",
});
export type LessonTypeCode = z.infer<typeof lessonTypeSchema>;

/** cuid — Prisma `@default(cuid())` bilan yaratilgan identifikatorlar. */
export const idSchema = z
  .string({ error: "errors.validation.idRequired" })
  .min(1, "errors.validation.idRequired");

/**
 * Ro'yxatlarni sahifalash.
 *
 * Standart 20 — birinchi yuklanish tez bo'lsin. Ro'yxat sahifalari
 * "Ko'proq yuklash" tugmasi bilan davomini oladi (`nextCursor`).
 */
export const paginationSchema = z.object({
  limit: z.coerce
    .number({ error: "errors.validation.invalidValue" })
    .int("errors.validation.invalidValue")
    .min(1, "errors.validation.invalidValue")
    .max(100, "errors.validation.invalidValue")
    .default(20),
  cursor: z.string({ error: "errors.validation.invalidValue" }).optional(),
});
