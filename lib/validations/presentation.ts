import { z } from "zod";
import {
  gradeSchema,
  idSchema,
  languageSchema,
  paginationSchema,
  subjectSchema,
  topicSchema,
} from "@/lib/validations/common";

/**
 * Prezentatsiya sxemalari.
 *
 * Dars ishlanmasi modulidagi kabi ikki xil sxema bor:
 *  1. `presentationInputSchema`   — foydalanuvchi formasidan keladigan ma'lumot
 *  2. `presentationContentSchema` — AI qaytaradigan slaydlar strukturasi
 */

// ─── 1. Kirish ma'lumoti ─────────────────────────────────────────────────────

/**
 * Ikki rejim bor va ular BIR-BIRINI ISTISNO QILADI:
 *
 *  · "from-lesson-plan" — mavjud dars ishlanmasidan. Mavzu, fan, sinf va til
 *    yozuvning O'ZIDAN olinadi, foydalanuvchi qaytadan kiritmaydi.
 *  · "standalone"       — mustaqil. Mavzu majburiy, qolgani ixtiyoriy.
 *
 * Nega `discriminatedUnion`: oddiy `.optional()` maydonlar bilan qilsak,
 * "lessonPlanId ham, topic ham berilgan" yoki "ikkisi ham berilmagan" kabi
 * mantiqsiz holatlar sxemadan o'tib ketardi va ularni kodda qo'lda
 * tekshirishga to'g'ri kelardi. Diskriminator esa har bir rejim uchun
 * TALAB QILINADIGAN maydonlarni aniq belgilaydi.
 */
export const presentationInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("from-lesson-plan"),
    lessonPlanId: idSchema,
  }),
  z.object({
    mode: z.literal("standalone"),
    topic: topicSchema,
    subject: subjectSchema.optional(),
    grade: gradeSchema.optional(),
    language: languageSchema.default("UZ"),
  }),
]);

export type PresentationInput = z.infer<typeof presentationInputSchema>;

export const presentationListQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "READY", "FAILED"]).optional(),
});

export type PresentationListQuery = z.infer<typeof presentationListQuerySchema>;

// ─── 2. AI qaytaradigan slaydlar strukturasi ─────────────────────────────────

/** Slayd turi — pptx qatlami har birini boshqacha chizadi. */
export const slideTypeSchema = z.enum(["title", "content", "summary"]);
export type SlideType = z.infer<typeof slideTypeSchema>;

/**
 * Bitta slayd.
 *
 * `bullets` chegaralari ataylab qattiq: slaydga sig'maydigan matn
 * prezentatsiyani ishlatib bo'lmaydigan qiladi. 220 belgi ≈ 2-3 qator.
 */
export const slideSchema = z.object({
  type: slideTypeSchema,
  heading: z
    .string()
    .trim()
    .min(2, "Slayd sarlavhasi juda qisqa")
    .max(120, "Slayd sarlavhasi slaydga sig'maydi"),
  /**
   * Sarlavha slaydida bandlar bo'lmasligi mumkin (bo'sh massiv) — shuning
   * uchun `min(0)`. Mazmun slaydlarida esa AI odatda 3-5 band beradi.
   */
  bullets: z
    .array(z.string().trim().min(1).max(220, "Band juda uzun — slaydga sig'maydi"))
    .max(8, "Bitta slaydda 8 dan ko'p band bo'lmasligi kerak"),
  /** So'zlovchi izohi — o'qituvchi uchun, slaydda ko'rinmaydi. */
  speakerNotes: z.string().trim().max(1500).optional(),
});

export type Slide = z.infer<typeof slideSchema>;

/** Slaydlar soni chegarasi — systemPromptda ham shu raqamlar aytiladi. */
export const MIN_SLIDES = 6;
export const MAX_SLIDES = 10;

export const presentationContentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Prezentatsiya sarlavhasi juda qisqa")
    .max(150, "Prezentatsiya sarlavhasi juda uzun"),
  slides: z
    .array(slideSchema)
    .min(MIN_SLIDES, `Kamida ${MIN_SLIDES} slayd bo'lishi kerak`)
    .max(MAX_SLIDES, `${MAX_SLIDES} dan ko'p slayd bo'lmasligi kerak`),
});

export type PresentationContent = z.infer<typeof presentationContentSchema>;

/**
 * Bazadagi `content` (Json) ustunini xavfsiz o'qiydi.
 *
 * Dars ishlanmasidagi `parseLessonPlanContent` bilan bir xil sabab: Json
 * ustun TypeScript uchun `unknown`, va sxema vaqt o'tib o'zgarishi mumkin.
 */
export function parsePresentationContent(value: unknown): PresentationContent | null {
  const parsed = presentationContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
