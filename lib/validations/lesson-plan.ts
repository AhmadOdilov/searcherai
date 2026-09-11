import { z } from "zod";
import {
  durationMinutesSchema,
  gradeSchema,
  languageSchema,
  lessonTypeSchema,
  paginationSchema,
  subjectSchema,
  topicSchema,
} from "@/lib/validations/common";

/**
 * Dars ishlanmasi sxemalari.
 *
 * Ikki xil sxema bor va ularni ARALASHTIRMASLIK kerak:
 *
 *  1. `lessonPlanInputSchema`   — foydalanuvchi formasidan keladigan ma'lumot
 *  2. `lessonPlanContentSchema` — AI qaytaradigan struktura
 *
 * Ikkinchisi ikki joyda ishlatiladi: AI javobini tekshirishda va bazadagi
 * `content` (Json) ustunini QAYTA O'QIYOTGANDA. Json ustun TypeScript uchun
 * `unknown` — unga shunchaki `as` bilan tip berib qo'yish xavfli, chunki
 * eski yozuvlar boshqa shaklda bo'lishi mumkin (sxema vaqt o'tib o'zgaradi).
 */

// ─── 1. Kirish ma'lumoti (forma) ─────────────────────────────────────────────

export const lessonPlanInputSchema = z.object({
  subject: subjectSchema,
  grade: gradeSchema,
  topic: topicSchema,
  durationMinutes: durationMinutesSchema.default(45),
  lessonType: lessonTypeSchema.default("NEW_TOPIC"),
  language: languageSchema.default("UZ"),
});

export type LessonPlanInput = z.infer<typeof lessonPlanInputSchema>;

/** Ro'yxat so'rovi uchun — sahifalash va holat bo'yicha filtr. */
export const lessonPlanListQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "READY", "FAILED"]).optional(),
});

export type LessonPlanListQuery = z.infer<typeof lessonPlanListQuerySchema>;

// ─── 2. AI qaytaradigan struktura ────────────────────────────────────────────

/**
 * Dars bosqichi — kirish, asosiy qism, mustahkamlash, uyga vazifa va h.k.
 *
 * `name` ataylab ERKIN MATN, enum emas: bosqich nomlari fanga va dars turiga
 * qarab o'zgaradi ("Tajriba o'tkazish", "Guruhlarda ishlash"), bundan tashqari
 * tanlangan tilda qaytadi ("Введение", "Introduction").
 */
export const lessonStageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Bosqich nomi juda qisqa")
    .max(120, "Bosqich nomi juda uzun"),
  durationMinutes: z
    .number()
    .int("Bosqich davomiyligi butun son bo'lishi kerak")
    .min(1, "Bosqich kamida 1 daqiqa bo'lishi kerak")
    .max(240, "Bosqich davomiyligi juda uzun"),
  description: z
    .string()
    .trim()
    .min(10, "Bosqich tavsifi juda qisqa")
    .max(2000, "Bosqich tavsifi juda uzun"),
  teacherActivity: z
    .string()
    .trim()
    .min(5, "O'qituvchi faoliyati ko'rsatilmagan")
    .max(2000, "O'qituvchi faoliyati juda uzun"),
  studentActivity: z
    .string()
    .trim()
    .min(5, "O'quvchi faoliyati ko'rsatilmagan")
    .max(2000, "O'quvchi faoliyati juda uzun"),
});

export type LessonStage = z.infer<typeof lessonStageSchema>;

/**
 * To'liq dars ishlanmasi.
 *
 * Chegaralar (min/max) ataylab qo'yilgan: AI ba'zan bitta so'zli "maqsad"
 * yoki bo'sh massiv qaytaradi. Bunday javob sxemadan o'tmaydi va
 * `generateJson` modelga xatoni aytib qayta so'raydi.
 */
