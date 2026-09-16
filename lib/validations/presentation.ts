import { z } from "zod";
import { DEFAULT_TEMPLATE, TEMPLATE_NAMES } from "@/lib/pptx/theme";
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
/**
 * Slayd shabloni.
 *
 * Ro'yxat `lib/pptx/theme.ts` dan olinadi — shablon qo'shilganda
 * sxemani tahrirlash kerak emas va ikkisi bir-biridan ajralib
 * qolmaydi.
 *
 * `catch` ATAYLAB: eski brauzer sahifasidan notanish nom kelsa, butun
 * formani rad etgandan ko'ra standart shablon bilan yasab bergan
 * yaxshiroq — shablon natijaning mazmuniga ta'sir qilmaydi.
 */
export const pptxTemplateSchema = z
  .enum(TEMPLATE_NAMES)
  .default(DEFAULT_TEMPLATE)
  .catch(DEFAULT_TEMPLATE);

export const presentationInputSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({
      mode: z.literal("from-lesson-plan"),
      lessonPlanId: idSchema,
      template: pptxTemplateSchema,
    }),
    z.object({
      mode: z.literal("standalone"),
      topic: topicSchema,
      subject: subjectSchema.optional(),
      grade: gradeSchema.optional(),
      language: languageSchema.default("UZ"),
      template: pptxTemplateSchema,
    }),
  ],
  /*
    Diskriminator noto'g'ri bo'lsa — bu odatda eski brauzer sahifasi
    yoki buzilgan so'rov. Foydalanuvchiga zod'ning inglizcha matni emas,
    tarjima qilingan umumiy xabar ko'rsatiladi.
  */
  { error: "errors.validation.invalidValue" },
);

export type PresentationInput = z.infer<typeof presentationInputSchema>;

export const presentationListQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "READY", "FAILED"]).optional(),
});

export type PresentationListQuery = z.infer<typeof presentationListQuerySchema>;

// ─── 2. AI qaytaradigan slaydlar strukturasi ─────────────────────────────────
//
// DIQQAT: quyidagi xabarlar TARJIMA KALITI EMAS, tabiiy matn. Ular
// foydalanuvchiga ko'rsatilmaydi — `generateJson` ularni MODELGA qayta
// so'rov bilan yuboradi, model esa kalitni emas, tushunarli matnni o'qiydi.

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
  /*
    Xabarlar TABIIY MATN (tarjima kaliti emas) — bu sxemadan AI javobi
    ham, o'qituvchi tahriri ham o'tadi. Model kalitni tushunmaydi,
    shuning uchun matn har ikkala o'quvchi uchun tushunarli bo'lishi kerak.
  */
  type: z.enum(["title", "content", "summary"], {
    error: "Slayd turi noto'g'ri: title, content yoki summary bo'lishi kerak",
  }),
  heading: z
    .string({ error: "Slayd sarlavhasi yozilmagan" })
    .trim()
    .min(2, "Slayd sarlavhasi juda qisqa")
    .max(120, "Slayd sarlavhasi slaydga sig'maydi"),
  /**
   * Sarlavha slaydida bandlar bo'lmasligi mumkin (bo'sh massiv) — shuning
   * uchun `min(0)`. Mazmun slaydlarida esa AI odatda 3-5 band beradi.
   */
  bullets: z
    .array(
      z
        .string({ error: "Band matn bo'lishi kerak" })
        .trim()
        .min(1, "Bo'sh band bo'lmasin — uni o'chiring yoki matn yozing")
        .max(220, "Band juda uzun — slaydga sig'maydi"),
      { error: "Bandlar ro'yxati yozilmagan" },
    )
    .max(8, "Bitta slaydda 8 dan ko'p band bo'lmasligi kerak"),
  /** So'zlovchi izohi — o'qituvchi uchun, slaydda ko'rinmaydi. */
  speakerNotes: z.string().trim().max(1500).optional(),

  /**
   * Slayd faylga tushmaydi, lekin yozuvda SAQLANADI.
   *
   * ── Nega o'chirish emas, yashirish ────────────────────────────────────
   * O'qituvchi ko'pincha slaydni "hozircha kerak emas" deb chiqarib
   * tashlaydi, keyin fikridan qaytadi. O'chirilgan slaydni qaytarib
   * bo'lmaydi (bekor qilish tarixi yo'q), yashirilganini esa bir
   * bosishda tiklaydi.
   *
   * `optional()` — eski yozuvlarda bu maydon yo'q va ular baribir
   * o'qilishi kerak.
   */
  hidden: z.boolean().optional(),
});

export type Slide = z.infer<typeof slideSchema>;

