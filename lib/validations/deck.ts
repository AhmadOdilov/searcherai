import { z } from "zod";
import { languageSchema } from "@/lib/validations/common";
import { pptxTemplateSchema, slideLayoutSchema } from "@/lib/validations/presentation";

/**
 * PRESENTATION IR v2 — prezentatsiyaning YAGONA HAQIQAT MANBAI.
 *
 * ── Nega kerak bo'ldi ─────────────────────────────────────────────────────
 * `Presentation.content` renderlash uchun yetarli, lekin AI tahriri uchun
 * emas: unda slaydning BARQAROR identifikatori yo'q. "3-slaydni qisqartir"
 * degan buyruqni bajarish uchun o'sha slaydni indeks bo'yicha emas, ID
 * bo'yicha topish kerak — indeks slayd qo'shilishi bilan siljiydi va
 * buyruq boshqa slaydga tushadi.
 *
 * Shuningdek `content` da generatsiya qarorlari (nega bu slayd bor, qanday
 * dalilga tayanadi, qanday vizual kerak) saqlanmaydi — ular `plan`
 * ustunida edi va uni HECH KIM O'QIMASDI.
 *
 * ── Bu bosqichda nima QILINMAYDI ──────────────────────────────────────────
 * AI Editor, Research va Visual Engine YOZILMAYDI. Bu yerda faqat
 * SHARTNOMA: `EvidenceItem` va `VisualSlot` sxemalari kelajakdagi
 * qatlamlar uchun joy ochib qo'yadi, lekin ularni to'ldiradigan kod
 * hozircha yo'q va bo'sh qiymatlar o'ylab topilmaydi.
 *
 * ── Bitta blok shartnomasi ────────────────────────────────────────────────
 * Blok turlari AYNAN shu faylda ta'riflanadi va `lib/presentations/blocks.ts`
 * tipni shu yerdan OLADI. Ikkinchi parallel model yaratilmaydi: bitta
 * shartnoma — preview, muharrir va `.pptx` renderer uchun.
 */

// ─── Bloklar ─────────────────────────────────────────────────────────────

const cardItemSchema = z.object({
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().max(160).optional(),
});

const stepItemSchema = z.object({
  label: z.string().trim().min(1).max(60),
  body: z.string().trim().max(140).optional(),
});

const comparisonColumnSchema = z.object({
  title: z.string().trim().min(1).max(60),
  items: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
});

const chartSeriesSchema = z.object({
  name: z.string().trim().min(1).max(40),
  values: z.array(z.number()).min(2).max(8),
});

/**
 * Slayd tanasidagi bitta blok.
 *
 * Ro'yxat `lib/validations/presentation.ts` dagi slayd maydonlari bilan
 * BIR XIL qamrovga ega — ya'ni IR eski yozuvdan hech narsani yo'qotmaydi.
 *
 * DIQQAT: `code` va `table` bloklari ATAYLAB YO'Q. Ularni sxemaga qo'shish
 * hech kim chiza olmaydigan mazmunni qonuniylashtirardi — aynan Phase 0
 * tuzatgan nuqson sinfi. Ular renderer bilan birga qo'shiladi.
 */
export const blockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("eyebrow"), text: z.string().trim().min(1).max(40) }),
  z.object({ kind: z.literal("keyMessage"), text: z.string().trim().min(1).max(200) }),
  z.object({
    kind: z.literal("bullets"),
    items: z.array(z.string().trim().min(1).max(220)).min(1).max(8),
  }),
  z.object({ kind: z.literal("cards"), items: z.array(cardItemSchema).min(2).max(4) }),
  z.object({
    kind: z.literal("steps"),
    items: z.array(stepItemSchema).min(3).max(6),
    /** `false` — faqat yorliqlar chiziladi (timeline maketi). */
    withBodies: z.boolean(),
  }),
  z.object({
    kind: z.literal("comparison"),
    left: comparisonColumnSchema,
    right: comparisonColumnSchema,
  }),
  z.object({
    kind: z.literal("statistic"),
    value: z.string().trim().min(1).max(16),
    caption: z.string().trim().min(1).max(160),
  }),
  z.object({
    kind: z.literal("chart"),
    chartKind: z.enum(["bar", "line", "pie", "doughnut"]),
    categories: z.array(z.string().trim().min(1).max(40)).min(2).max(8),
    series: z.array(chartSeriesSchema).min(1).max(3),
  }),
  z.object({
    kind: z.literal("quote"),
    text: z.string().trim().min(10).max(300),
    author: z.string().trim().max(80).optional(),
  }),
  z.object({ kind: z.literal("source"), text: z.string().trim().min(1).max(160) }),
]);

export type SlideBlock = z.infer<typeof blockSchema>;
export type BlockKind = SlideBlock["kind"];

