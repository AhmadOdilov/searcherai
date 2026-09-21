import { buildBrief } from "@/lib/presentations/brief";
import { viewOfLegacy } from "@/lib/presentations/blocks";
import {
  IR_VERSION,
  type Deck,
  type IntakeSpec,
  type IrSlide,
  type SlideBlock,
  type VisualSlot,
} from "@/lib/validations/deck";
import type { LanguageCode } from "@/lib/validations/common";
import type { PresentationContent, Slide } from "@/lib/validations/presentation";
import type { PresentationPlan } from "@/lib/validations/presentation-plan";
import { DEFAULT_TEMPLATE, type PptxTemplate } from "@/lib/pptx/theme";

/**
 * LEGACY ADAPTER — eski `content` yozuvini IR v2 Deck'iga aylantiradi.
 *
 * ── Nega majburiy migratsiya QILINMAYDI ───────────────────────────────────
 * Bazadagi yozuvlarni bir zarbda yangi shaklga ko'chirish — eng xavfli
 * variant: xato bo'lsa ma'lumot yo'qoladi va orqaga qaytish yo'li yo'q.
 *
 * Shuning uchun o'tish DANGASA (lazy):
 *
 *     ir !== null  →  o'sha ishlatiladi
 *     ir === null  →  content shu yerda Deck'ga aylantiriladi
 *
 * `content` va `plan` ustunlari O'CHIRILMAYDI. Adapter deterministik
 * bo'lgani uchun keyinchalik ommaviy migratsiya qilish mumkin, lekin
 * hozir shart emas.
 *
 * ── Determinizm SHART ─────────────────────────────────────────────────────
 * Bir xil kirish — bir xil Deck, har safar. Tasodifiy ID ishlatilmaydi:
 * slayd identifikatori pozitsiyadan keltirib chiqariladi (`slide-1`).
 * Aks holda har ochilishda yangi ID paydo bo'lar va kelajakdagi AI
 * tahriri "3-slayd" ni topa olmasdi.
 *
 * ── `plan` ustuni nihoyat O'QILADI ────────────────────────────────────────
 * `Presentation.plan` generatsiya qarorlarini saqlaydi (nega bu slayd bor,
 * qaysi vizual kerak), lekin uni hech kim o'qimasdi — yozuv-only ustun
 * edi. Adapter uni ixtiyoriy kirish sifatida qabul qiladi va IR'ni
 * boyitadi. Bo'lmasa, maydonlar bo'sh qoladi — o'ylab topilmaydi.
 */

