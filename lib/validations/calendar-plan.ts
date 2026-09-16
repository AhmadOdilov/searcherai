import { z } from "zod";
import { stripTags } from "@/lib/validations/sanitize";
import {
  gradeSchema,
  languageSchema,
  paginationSchema,
  subjectSchema,
} from "@/lib/validations/common";

/**
 * Kalendar-tematik reja sxemalari.
 *
 * Avvalgi modullardagi kabi ikki xil sxema: kirish (forma) va AI kontenti.
 */

// ─── 1. Kirish ma'lumoti ─────────────────────────────────────────────────────

/** Davr nomi — "1-chorak", "2026-2027 o'quv yili". */
export const periodSchema = z
  .string({ error: "errors.validation.periodRequired" })
  .trim()
  .transform(stripTags)
  .pipe(
    z
      .string()
      .min(2, "errors.validation.periodRequired")
      .max(100, "errors.validation.periodTooLong"),
  );

/**
 * Davr uzunligi, haftada.
 *
 * ── Nega 24, 52 emas ──────────────────────────────────────────────────────
 * Chegara MODEL imkoniyatidan kelib chiqadi, mantiqdan emas. Haqiqiy AI
 * bilan o'lchandi: 24 haftagacha natija ishonchli, undan uzunda model
 * "ANIQ N ta hafta yoz" ko'rsatmasiga rioya qilmay, qisqa ro'yxat
 * qaytaradi va generatsiya yiqiladi.
 *
 * 24 hafta = yarim yil. To'liq o'quv yili (34 hafta) keyingi versiyada —
 * uni bo'lib generatsiya qilish yoki boshqa model kerak bo'ladi.
 */
export const MAX_WEEKS = 24;

export const weeksSchema = z.coerce
  .number({ error: "errors.validation.weeksNotInteger" })
  .int("errors.validation.weeksNotInteger")
  .min(1, "errors.validation.weeksTooFew")
  .max(MAX_WEEKS, "errors.validation.weeksTooMany");

/** Haftalik dars soati. */
export const hoursPerWeekSchema = z.coerce
  .number({ error: "errors.validation.hoursNotInteger" })
  .int("errors.validation.hoursNotInteger")
  .min(1, "errors.validation.hoursTooFew")
  .max(20, "errors.validation.hoursTooMany");

/**
 * Boshlanish sanasi.
 *
 * Formadan `<input type="date">` orqali "2026-09-14" ko'rinishida keladi.
 * `z.coerce.date()` uni `Date` ga o'giradi; noto'g'ri qiymatda xato beradi.
 */
export const startDateSchema = z.coerce
  .date({ error: "errors.validation.dateInvalid" })
  .refine(
    (date) => date.getFullYear() >= 2000 && date.getFullYear() <= 2100,
    "errors.validation.dateOutOfRange",
  );

export const calendarPlanInputSchema = z.object({
  subject: subjectSchema,
  grade: gradeSchema,
  period: periodSchema,
  startDate: startDateSchema,
  weeks: weeksSchema.default(9),
  hoursPerWeek: hoursPerWeekSchema.default(2),
  language: languageSchema.default("UZ"),

  /**
   * Rasmiy o'quv dasturidan olingan kontekst.
   *
   * Foydalanuvchidan KELMAYDI — servis qatlami bazadan topib qo'yadi
   * (`lib/calendar-plans/service.ts`). Sxemada turishining sababi:
   * prompt quruvchi bitta `input` obyektini oladi.
   */
  curriculumContext: z.string().trim().max(8000).optional(),
});

export type CalendarPlanInput = z.infer<typeof calendarPlanInputSchema>;

export const calendarPlanListQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "READY", "FAILED"]).optional(),
});

export type CalendarPlanListQuery = z.infer<typeof calendarPlanListQuerySchema>;

// ─── 2. AI qaytaradigan struktura ────────────────────────────────────────────
//
// DIQQAT: quyidagi xabarlar TARJIMA KALITI EMAS, tabiiy matn. Ular
// foydalanuvchiga ko'rsatilmaydi — `generateJson` ularni MODELGA qayta
// so'rov bilan yuboradi, model esa kalitni emas, tushunarli matnni o'qiydi.

/** Bitta hafta ichidagi bitta mavzu (jadvalda bitta qator). */
export const calendarTopicSchema = z.object({
  name: z
    .string({ error: "Mavzu nomi yozilmagan" })
    .trim()
    .min(3, "Mavzu nomi juda qisqa")
    .max(300, "Mavzu nomi juda uzun"),
  /** Shu mavzuga ajratilgan soat. */
  hours: z
    .number({ error: "Soat yozilmagan" })
    .int("Soat butun son bo'lishi kerak")
    .min(1, "errors.validation.hoursTooFew")
    .max(20, "Bitta mavzuga 20 soatdan ko'p ajratilmaydi"),
  /** Izoh — metod, resurs yoki nazorat turi. Ixtiyoriy. */
  note: z
    .string({ error: "Izoh matn bo'lishi kerak" })
    .trim()
    .max(500, "Izoh juda uzun")
    .optional(),
});

export type CalendarTopic = z.infer<typeof calendarTopicSchema>;

