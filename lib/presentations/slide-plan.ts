import type { PresentationBrief } from "@/lib/presentations/brief";
import { densityFor, type DensityLimits } from "@/lib/presentations/density";
import {
  slideTypeForBeat,
  type ContentType,
  type PlannedBeat,
} from "@/lib/presentations/storyline";
import { planVisual, type VisualPlan } from "@/lib/presentations/visual-plan";
import type { OutlineSlide } from "@/lib/validations/presentation-plan";
import type { SlideType } from "@/lib/validations/presentation";

/**
 * 2-BOSQICH: SLAYD REJASI.
 *
 * Skelet (AI) va hikoya rejasi (deterministik) birlashtiriladi va har
 * bir slayd uchun TO'LIQ topshiriq tuziladi: vazifasi, asosiy fikri,
 * mazmun shakli, zichlik chegaralari va vizual topshirig'i.
 *
 * ── Bu bosqichda AI CHAQIRILMAYDI ─────────────────────────────────────────
 * Hammasi qoidalar bilan hisoblanadi. Shuning uchun uni sinovda
 * to'liq tekshirish mumkin va natija takrorlanadi — Phase 2 ning
 * asosiy talabi ham shu edi.
 *
 * ── Nega AI tanlovi TEKSHIRILADI ──────────────────────────────────────────
 * AI mazmun shaklini o'zi tanlaydi (u mazmunni biladi), lekin tanlov
 * har doim ham bajarilishi mumkin emas:
 *   · manbasiz raqamli maketlar — taqiqlangan (o'ylab topilgan statistika);
 *   · ketma-ket uchta bir xil shakl — zerikarli;
 *   · muqova va yakun uchun ba'zi shakllar mos emas.
 * Shuning uchun tanlov shu yerda tekshiriladi va kerak bo'lsa
 * tuzatiladi.
 */

export interface SlideBlueprint {
  id: string;
  index: number;
  beatKey: string;
  purpose: string;
  slideType: SlideType;
  heading: string;
  keyMessage: string;
  contentType: ContentType;
  visual: VisualPlan;
  density: DensityLimits;
  /** AI tanlovi o'zgartirilgan bo'lsa — sababi. Diagnostika uchun. */
  adjustedFrom: ContentType | null;
}

/** Yakuniy slaydga mos kelmaydigan shakllar. */
const CLOSING_FORBIDDEN: ContentType[] = ["chart", "statistic", "quote", "comparison"];

/** Ketma-ketlik buzilganda tanlanadigan muqobillar. */
const ALTERNATIVES: Record<ContentType, ContentType[]> = {
  statement: ["bullets", "cards"],
  bullets: ["cards", "steps", "statement"],
  cards: ["bullets", "steps"],
  steps: ["cards", "bullets"],
  comparison: ["cards", "bullets"],
  statistic: ["statement", "bullets"],
  chart: ["bullets", "cards"],
  quote: ["statement", "bullets"],
};

export interface SlidePlanOptions {
  /**
   * Ruxsat etilgan mazmun shakllari.
   *
   * Ro'yxatda `statistic` va `chart` yo'q bo'lsa — dalil manbasi yo'q
   * degani. Bu holatda AI raqam so'rasa ham bermaymiz.
   */
  allowed: ReadonlySet<ContentType>;
}

/**
 * Skelet + hikoya → slayd rejasi.
 *
 * `outline` uzunligi `beats` uzunligiga TENG bo'lishi kutiladi (sxema
 * buni tekshiradi). Farq bo'lsa hikoya rejasi ustun turadi: slaydlar
 * soni foydalanuvchi talabidan kelib chiqqan va u buzilmasligi kerak.
 */
export function buildSlidePlan(
  brief: PresentationBrief,
  beats: PlannedBeat[],
  outline: OutlineSlide[],
  options: SlidePlanOptions,
): SlideBlueprint[] {
  const total = beats.length;

  /*
    Skeletni beat kaliti bo'yicha moslashtiramiz, TARTIB bo'yicha emas.
    Model ba'zan slaydlarni boshqa tartibda qaytaradi; kalit bo'yicha
    moslashtirish esa tartibni hikoya rejasidan oladi.

    Bir xil kalit bir necha marta bo'lishi mumkin (bo'lingan beat) —
    shuning uchun navbat: har bir kalit uchun keyingi ishlatilmagani
    olinadi.
  */
  const byKey = new Map<string, OutlineSlide[]>();
  for (const slide of outline) {
    const list = byKey.get(slide.beatKey) ?? [];
    list.push(slide);
    byKey.set(slide.beatKey, list);
  }
  const unmatched = [...outline];

  const blueprints: SlideBlueprint[] = [];

  for (const [index, beat] of beats.entries()) {
    const queue = byKey.get(beat.key);
    let matched = queue?.shift();

    if (matched) {
      const position = unmatched.indexOf(matched);
      if (position >= 0) unmatched.splice(position, 1);
    } else {
      /*
        Model bu beat uchun slayd qaytarmadi. Yozuvni tashlab ketish
        o'rniga moslashtirilmagan slaydlardan birinchisini olamiz —
        matn baribir mavzuga oid va bo'sh slayddan yaxshiroq.
      */
      matched = unmatched.shift();
    }

    const slideType = slideTypeForBeat(index, total);
    const isCover = index === 0;

    const requested = matched?.contentType ?? beat.suggested;
    const contentType = resolveContentType({
      requested,
      fallback: beat.suggested,
      slideType,
      isCover,
      previous: blueprints.at(-1)?.contentType ?? null,
      beforePrevious: blueprints.at(-2)?.contentType ?? null,
      allowed: options.allowed,
    });

    const heading = matched?.heading ?? beat.purpose;
    const keyMessage = matched?.keyMessage ?? "";

    blueprints.push({
      id: slideId(index, beat),
      index,
      beatKey: beat.key,
      purpose:
        beat.parts > 1 ? `${beat.purpose} (${beat.part}/${beat.parts})` : beat.purpose,
      slideType,
      heading,
      keyMessage,
      contentType,
      visual: planVisual({
        contentType,
        isCover,
        heading,
        keyMessage,
        purpose: beat.purpose,
        brief,
      }),
      density: densityFor(contentType, brief),
      adjustedFrom: contentType === requested ? null : requested,
    });
  }

  return blueprints;
}

