import type { ContentType } from "@/lib/presentations/storyline";
import type { PresentationBrief } from "@/lib/presentations/brief";
import type { Slide } from "@/lib/validations/presentation";

/**
 * MAZMUN ZICHLIGI — slaydga nima SIG'ADI.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * AI'ga "qisqa yoz" deyish yetarli emas. Model ba'zan ikki qatorli
 * bandlar, ba'zan butun paragraf qaytaradi. Prezentatsiya sifatsiz
 * ko'rinishining eng keng tarqalgan sababi ham shu — slaydga maqola
 * ko'chirilgan.
 *
 * ── Yechim ────────────────────────────────────────────────────────────────
 * Ikki qatlam:
 *   1. Chegaralar PROMPTGA yoziladi — model to'g'ri o'lchamda yozishga
 *      harakat qiladi.
 *   2. Chegaralar javobga MAJBURAN qo'llaniladi (`compressSlide`) —
 *      model baribir oshirib yuborsa, matn qisqartiriladi.
 *
 * Faqat prompt yetarli emasligi Phase 1 da ko'rindi: chegaralar promptda
 * bor edi, lekin uzun bandlar baribir chiqardi.
 *
 * ── Nega chegara qat'iy raqam emas ────────────────────────────────────────
 * Bitta kuchli jumla (`statement`) uchun 120 belgi ko'p emas, lekin uch
 * ustunli kartada 120 belgi ustunni to'ldirib yuboradi. 12 yoshli
 * o'quvchi uchun ham, investor uchun ham bir xil zichlik noto'g'ri.
 * Shuning uchun chegaralar MAZMUN TURI va AUDITORIYAGA qarab hisoblanadi.
 */

export interface DensityLimits {
  maxHeadingChars: number;
  maxKeyMessageChars: number;
  maxBullets: number;
  maxBulletChars: number;
  maxCardBodyChars: number;
  maxStepBodyChars: number;
}

/*
  Asosiy chegaralar mazmun turiga qarab.

  Raqamlar 16:9 slaydda o'qiladigan shrift o'lchamidan kelib chiqqan:
  · sarlavha  — 28-32pt, bir qatorga ~45 belgi sig'adi, ikki qator maqbul
  · band      — 16-18pt, bir qatorga ~70 belgi, ikki qatordan oshmasin
  · karta     — uch ustunda kenglik uch baravar kichik
*/
const BASE_LIMITS: Record<ContentType, DensityLimits> = {
  statement: {
    maxHeadingChars: 70,
    maxKeyMessageChars: 140,
    maxBullets: 0,
    maxBulletChars: 0,
    maxCardBodyChars: 0,
    maxStepBodyChars: 0,
  },
  bullets: {
    maxHeadingChars: 70,
    maxKeyMessageChars: 110,
    maxBullets: 5,
    maxBulletChars: 110,
    maxCardBodyChars: 0,
    maxStepBodyChars: 0,
  },
  cards: {
    maxHeadingChars: 70,
    maxKeyMessageChars: 100,
    maxBullets: 0,
    maxBulletChars: 0,
    maxCardBodyChars: 110,
    maxStepBodyChars: 0,
  },
  steps: {
    maxHeadingChars: 70,
    maxKeyMessageChars: 100,
    maxBullets: 0,
    maxBulletChars: 0,
    maxCardBodyChars: 0,
    maxStepBodyChars: 90,
  },
  comparison: {
    maxHeadingChars: 70,
    maxKeyMessageChars: 100,
    maxBullets: 0,
    maxBulletChars: 90,
    maxCardBodyChars: 0,
    maxStepBodyChars: 0,
  },
  statistic: {
    maxHeadingChars: 60,
    maxKeyMessageChars: 120,
    maxBullets: 0,
    maxBulletChars: 0,
    maxCardBodyChars: 0,
    maxStepBodyChars: 0,
  },
  chart: {
    maxHeadingChars: 60,
    maxKeyMessageChars: 110,
    maxBullets: 0,
    maxBulletChars: 0,
    maxCardBodyChars: 0,
    maxStepBodyChars: 0,
  },
  quote: {
    maxHeadingChars: 60,
    maxKeyMessageChars: 0,
    maxBullets: 0,
    maxBulletChars: 0,
    maxCardBodyChars: 0,
    maxStepBodyChars: 0,
  },
};

/**
 * Yosh auditoriya uchun ko'paytirgich.
 *
 * 12 yoshli o'quvchi ekrandagi beshta ikki qatorli bandni o'qib
 * ulgurmaydi — u o'qituvchini tinglashi kerak, ekranni emas. Shuning
 * uchun yosh kichik bo'lsa matn qisqaradi va bandlar soni kamayadi.
 */
function ageScale(age: number | null): { text: number; bullets: number } {
  if (age === null) return { text: 1, bullets: 1 };
  if (age <= 10) return { text: 0.65, bullets: 0.6 };
  if (age <= 13) return { text: 0.8, bullets: 0.8 };
  if (age <= 16) return { text: 0.9, bullets: 1 };
  return { text: 1, bullets: 1 };
}