export const calendarWeekSchema = z.object({
  weekNumber: z
    .number({ error: "Hafta raqami yozilmagan" })
    .int("Hafta raqami butun son bo'lishi kerak")
    .min(1, "Hafta raqami 1 dan boshlanadi")
    .max(MAX_WEEKS, `Hafta raqami ${MAX_WEEKS} dan oshmaydi`),
  /**
   * Sana oralig'i — "14.09.2026 – 20.09.2026" kabi.
   *
   * ERKIN MATN, chunki tilga qarab format o'zgaradi va AI ba'zan faqat
   * boshlang'ich sanani beradi. Aniq sanalar kerak bo'lsa ular boshlanish
   * sanasidan hisoblanadi — `lib/calendar-plans/dates.ts` ga qara.
   */
  dateRange: z.string({ error: "Sana oralig'i yozilmagan" }).trim().min(1).max(100),
  topics: z
    .array(calendarTopicSchema, { error: "Hafta mavzulari yozilmagan" })
    .min(1, "Har bir haftada kamida 1 mavzu bo'lishi kerak")
    .max(10, "Bitta haftaga 10 dan ko'p mavzu ko'p"),
});

export type CalendarWeek = z.infer<typeof calendarWeekSchema>;

export const calendarPlanContentSchema = z.object({
  title: z
    .string({ error: "Reja sarlavhasi yozilmagan" })
    .trim()
    .min(5, "Sarlavha juda qisqa")
    .max(200, "Sarlavha juda uzun"),
  weeks: z
    .array(calendarWeekSchema, { error: "Haftalar ro'yxati yozilmagan" })
    .min(1, "errors.validation.weeksTooFew")
    .max(52, "errors.validation.weeksTooMany"),
});

export type CalendarPlanContent = z.infer<typeof calendarPlanContentSchema>;

/** Jadvaldagi qatorlar soni — har bir mavzu bitta qator. */
export function totalRowCount(content: CalendarPlanContent): number {
  return content.weeks.reduce((sum, week) => sum + week.topics.length, 0);
}

/** Rejadagi umumiy soat. */
export function totalHours(content: CalendarPlanContent): number {
  return content.weeks.reduce(
    (sum, week) => sum + week.topics.reduce((weekSum, topic) => weekSum + topic.hours, 0),
    0,
  );
}

/**
 * Berilgan parametrlar uchun sxema — hafta soni va soatni ham tekshiradi.
 *
 * ── Nega chegara KENG ─────────────────────────────────────────────────────
 * Dars ishlanmasidagi vaqt tekshiruvi bilan bir xil mulohaza: qat'iy
 * tenglik talab qilsak, AI 18 soat o'rniga 17 bergan holatda butun
 * generatsiya yiqilardi — foydalanuvchi uchun bu "ishlamadi", holbuki
 * natija amalda yaroqli. Keng chegara esa mantiqsiz javoblarni
 * (9 haftaga 2 hafta yoki 100 soat) tutib qoladi va `generateJson`
 * modelga xatoni aytib qayta so'raydi.
 *
 * Aniq raqamlar UI'da ko'rsatiladi — o'qituvchi ko'rib o'zi tuzatadi.
 */
export function calendarPlanContentSchemaFor(input: {
  weeks: number;
  hoursPerWeek: number;
}) {
  const expectedHours = input.weeks * input.hoursPerWeek;
  const minWeeks = Math.max(1, Math.floor(input.weeks * 0.7));
  const maxWeeks = Math.ceil(input.weeks * 1.3);
  const minHours = Math.floor(expectedHours * 0.6);
  const maxHours = Math.ceil(expectedHours * 1.4);

  return calendarPlanContentSchema.superRefine((content, ctx) => {
    if (content.weeks.length < minWeeks || content.weeks.length > maxWeeks) {
      ctx.addIssue({
        code: "custom",
        path: ["weeks"],
        message:
          `Rejada ${content.weeks.length} hafta bor, lekin davr ${input.weeks} hafta. ` +
          `ANIQ ${input.weeks} ta hafta yoz.`,
      });
    }

    const hours = content.weeks.reduce(
      (sum, week) =>
        sum + week.topics.reduce((weekSum, topic) => weekSum + topic.hours, 0),
      0,
    );

    if (hours < minHours || hours > maxHours) {
      ctx.addIssue({
        code: "custom",
        path: ["weeks"],
        message:
          `Umumiy soat ${hours}, lekin ${input.weeks} hafta × ${input.hoursPerWeek} soat = ${expectedHours} bo'lishi kerak. ` +
          `Har haftada soatlar yig'indisi ${input.hoursPerWeek} bo'lsin.`,
      });
    }
  });
}

/**
 * `PATCH /api/calendar-plans/[id]` so'rovining tanasi.
 *
 * ── Nega `calendarPlanContentSchemaFor` ISHLATILMAYDI ────────────────────
 * O'sha sxema hafta soni va umumiy soatni SO'RALGAN davrga solishtiradi
 * ("9 hafta so'radingiz, 6 hafta keldi — qayta yoz"). U MODELNI
 * intizomga soladi.
 *
 * O'qituvchiga esa bu chegara to'g'ri kelmaydi: chorak qisqarishi,
 * bayram tushib qolishi yoki ikki mavzuni birlashtirishi mumkin. Uning
 * tahririni "davrga to'g'ri kelmadi" deb rad etish — o'z rejasini
 * tuzishga to'sqinlik qilish.
 *
 * Asosiy chegaralar (hafta raqami, soat 1-20, mavzu nomi uzunligi)
 * baribir kuchda qoladi — ular yaroqsiz .xlsx yasalishining oldini oladi.
 */
export const calendarPlanEditSchema = z
  .object({
    content: calendarPlanContentSchema,
  })
  .strict();

export type CalendarPlanEditInput = z.infer<typeof calendarPlanEditSchema>;

/** Bazadagi `content` (Json) ustunini xavfsiz o'qiydi. */
export function parseCalendarPlanContent(value: unknown): CalendarPlanContent | null {
  const parsed = calendarPlanContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