/** Barqaror identifikator — indeks va hikoya bosqichidan. */
function slideId(index: number, beat: PlannedBeat): string {
  const suffix = beat.parts > 1 ? `-${beat.part}` : "";
  return `s${index + 1}-${beat.key}${suffix}`;
}

interface ResolveInput {
  requested: ContentType;
  fallback: ContentType;
  slideType: SlideType;
  isCover: boolean;
  previous: ContentType | null;
  beforePrevious: ContentType | null;
  allowed: ReadonlySet<ContentType>;
}

/**
 * Mazmun shaklini yakuniy tanlash.
 *
 * Tartib MUHIM — qattiq qoidalar oldin, did masalalari keyin:
 *   1. Muqova har doim bitta kuchli jumla.
 *   2. Ruxsat etilmagan shakl (manbasiz raqam) — almashtiriladi.
 *   3. Yakuniy slaydga mos kelmaydigan shakl — almashtiriladi.
 *   4. Ketma-ket uchinchi bir xil shakl — almashtiriladi.
 */
function resolveContentType(input: ResolveInput): ContentType {
  if (input.isCover) return "statement";

  let chosen = input.requested;

  if (!input.allowed.has(chosen)) {
    chosen = firstAllowed(
      [input.fallback, ...ALTERNATIVES[chosen]],
      input.allowed,
      "bullets",
    );
  }

  if (input.slideType === "summary" && CLOSING_FORBIDDEN.includes(chosen)) {
    chosen = firstAllowed([...ALTERNATIVES[chosen], "bullets"], input.allowed, "bullets");
  }

  /*
    Ketma-ket UCHTA bir xil shakl — bu yerda kesiladi. Ikkitasiga ruxsat
    beriladi: ikkita bandlar slaydi ketma-ket kelishi tabiiy va uni
    majburan o'zgartirish mazmunga zarar qilardi.
  */
  if (chosen === input.previous && chosen === input.beforePrevious) {
    const alternative = ALTERNATIVES[chosen].find(
      (candidate) => input.allowed.has(candidate) && candidate !== chosen,
    );
    if (alternative) chosen = alternative;
  }

  return chosen;
}

function firstAllowed(
  candidates: ContentType[],
  allowed: ReadonlySet<ContentType>,
  fallback: ContentType,
): ContentType {
  return candidates.find((candidate) => allowed.has(candidate)) ?? fallback;
}

/**
 * Qaysi mazmun shakllariga ruxsat berilishini hisoblaydi.
 *
 * ── Nega raqamli shakllar sukut bo'yicha TAQIQLANGAN ──────────────────────
 * `statistic` va `chart` maketlari SONLAR talab qiladi. Tadqiqot
 * provayderi ulanmagan va mavzu matnida ham raqam bo'lmasa, model
 * ularni O'YLAB TOPADI — "bozor hajmi 2.4 mlrd dollar" kabi. Slaydda
 * bunday raqam ishonchli ko'rinadi va o'qituvchi uni auditoriyaga
 * aytadi.
 *
 * Shuning uchun raqamli maketlar faqat raqamlar MANBASI bo'lganda
 * ochiladi: tadqiqot provayderi ulangan yoki foydalanuvchining o'zi
 * matnda raqam bergan.
 */
export function allowedContentTypes(options: {
  researchAvailable: boolean;
  sourceText: string;
}): Set<ContentType> {
  const base: ContentType[] = [
    "statement",
    "bullets",
    "cards",
    "steps",
    "comparison",
    "quote",
  ];

  if (options.researchAvailable || hasNumericEvidence(options.sourceText)) {
    base.push("statistic", "chart");
  }

  return new Set(base);
}

/**
 * Matnda o'lchovli raqam bormi.
 *
 * Yilning o'zi (2024) yetarli emas — u sana, ma'lumot emas. Foiz,
 * pul birligi, "mln"/"mlrd" kabi o'lchov yoki raqamlar ketma-ketligi
 * esa haqiqiy ma'lumotdan darak beradi.
 */
export function hasNumericEvidence(text: string): boolean {
  const normalized = text.toLowerCase();

  if (/\d+\s*(?:%|foiz|процент|percent)/.test(normalized)) return true;
  if (/\d+\s*(?:mln|mlrd|million|milliard|billion|млн|млрд|ming|тыс)/.test(normalized)) {
    return true;
  }
  if (/(?:\$|so'm|sum|usd|eur|руб)\s*\d/.test(normalized)) return true;
  if (/\d+\s*(?:\$|so'm|sum|usd|eur|руб)/.test(normalized)) return true;

  // Kamida uchta alohida son — bu allaqachon ma'lumot qatori.
  const numbers = normalized.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return numbers.length >= 3;
}