export const lessonPlanContentSchema = z.object({
  /** O'quv maqsadi — dars nima uchun o'tkaziladi. */
  objective: z.string().trim().min(10, "Maqsad juda qisqa").max(1000, "Maqsad juda uzun"),

  /** Kutilayotgan natijalar — "o'quvchi ... qila oladi" ko'rinishida. */
  outcomes: z
    .array(z.string().trim().min(3).max(500))
    .min(2, "Kamida 2 ta kutilayotgan natija bo'lishi kerak")
    .max(10, "Kutilayotgan natijalar juda ko'p"),

  /** Kerakli resurslar va materiallar. */
  resources: z
    .array(z.string().trim().min(2).max(300))
    .min(1, "Kamida 1 ta resurs ko'rsatilishi kerak")
    .max(20, "Resurslar juda ko'p"),

  /** Dars bosqichlari — vaqt taqsimoti bilan. */
  stages: z
    .array(lessonStageSchema)
    .min(3, "Dars kamida 3 bosqichdan iborat bo'lishi kerak")
    .max(12, "Bosqichlar juda ko'p"),

  /** Baholash mezonlari — ixtiyoriy (nazorat darsi bo'lmasa bo'lmasligi mumkin). */
  assessmentCriteria: z
    .array(z.string().trim().min(3).max(500))
    .max(10, "Baholash mezonlari juda ko'p")
    .optional(),
});

export type LessonPlanContent = z.infer<typeof lessonPlanContentSchema>;

/**
 * Bosqichlar davomiyligining yig'indisi.
 *
 * UI'da ko'rsatiladi — o'qituvchi vaqt taqsimoti to'g'rimi deb bir qarashda
 * ko'rishi uchun.
 */
export function totalStageMinutes(content: LessonPlanContent): number {
  return content.stages.reduce((sum, stage) => sum + stage.durationMinutes, 0);
}

/**
 * Berilgan dars davomiyligi uchun sxema — vaqt yig'indisini ham tekshiradi.
 *
 * ── Nega chegara KENG (50%–150%) ──────────────────────────────────────────
 * Qat'iy tenglik (yig'indi = davomiylik) talab qilsak, AI 45 daqiqa o'rniga
 * 44 qaytarganda butun generatsiya yiqilardi — foydalanuvchi uchun bu
 * "AI ishlamadi" degani, holbuki natija amalda yaroqli. Keng chegara esa
 * mantiqsiz javoblarni (45 daqiqalik darsga 5 yoki 200 daqiqa) tutib qoladi
 * va `generateJson` modelga xatoni aytib qayta so'raydi.
 *
 * Aniq yig'indi UI'da ko'rsatiladi — o'qituvchi o'zi ko'rib tuzatadi.
 */
export function lessonPlanContentSchemaFor(durationMinutes: number) {
  const min = Math.floor(durationMinutes * 0.5);
  const max = Math.ceil(durationMinutes * 1.5);

  return lessonPlanContentSchema.superRefine((content, ctx) => {
    const total = content.stages.reduce((sum, stage) => sum + stage.durationMinutes, 0);

    if (total < min || total > max) {
      ctx.addIssue({
        code: "custom",
        path: ["stages"],
        message:
          `Bosqichlar davomiyligi yig'indisi ${total} daqiqa, ` +
          `lekin dars ${durationMinutes} daqiqa. ` +
          `Bosqichlarni shunday taqsimla, yig'indi ${durationMinutes} bo'lsin.`,
      });
    }
  });
}

/**
 * Bazadagi `content` (Json) ustunini xavfsiz o'qiydi.
 *
 * Shakl mos kelmasa `null` qaytaradi — sahifa "natija buzilgan" holatini
 * ko'rsatadi, qulab tushmaydi. Bu eski yozuvlar uchun muhim: sxema
 * keyinchalik o'zgarsa, ilova ishlashda davom etadi.
 */
export function parseLessonPlanContent(value: unknown): LessonPlanContent | null {
  const parsed = lessonPlanContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