// ─── Vizual ──────────────────────────────────────────────────────────────

/**
 * Yaratilgan tasvirga havola.
 *
 * Bu bosqichda tasvir provayderi YO'Q, shuning uchun amalda `asset` har
 * doim `null`. Sxema esa Phase 6 da joy qidirmaslik uchun oldindan
 * belgilangan.
 */
export const assetRefSchema = z.object({
  storageKey: z.string().trim().min(1).max(300),
  mimeType: z.string().trim().min(1).max(80),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Bir xil topshiriq — bir xil tasvir (kesh kaliti). */
  hash: z.string().trim().min(1).max(128),
});

export const visualSlotSchema = z.object({
  type: z.enum(["none", "diagram", "chart", "icon_grid", "image"]),
  /** Tasvir provayderiga beriladigan topshiriq. `none` bo'lsa bo'sh. */
  brief: z.string().trim().max(400),
  asset: assetRefSchema.nullable(),
  /** Nima uchun aynan shu tur tanlandi — diagnostika uchun. */
  rationale: z.string().trim().max(200),
});

export type VisualSlot = z.infer<typeof visualSlotSchema>;

// ─── Dalil ───────────────────────────────────────────────────────────────

/**
 * Bitta tekshirilgan da'vo.
 *
 * Research qatlami hali yozilmagan, ya'ni bu ro'yxat hozir har doim
 * BO'SH. Soxta dalil qo'shilmaydi: bo'sh ro'yxat "dalil yo'q" degani va
 * bu rost.
 */
export const evidenceItemSchema = z.object({
  id: z.string().trim().min(1).max(40),
  claim: z.string().trim().min(1).max(400),
  source: z.object({
    kind: z.enum(["curriculum", "web", "lesson-plan"]),
    label: z.string().trim().min(1).max(200),
    url: z.url().optional(),
    publishedAt: z.string().trim().max(40).optional(),
    retrievedAt: z.string().trim().min(1).max(40),
  }),
  confidence: z.number().min(0).max(1),
});

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

// ─── So'rov shartnomasi ──────────────────────────────────────────────────

export const audienceSchema = z.enum([
  "students",
  "teachers",
  "investors",
  "executives",
  "general",
]);

export const goalSchema = z.enum(["teach", "persuade", "inform", "report"]);

/**
 * Foydalanuvchi so'rovi — generatsiya qarorlarining manbai.
 *
 * Qiymatlar `lib/presentations/brief.ts` dagi brif bilan bir xil: IR
 * "nega bu deck shunday chiqdi" degan savolga javob saqlaydi, ya'ni
 * qayta generatsiya va kelajakdagi AI tahriri bir xil kontekstni ko'radi.
 */
export const intakeSpecSchema = z.object({
  topic: z.string().trim().min(1).max(500),
  subject: z.string().trim().max(120).optional(),
  grade: z.string().trim().max(60).optional(),

  audience: audienceSchema,
  audienceAge: z.number().int().min(4).max(25).optional(),

  goal: goalSchema,

  slideCount: z.object({
    value: z.number().int().min(1).max(30),
    source: z.enum(["explicit", "structure", "scope"]),
  }),

  durationMinutes: z.number().int().positive().max(600).optional(),
  tone: z.string().trim().max(80).optional(),
  visualPreference: z.string().trim().max(80).optional(),
});

export type IntakeSpec = z.infer<typeof intakeSpecSchema>;

// ─── Ko'rinish ───────────────────────────────────────────────────────────

/**
 * Deck ko'rinishi.
 *
 * Hozircha faqat shablon nomi — u `Presentation.template` ustunida ham
 * turadi. IR ichida saqlanishi kerak, chunki kelajakdagi `deck.retheme`
 * amali aynan shu maydonni o'zgartiradi.
 */
export const themeRefSchema = z.object({
  template: pptxTemplateSchema,
});

export type ThemeRef = z.infer<typeof themeRefSchema>;

// ─── Slayd ───────────────────────────────────────────────────────────────