/**
 * AI generatsiyasi uchun slaydlar soni — systemPromptda ham shu raqamlar
 * aytiladi.
 *
 * DIQQAT: bu chegara FAQAT AI javobiga tegishli. O'qituvchi keyin
 * tahrirlab slayd qo'shishi yoki o'chirishi mumkin — pastdagi
 * `EDIT_MIN_SLIDES` / `EDIT_MAX_SLIDES` ga qarang.
 */
export const MIN_SLIDES = 6;
export const MAX_SLIDES = 10;

/**
 * Tahrirlashdagi chegara — ancha keng.
 *
 * ── Nega ikki xil chegara ─────────────────────────────────────────────────
 * AI'dan 6-10 slayd so'raymiz, chunki "iloji boricha ko'p yoz" degan
 * ko'rsatma sifatsiz natija beradi va o'qituvchi 20 slaydni o'qib
 * chiqmaydi.
 *
 * Lekin O'QITUVCHI uchun bu chegara mantiqsiz: u ochiq darsga 14 slayd
 * tayyorlashi yoki qisqa mavzuni 4 slaydga sig'dirishi mumkin. Uning
 * tahririni "6 tadan kam bo'lmasin" deb rad etish — foydalanuvchini
 * o'z materialidan mahrum qilish.
 *
 * Yuqori chegara 30: bu texnik himoya (juda katta JSON generatsiyani
 * sekinlashtiradi va fayl hajmini shishiradi), mazmuniy qoida emas.
 */
export const EDIT_MIN_SLIDES = 1;
export const EDIT_MAX_SLIDES = 30;

/**
 * SAQLANGAN prezentatsiya mazmuni.
 *
 * Bu — bazadagi `content` ustunining shakli va tahrirlash chegarasi.
 * AI javobiga qo'yiladigan qat'iyroq qoida alohida:
 * `generatedPresentationContentSchema`.
 *
 * Xuddi shu naqsh dars ishlanmasi va kalendar rejada ham bor
 * (`lessonPlanContentSchemaFor`, `calendarPlanContentSchemaFor`):
 * asos sxema keng, generatsiya sxemasi tor.
 */
export const presentationContentSchema = z.object({
  title: z
    .string({ error: "Prezentatsiya sarlavhasi yozilmagan" })
    .trim()
    .min(3, "Prezentatsiya sarlavhasi juda qisqa")
    .max(150, "Prezentatsiya sarlavhasi juda uzun"),
  slides: z
    .array(slideSchema)
    .min(EDIT_MIN_SLIDES, "Kamida bitta slayd qolishi kerak")
    .max(EDIT_MAX_SLIDES, `${EDIT_MAX_SLIDES} tadan ko'p slayd bo'lmasligi kerak`),
});

export type PresentationContent = z.infer<typeof presentationContentSchema>;

/**
 * AI javobi uchun sxema — asos ustiga slaydlar soni qo'shiladi.
 *
 * Xato xabari MODELGA qayta so'rovda yuboriladi, shuning uchun u tabiiy
 * matn va nima qilish kerakligini aniq aytadi.
 */
export const generatedPresentationContentSchema = presentationContentSchema.superRefine(
  (content, ctx) => {
    if (content.slides.length < MIN_SLIDES || content.slides.length > MAX_SLIDES) {
      ctx.addIssue({
        code: "custom",
        path: ["slides"],
        message:
          `Prezentatsiyada ${content.slides.length} slayd bor. ` +
          `${MIN_SLIDES} dan ${MAX_SLIDES} gacha slayd yoz.`,
      });
    }
  },
);

/**
 * `PATCH /api/presentations/[id]` so'rovining tanasi.
 *
 * ── Nega `.strict()` ─────────────────────────────────────────────────────
 * Zod odatda notanish maydonlarni JIM tashlab yuboradi. Tahrirlashda esa
 * "jim" xatti-harakat noto'g'ri: klient `{ conten: {...} }` deb xato
 * yozsa, so'rov muvaffaqiyatli qaytardi va hech narsa o'zgarmasdi.
 * `.strict()` bunday so'rovni darhol rad etadi.
 *
 * ── Nega FAQAT yuqori darajada ───────────────────────────────────────────
 * Ichkaridagi slayd obyektlari `.strict()` EMAS va bu ataylab: o'sha
 * sxemadan AI javobi ham o'tadi. Model ba'zan qo'shimcha maydon
 * qo'shadi ("layout", "notes") va uni rad etsak — butun generatsiya
 * yiqilardi. Tashlab yuborilgani esa zararsiz: bazaga tushmaydi.
 */
export const presentationEditSchema = z
  .object({
    content: presentationContentSchema,
  })
  .strict();

export type PresentationEditInput = z.infer<typeof presentationEditSchema>;

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
