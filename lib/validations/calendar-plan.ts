import { z } from "zod";
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
  .string()
  .trim()
  .min(2, "Davr nomini kiriting")
  .max(100, "Davr nomi juda uzun");

/**
 * Davr uzunligi, haftada.
 *
 * Yuqori chegara 52 — bir o'quv yili. Undan ko'pi mantiqsiz va AI javobini
 * juda uzaytirib, generatsiyani timeout'ga olib kelardi.
 */
export const weeksSchema = z.coerce
  .number()
  .int("Haftalar soni butun son bo'lishi kerak")
  .min(1, "Kamida 1 hafta bo'lishi kerak")
  .max(52, "52 haftadan ko'p bo'lmasligi kerak");

/** Haftalik dars soati. */
export const hoursPerWeekSchema = z.coerce
  .number()
  .int("Soat soni butun son bo'lishi kerak")
  .min(1, "Kamida 1 soat bo'lishi kerak")
  .max(20, "Haftalik 20 soatdan ko'p bo'lmasligi kerak");

/**
 * Boshlanish sanasi.
 *
 * Formadan `<input type="date">` orqali "2026-09-14" ko'rinishida keladi.
 * `z.coerce.date()` uni `Date` ga o'giradi; noto'g'ri qiymatda xato beradi.
 */
export const startDateSchema = z.coerce
  .date({ error: "Sanani to'g'ri kiriting" })
  .refine(
    (date) => date.getFullYear() >= 2000 && date.getFullYear() <= 2100,
    "Sana 2000-2100 oralig'ida bo'lishi kerak",
  );

export const calendarPlanInputSchema = z.object({
  subject: subjectSchema,
  grade: gradeSchema,
  period: periodSchema,
  startDate: startDateSchema,
  weeks: weeksSchema.default(9),
  hoursPerWeek: hoursPerWeekSchema.default(2),
  language: languageSchema.default("UZ"),
});

export type CalendarPlanInput = z.infer<typeof calendarPlanInputSchema>;

export const calendarPlanListQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "READY", "FAILED"]).optional(),
});

export type CalendarPlanListQuery = z.infer<typeof calendarPlanListQuerySchema>;

// ─── 2. AI qaytaradigan struktura ────────────────────────────────────────────

/** Bitta hafta ichidagi bitta mavzu (jadvalda bitta qator). */
export const calendarTopicSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Mavzu nomi juda qisqa")
    .max(300, "Mavzu nomi juda uzun"),
  /** Shu mavzuga ajratilgan soat. */
  hours: z
    .number()
    .int("Soat butun son bo'lishi kerak")
    .min(1, "Kamida 1 soat bo'lishi kerak")
    .max(20, "Bitta mavzuga 20 soatdan ko'p ajratilmaydi"),
  /** Izoh — metod, resurs yoki nazorat turi. Ixtiyoriy. */
  note: z.string().trim().max(500, "Izoh juda uzun").optional(),
});

export type CalendarTopic = z.infer<typeof calendarTopicSchema>;

export const calendarWeekSchema = z.object({
  weekNumber: z
    .number()
    .int("Hafta raqami butun son bo'lishi kerak")
    .min(1, "Hafta raqami 1 dan boshlanadi")
    .max(52, "Hafta raqami 52 dan oshmaydi"),
  /**
   * Sana oralig'i — "14.09.2026 – 20.09.2026" kabi.
   *
   * ERKIN MATN, chunki tilga qarab format o'zgaradi va AI ba'zan faqat
   * boshlang'ich sanani beradi. Aniq sanalar kerak bo'lsa ular boshlanish
   * sanasidan hisoblanadi — `lib/calendar-plans/dates.ts` ga qara.
   */
  dateRange: z.string().trim().min(1).max(100),
  topics: z
    .array(calendarTopicSchema)
    .min(1, "Har bir haftada kamida 1 mavzu bo'lishi kerak")
    .max(10, "Bitta haftaga 10 dan ko'p mavzu ko'p"),
});

export type CalendarWeek = z.infer<typeof calendarWeekSchema>;

export const calendarPlanContentSchema = z.object({
  title: z.string().trim().min(5, "Sarlavha juda qisqa").max(200, "Sarlavha juda uzun"),
  weeks: z
    .array(calendarWeekSchema)
    .min(1, "Kamida 1 hafta bo'lishi kerak")
    .max(52, "52 haftadan ko'p bo'lmasligi kerak"),
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

/** Bazadagi `content` (Json) ustunini xavfsiz o'qiydi. */
export function parseCalendarPlanContent(value: unknown): CalendarPlanContent | null {
  const parsed = calendarPlanContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