/** Mazmun turi va brifga qarab chegaralarni hisoblaydi. */
export function densityFor(
  contentType: ContentType,
  brief: Pick<PresentationBrief, "audienceAge" | "audience">,
): DensityLimits {
  const base = BASE_LIMITS[contentType];
  const scale = ageScale(brief.audienceAge);

  const scaleText = (value: number) =>
    value === 0 ? 0 : Math.max(40, Math.round(value * scale.text));

  return {
    maxHeadingChars: scaleText(base.maxHeadingChars),
    maxKeyMessageChars: scaleText(base.maxKeyMessageChars),
    maxBullets:
      base.maxBullets === 0
        ? 0
        : Math.max(3, Math.round(base.maxBullets * scale.bullets)),
    maxBulletChars: scaleText(base.maxBulletChars),
    maxCardBodyChars: scaleText(base.maxCardBodyChars),
    maxStepBodyChars: scaleText(base.maxStepBodyChars),
  };
}

/**
 * Matnni SO'Z CHEGARASIDA qisqartiradi.
 *
 * O'rtasidan kesilgan so'z ("fotosinte…") o'qilmaydi va slaydda nuqson
 * bo'lib ko'rinadi. Shuning uchun oxirgi to'liq so'zgacha qaytamiz.
 * Kesilgan matnga uch nuqta qo'yiladi — o'qituvchi nimadir tushib
 * qolganini ko'rsin va tahrirlay olsin.
 */
export function clampText(text: string, limit: number): string {
  const trimmed = text.trim();
  if (limit <= 0) return trimmed;
  if (trimmed.length <= limit) return trimmed;

  /*
    Uch nuqta uchun bitta belgi AJRATILADI — natija `limit` dan oshmasin.

    Bu jim buziladigan narsa edi: matn `limit` belgigacha kesilar,
    ustiga uch nuqta qo'shilardi va natija `limit + 1` bo'lib chiqardi.
    Karta sarlavhasi uchun sxema chegarasi aynan 60 va bitta ortiqcha
    belgi butun generatsiyani yiqitardi.
  */
  const room = limit - 1;
  const cut = trimmed.slice(0, room);
  const lastSpace = cut.lastIndexOf(" ");
  // So'z chegarasi juda oldinda bo'lsa (bitta uzun so'z) — shundayligicha.
  const base = lastSpace > room * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.–—-]+$/, "")}…`;
}

/**
 * Slaydni chegaralarga MAJBURAN moslaydi.
 *
 * ── Nega AI javobini rad etmaymiz ─────────────────────────────────────────
 * Rad etish = butun generatsiyani qaytadan boshlash = o'qituvchi yana
 * 30 soniya kutadi va yana pul sarflanadi, holbuki muammo bitta uzun
 * banddan iborat. Qisqartirish esa foydalanuvchi uchun ko'rinmas va
 * natija baribir to'g'ri.
 *
 * ── Nega slayd O'ZGARTIRILMAYDI ───────────────────────────────────────────
 * Yangi obyekt qaytariladi: chaqiruvchi asl AI javobini ham saqlab
 * qolishi mumkin (diagnostika uchun kerak bo'ladi).
 */
export function compressSlide(slide: Slide, limits: DensityLimits): Slide {
  const compressed: Slide = {
    ...slide,
    heading: clampText(slide.heading, limits.maxHeadingChars),
  };

  if (slide.keyMessage !== undefined && limits.maxKeyMessageChars > 0) {
    compressed.keyMessage = clampText(slide.keyMessage, limits.maxKeyMessageChars);
  }

  if (limits.maxBullets === 0) {
    compressed.bullets = [];
  } else {
    compressed.bullets = slide.bullets
      .slice(0, limits.maxBullets)
      .map((bullet) => clampText(bullet, limits.maxBulletChars))
      // Qisqartirish natijasida bo'shab qolgan band sxemadan o'tmaydi.
      .filter((bullet) => bullet.length > 1);
  }

  if (slide.cards) {
    compressed.cards = slide.cards.map((card) => ({
      title: clampText(card.title, 60),
      ...(card.body === undefined
        ? {}
        : { body: clampText(card.body, limits.maxCardBodyChars || 110) }),
    }));
  }

  if (slide.steps) {
    compressed.steps = slide.steps.map((step) => ({
      label: clampText(step.label, 60),
      ...(step.body === undefined
        ? {}
        : { body: clampText(step.body, limits.maxStepBodyChars || 90) }),
    }));
  }

  if (slide.comparison) {
    const itemLimit = limits.maxBulletChars || 90;
    compressed.comparison = {
      leftTitle: clampText(slide.comparison.leftTitle, 60),
      leftItems: slide.comparison.leftItems.map((item) => clampText(item, itemLimit)),
      rightTitle: clampText(slide.comparison.rightTitle, 60),
      rightItems: slide.comparison.rightItems.map((item) => clampText(item, itemLimit)),
    };
  }

  return compressed;
}
