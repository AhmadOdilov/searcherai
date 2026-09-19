import { z } from "zod";
import { CONTENT_TYPES, STORYLINE_ARCHETYPES } from "@/lib/presentations/storyline";
import { VISUAL_TYPES } from "@/lib/presentations/visual-plan";
import { slideLayoutSchema } from "@/lib/validations/presentation";

/**
 * Ko'p bosqichli generatsiyaning sxemalari.
 *
 * ── Nega alohida fayl ─────────────────────────────────────────────────────
 * `presentation.ts` SAQLANADIGAN mazmunni ta'riflaydi — u bazaga
 * yoziladi va o'qituvchi tahrirlaydi. Bu yerdagi sxemalar esa
 * GENERATSIYA ICHIDAGI oraliq shakllar: rejalashtiruvchi bosqichning
 * kirish-chiqishi. Ularni bir faylga qo'yish ikkisining umri va
 * o'zgarish sababini chalkashtirib yuborardi.
 *
 * DIQQAT: bu yerdagi xato xabarlari TARJIMA KALITI EMAS. Ular
 * `generateJson` orqali MODELGA qaytariladi — model kalitni emas,
 * tushunarli matnni o'qiydi.
 */

export const contentTypeSchema = z.enum(CONTENT_TYPES);
export const storylineArchetypeSchema = z.enum(STORYLINE_ARCHETYPES);
export const visualTypeSchema = z.enum(VISUAL_TYPES);

// ─── 1-BOSQICH: SKELET (AI javobi) ───────────────────────────────────────

/**
 * Skelet slaydi — AI birinchi chaqiruvda shuni qaytaradi.
 *
 * MATN YO'Q. Faqat slaydning VAZIFASI va bir jumlalik asosiy fikri.
 * Sabab: butun matnni bitta chaqiruvda so'rasak, model tuzilmani
 * o'ylashga ulgurmaydi va natija Phase 1 dagidek bog'lanmagan
 * slaydlar ro'yxati bo'lib qoladi.
 */
export const outlineSlideSchema = z.object({
  /** Qaysi hikoya bosqichiga tegishli — reja bilan solishtiriladi. */
  beatKey: z.string().trim().min(1, "beatKey bo'sh"),
  heading: z
    .string({ error: "Slayd sarlavhasi yozilmagan" })
    .trim()
    .min(2, "Slayd sarlavhasi juda qisqa")
    .max(120, "Slayd sarlavhasi slaydga sig'maydi"),
  /** Slaydning YAGONA asosiy fikri — bir jumla. */
  keyMessage: z
    .string({ error: "keyMessage yozilmagan" })
    .trim()
    .min(3, "keyMessage juda qisqa")
    .max(200, "keyMessage juda uzun — bir jumla yoz"),
  /** Mazmun qanday shaklda bo'lishi — maket shundan keltirib chiqariladi. */
  contentType: contentTypeSchema,
});

export const presentationOutlineSchema = z.object({
  title: z
    .string({ error: "Prezentatsiya sarlavhasi yozilmagan" })
    .trim()
    .min(3, "Prezentatsiya sarlavhasi juda qisqa")
    .max(150, "Prezentatsiya sarlavhasi juda uzun"),
  /**
   * AI tanlagan arxetip.
   *
   * Brif arxetipni ANIQ signal bilan aniqlagan bo'lsa bu qiymat
   * e'tiborga olinmaydi — "investorlar uchun" degan so'rovga boshqa
   * struktura berish so'rovni bajarmaslik bo'lardi.
   */
  archetype: storylineArchetypeSchema,
  slides: z.array(outlineSlideSchema).min(1, "Skelet bo'sh"),
});

export type PresentationOutline = z.infer<typeof presentationOutlineSchema>;
export type OutlineSlide = z.infer<typeof outlineSlideSchema>;

/**
 * Skelet uzunligini AYNAN tekshiradigan sxema.
 *
 * Son brifda hal qilingan. Model undan chetga chiqsa, `generateJson`
 * shu xabarni modelga qaytaradi va u ikkinchi urinishda to'g'rilaydi.
 */
export function outlineSchemaFor(slideCount: number) {
  return presentationOutlineSchema.superRefine((outline, ctx) => {
    if (outline.slides.length !== slideCount) {
      ctx.addIssue({
        code: "custom",
        path: ["slides"],
        message:
          `Skeletda ${outline.slides.length} ta slayd bor. ` +
          `AYNAN ${slideCount} ta slayd bo'lishi kerak — kam ham, ko'p ham emas.`,
      });
    }
  });
}

// ─── 2-BOSQICH: SLAYD SHARTNOMASI (deterministik) ────────────────────────

/**
 * SLAYD SHARTNOMASI.
 *
 * Renderer va keyingi bosqichlar (tasvir generatsiyasi, qayta
 * tahrirlash) aynan shu shaklni qabul qiladi. U yozuv bilan birga
 * saqlanadi, chunki:
 *   · maket qarori qayta hisoblanmasdan tiklanishi kerak;
 *   · vizual topshiriqlar Phase 6 da kerak bo'ladi;
 *   · "bu slayd nega bor?" degan savolga javob qoladi.
 */
export const plannedSlideSchema = z.object({
  /** Barqaror identifikator — indeksdan va hikoya bosqichidan. */
  id: z.string().trim().min(1),
  index: z.number().int().min(0),
  /** Hikoya bosqichining kaliti. */
  beatKey: z.string().trim().min(1),
  /** Slayd NIMA UCHUN bor — inson o'qiydigan matn. */
  purpose: z.string().trim().min(1).max(200),
  keyMessage: z.string().trim().max(200),
  /** Asosiy fikrni QO'LLAB-QUVVATLOVCHI fikrlar. */
  supportingPoints: z.array(z.string().trim().min(1).max(220)).max(8),
  contentType: contentTypeSchema,
  /**
   * Raqamli ma'lumot — FAQAT manbasi bo'lganda.
   *
   * Tadqiqot provayderi ulanmagan bo'lsa bu maydon har doim `null`.
   * Aks holda model bozor hajmi kabi raqamlarni o'ylab topardi.
   */
  data: z
    .object({
      kind: z.enum(["statistic", "chart"]),
      sourceLabel: z.string().trim().min(1).max(160),
    })
    .nullable(),
  /** Vizual g'oyaning bir jumlalik mohiyati. */
  visualConcept: z.string().trim().max(200),
  visualType: visualTypeSchema,
  /** Tasvir provayderiga beriladigan topshiriq. Tur `none` bo'lsa bo'sh. */
  visualBrief: z.string().trim().max(400),
  /** Deterministik tanlangan maket. */
  layoutType: slideLayoutSchema,
  /** Manba — faqat haqiqiy manba bo'lganda. */
  source: z.string().trim().max(160).nullable(),
});

export type PlannedSlide = z.infer<typeof plannedSlideSchema>;

export const presentationPlanSchema = z.object({
  archetype: storylineArchetypeSchema,
  slideCountSource: z.enum(["explicit", "structure", "scope"]),
  slides: z.array(plannedSlideSchema),
});

export type PresentationPlan = z.infer<typeof presentationPlanSchema>;