export const irSlideSchema = z.object({
  /**
   * BARQAROR identifikator.
   *
   * AI Editor "3-slaydni qisqartir" buyrug'ini aynan shu ID bo'yicha
   * bajaradi. Indeksga asoslangan identifikatsiya yaroqsiz: slayd
   * qo'shilishi bilan indeks siljiydi va buyruq boshqa slaydga tushadi.
   */
  id: z.string().trim().min(1).max(64),

  /** Hikoyadagi bosqich kaliti — `lib/presentations/storyline.ts`. */
  beatKey: z.string().trim().max(60),

  /** Slayd NIMA UCHUN bor — inson o'qiydigan matn. */
  purpose: z.string().trim().max(200),

  /**
   * Slayd sarlavhasi.
   *
   * ── Nega blok emas, alohida maydon ─────────────────────────────────
   * Sarlavha tanadagi bloklar bilan bir qatorda turmaydi: uning o'rni
   * qat'iy (yuqorida), o'lchami maketga bog'liq va `quote` maketi uni
   * umuman chizmaydi. Uni blok qilish tartib va joylashuv qoidalarini
   * chalkashtirardi.
   */
  heading: z.string().trim().min(1).max(120),

  layout: slideLayoutSchema,

  blocks: z.array(blockSchema).max(12),

  /** Vizual topshiriq. `null` — bu slaydga tasvir kerak emas. */
  visual: visualSlotSchema.nullable(),

  /** `Deck.evidence` dagi elementlarning id'lari. */
  evidenceRefs: z.array(z.string().trim().min(1).max(40)).max(20),

  /** So'zlovchi izohi — slaydda ko'rinmaydi. */
  notes: z.string().trim().max(1500).optional(),

  hidden: z.boolean().optional(),
});

export type IrSlide = z.infer<typeof irSlideSchema>;

// ─── Deck ────────────────────────────────────────────────────────────────

export const IR_VERSION = 2;

export const deckSchema = z.object({
  irVersion: z.literal(IR_VERSION),
  title: z.string().trim().min(1).max(150),
  language: languageSchema,
  theme: themeRefSchema,
  spec: intakeSpecSchema,
  evidence: z.array(evidenceItemSchema).max(200),
  slides: z.array(irSlideSchema).min(1).max(30),

  /**
   * Optimistik qulf.
   *
   * Yangi deck — 1. Har bir SAQLANGAN o'zgarishda bittaga oshadi.
   * AI Editor kelganda u eski raqam bilan yozishga urinsa, yozuv rad
   * etiladi — ikki tahrir bir-birini jim bosib ketmasin.
   */
  revision: z.number().int().min(1),
});

export type Deck = z.infer<typeof deckSchema>;

/**
 * Bazadagi `ir` (Json) ustunini xavfsiz o'qiydi.
 *
 * Json ustun TypeScript uchun `unknown` va sxema vaqt o'tib o'zgarishi
 * mumkin. Buzuq yoki eski versiyali yozuv `null` qaytaradi va
 * chaqiruvchi legacy yo'lga tushadi — ilova qulab tushmaydi.
 */
export function parseDeck(value: unknown): Deck | null {
  const parsed = deckSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// ─── Tahrir amallari (FAQAT SHARTNOMA) ───────────────────────────────────

/**
 * AI Editor kelajakda shu amallarni qaytaradi.
 *
 * ── Bu bosqichda IMPLEMENTATSIYA YO'Q ─────────────────────────────────────
 * LLM chaqiruvi ham, API yo'nalishi ham, UI ham yozilmagan. Sxema
 * oldindan belgilanadi, chunki u IR shaklini belgilaydi: aynan shu
 * amallar bajarilishi uchun slaydda barqaror `id`, deckda esa
 * `revision` bo'lishi kerak.
 *
 * Amallar TEKSHIRILADIGAN bo'lishi shart: model erkin matn emas, shu
 * ro'yxatdagi tuzilmani qaytaradi va u sxemadan o'tmasa rad etiladi.
 */
export const editOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("slide.update"),
    slideId: z.string().trim().min(1),
    heading: z.string().trim().min(1).max(120).optional(),
    blocks: z.array(blockSchema).max(12).optional(),
  }),
  z.object({
    op: z.literal("slide.insert"),
    /** `null` — eng boshiga qo'yiladi. */
    afterSlideId: z.string().trim().min(1).nullable(),
    slide: irSlideSchema,
  }),
  z.object({ op: z.literal("slide.delete"), slideId: z.string().trim().min(1) }),
  z.object({
    op: z.literal("slide.move"),
    slideId: z.string().trim().min(1),
    toIndex: z.number().int().min(0),
  }),
  z.object({
    op: z.literal("block.replace"),
    slideId: z.string().trim().min(1),
    blockIndex: z.number().int().min(0),
    block: blockSchema,
  }),
  z.object({
    op: z.literal("visual.request"),
    slideId: z.string().trim().min(1),
    brief: z.string().trim().min(1).max(400),
  }),
  z.object({ op: z.literal("deck.retheme"), theme: themeRefSchema }),
  z.object({
    op: z.literal("slide.simplify"),
    slideId: z.string().trim().min(1),
    targetAge: z.number().int().min(4).max(25),
  }),
]);

export type EditOp = z.infer<typeof editOpSchema>;

/** Bitta tahrir so'rovi — kelajakdagi `POST .../edit` tanasi. */
export const editRequestSchema = z.object({
  instruction: z.string().trim().min(3).max(500),
  baseRevision: z.number().int().min(1),
});

export type EditRequest = z.infer<typeof editRequestSchema>;