/** Renderer bilan BIR XIL qisqartirish — `lib/pptx/generate.ts` dagi `clamp`. */
function clampLikeRenderer(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1).trimEnd()}…`;
}

export interface AdaptOptions {
  language: LanguageCode;
  template?: PptxTemplate | string;
  topic?: string;
  subject?: string | null;
  grade?: string | null;
  /** Generatsiya rejasi — bo'lsa IR boyitiladi. */
  plan?: PresentationPlan | null;
  /**
   * So'rov shartnomasi.
   *
   * Yangi generatsiyada u BRIFDAN keladi, ya'ni haqiqiy qaror saqlanadi.
   * Eski yozuvda brif yo'q va u `buildBrief` bilan qayta hisoblanadi —
   * o'sha deterministik mantiqning o'zi.
   */
  spec?: IntakeSpec;
  /** Mavjud deck'ning versiyasi. Yangi deck uchun 1. */
  revision?: number;
}

/**
 * Bitta eski slaydni IR slaydiga aylantiradi.
 *
 * Bloklar `viewOfLegacy` orqali olinadi — ya'ni AYNAN renderer chizadigan
 * narsa. Shu tufayli IR eski yozuvdan hech narsa qo'shmaydi va hech
 * narsa yo'qotmaydi.
 */
export function adaptLegacySlide(
  slide: Slide,
  index: number,
  plan?: PresentationPlan | null,
): IrSlide {
  const view = viewOfLegacy(slide);
  const planned = plan?.slides?.[index];

  /*
    Rejadagi vizual topshiriq saqlanadi, lekin `asset` har doim `null`:
    tasvir provayderi hali yo'q va bo'sh havola o'ylab topilmaydi.
  */
  const visual: VisualSlot | null =
    planned && planned.visualType !== "none"
      ? {
          type: planned.visualType === "generated_image" ? "image" : planned.visualType,
          brief: planned.visualBrief,
          asset: null,
          rationale: planned.visualConcept,
        }
      : null;

  return {
    id: slideIdFor(index),
    beatKey: planned?.beatKey ?? "",
    purpose: planned?.purpose ?? "",
    heading: slide.heading,
    layout: view.layout,
    blocks: clampBlocks(view.blocks),
    visual,
    evidenceRefs: [],
    ...(slide.speakerNotes === undefined ? {} : { notes: slide.speakerNotes }),
    ...(slide.hidden === undefined ? {} : { hidden: slide.hidden }),
  };
}

/**
 * Barqaror slayd identifikatori.
 *
 * Pozitsiyadan keltirib chiqariladi va bir xil `content` uchun har doim
 * bir xil bo'ladi. Slaydlar tartibi o'zgarsa ID ham o'zgaradi — bu
 * legacy yozuvning cheklovi: eski ma'lumotda barqaror identifikator
 * umuman yo'q edi. IR saqlangandan keyin ID yozuv bilan birga qotadi.
 */
export function slideIdFor(index: number): string {
  return `slide-${index + 1}`;
}

/**
 * Blok matnini IR sxemasi chegaralariga keltiradi.
 *
 * Yagona haqiqiy holat — muqova ostidagi matn: u bandlardan yig'iladi va
 * uzun bandlarda 200 belgidan oshib ketishi mumkin. Renderer uni
 * baribir qisqartiradi, ya'ni bu yerda ham qisqartirish FAYLDAGI
 * natijaga yaqinlashtiradi.
 */
function clampBlocks(blocks: SlideBlock[]): SlideBlock[] {
  return blocks.map((block) =>
    block.kind === "keyMessage"
      ? { ...block, text: clampLikeRenderer(block.text, 200) }
      : block,
  );
}

/**
 * Eski `content` ni to'liq Deck'ga aylantiradi.
 *
 * `spec` yozuvdan MA'LUM bo'lgan narsalardan tuziladi. Auditoriya va
 * maqsad `buildBrief` bilan hisoblanadi — u deterministik va
 * generatsiyada ishlatilgan mantiqning o'zi. Slaydlar soni esa
 * taxmin qilinmaydi: deckda nechta slayd bo'lsa, shuncha.
 */
export function adaptLegacyContent(
  content: PresentationContent,
  options: AdaptOptions,
): Deck {
  const topic = options.topic?.trim() || content.title;
  const spec = options.spec ?? deriveSpec(content, topic, options);

  return {
    irVersion: IR_VERSION,
    title: content.title,
    language: options.language,
    theme: { template: normalizeTemplate(options.template) },
    spec,
    // Research qatlami yo'q — dalil ro'yxati bo'sh va bu rost.
    evidence: [],
    slides: content.slides.map((slide, index) =>
      adaptLegacySlide(slide, index, options.plan),
    ),
    revision: options.revision ?? 1,
  };
}

/**
 * Eski yozuv uchun so'rov shartnomasini tiklaydi.
 *
 * Auditoriya va maqsad `buildBrief` bilan hisoblanadi — u deterministik
 * va generatsiyada ishlatilgan mantiqning O'ZI. Slaydlar soni esa
 * taxmin qilinmaydi: deckda nechta slayd bo'lsa, shuncha.
 */
function deriveSpec(
  content: PresentationContent,
  topic: string,
  options: AdaptOptions,
): IntakeSpec {
  const brief = buildBrief({
    topic,
    subject: options.subject ?? null,
    grade: options.grade ?? null,
    language: options.language,
  });

  return {
    topic: topic.slice(0, 500),
    ...(options.subject ? { subject: options.subject.slice(0, 120) } : {}),
    ...(options.grade ? { grade: options.grade.slice(0, 60) } : {}),
    audience: brief.audience,
    goal: brief.purpose,
    ...(brief.audienceAge === null ? {} : { audienceAge: brief.audienceAge }),
    /*
      Manba "structure": son taxmin qilinmagan, mavjud deckning
      tuzilmasidan olingan. "explicit" bo'lsa foydalanuvchi aytgan
      degani bo'lardi, buni esa eski yozuvdan bilib bo'lmaydi.
    */
    slideCount: { value: content.slides.length, source: "structure" },
  };
}

/** Notanish shablon nomi standartga tushadi — sxema uni rad etmasin. */
function normalizeTemplate(template: PptxTemplate | string | undefined): PptxTemplate {
  return (template as PptxTemplate) || DEFAULT_TEMPLATE;
}

/**
 * TESKARI yo'nalish: Deck → renderer kutadigan `content`.
 *
 * ── Nega kerak ────────────────────────────────────────────────────────────
 * `.pptx` renderer Phase 0 da tekshirilgan va uning chizuvchilari slayd
 * MAYDONLARI bilan ishlaydi. Uni bloklar ustida qayta yozish — alohida
 * ish va u render shartnomasini qaytadan isbotlashni talab qiladi.
 *
 * Shuning uchun Deck manba bo'lib qoladi, renderer esa o'zgarmaydi:
 * oqim `Deck → content → .pptx`. Bu ko'prik vaqtinchalik va u
 * `tests/presentation-ir.test.ts` da mazmun yo'qolmasligi bilan
 * qulflangan.
 */
export function deckToContent(deck: Deck): PresentationContent {
  return {
    title: deck.title,
    slides: deck.slides.map(slideFromIr),
  };
}

function slideFromIr(slide: IrSlide): Slide {
  const result: Slide = {
    /*
      `type` IR'da yo'q — u maketdan keltirib chiqariladi. Renderer
      maketni `slide.layout` dan o'qiydi, `type` esa faqat xulosa
      rangini belgilaydi (`lib/pptx/layouts.ts` → `addHeader`).
    */
    type:
      slide.layout === "cover"
        ? "title"
        : slide.layout === "conclusion"
          ? "summary"
          : "content",
    heading: slide.heading,
    bullets: [],
    layout: slide.layout,
    ...(slide.notes === undefined ? {} : { speakerNotes: slide.notes }),
    ...(slide.hidden === undefined ? {} : { hidden: slide.hidden }),
  };

  for (const block of slide.blocks) {
    switch (block.kind) {
      case "eyebrow":
        result.eyebrow = block.text;
        break;
      case "keyMessage":
        result.keyMessage = block.text;
        break;
      case "bullets":
        result.bullets = block.items;
        break;
      case "cards":
        result.cards = block.items;
        break;
      case "steps":
        result.steps = block.items;
        break;
      case "comparison":
        result.comparison = {
          leftTitle: block.left.title,
          leftItems: block.left.items,
          rightTitle: block.right.title,
          rightItems: block.right.items,
        };
        break;
      case "statistic":
        result.statistic = { value: block.value, caption: block.caption };
        break;
      case "chart":
        result.chart = {
          kind: block.chartKind,
          categories: block.categories,
          series: block.series,
        };
        break;
      case "quote":
        result.quote = {
          text: block.text,
          ...(block.author === undefined ? {} : { author: block.author }),
        };
        break;
      case "source":
        result.source = block.text;
        break;
    }
  }

  /*
    `bullets` maketida asosiy fikr band o'rnida chizilishi mumkin
    (`addContentSlide` zaxirasi). Bunday holatda IR'da u `bullets`
    bloki bo'lib turadi — uni `keyMessage` ga qaytarish shart emas,
    chunki renderer bandni baribir chizadi.
  */
  return result;
}

/**
 * Keyingi versiya raqami.
 *
 * Har bir SAQLANGAN o'zgarishda bittaga oshadi. AI Editor kelganda
 * eski raqam bilan yozishga urinish rad etiladi.
 */
export function nextRevision(deck: Deck): number {
  return deck.revision + 1;
}
