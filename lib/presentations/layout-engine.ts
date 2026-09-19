import type { Slide, SlideLayout } from "@/lib/validations/presentation";

/**
 * MAKET DVIGATELI — slayd mazmuniga qarab maket tanlaydi.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * V6 gacha renderer ikkitagina chizish funksiyasiga ega edi: sarlavha
 * slaydi va "sarlavha + bandlar" slaydi. Natijada 10 slaydli
 * prezentatsiyaning 9 tasi AYNAN bir xil ko'rinardi. Aynan shu narsa
 * "eski uslubdagi PowerPoint" taassurotini beradi.
 *
 * ── Nega maketni AI tanlamaydi ────────────────────────────────────────────
 * AI maket nomini o'zi aytsa, natija barqaror bo'lmaydi: bir xil so'rovda
 * turli maketlar chiqadi, mavjud bo'lmagan maket nomi kelishi mumkin va
 * uni tekshirish yana bir xato manbai bo'ladi.
 *
 * Shuning uchun AI MAZMUN beradi (kartalar, bosqichlar, raqam, chart),
 * maketni esa shu yerdagi deterministik qoidalar tanlaydi. Bir xil mazmun
 * har doim bir xil maketga tushadi va buni test bilan qulflash mumkin.
 *
 * ── Vizual ritm ───────────────────────────────────────────────────────────
 * Maket to'g'ri tanlangan bo'lsa ham, ketma-ket kelgan bir xil maketlar
 * prezentatsiyani zeriktiradi. Shuning uchun ikkinchi bosqichda ritm
 * tekshiriladi: uch marta ketma-ket bir xil maket bo'lsa, o'rtadagisi
 * mazmuni ruxsat bergan muqobilga almashtiriladi.
 */

/** Mazmun shakliga qarab maket tanlash (yakka slayd uchun). */
export function inferLayout(slide: Slide, index: number, total: number): SlideLayout {
  // AI yoki o'qituvchi maketni ochiq bergan bo'lsa — hurmat qilamiz.
  if (slide.layout) return slide.layout;

  /*
    Muqova va xulosani `type` BELGILAYDI, pozitsiya emas.

    Ilgari bu yerda `index === 0` sharti ham bor edi va u regressiya
    keltirib chiqardi: qisqa deckda (masalan ikkita slayd) mazmun slaydi
    birinchi o'rinda tursa, u muqovaga aylanib, bandlari sarlavha ostidagi
    kichik matnga aylanib qolardi. `tests/pptx-generate.test.ts` dagi
    uchta test aynan shuni tutdi.

    Pozitsiya faqat `type` hech narsa aytmaganda qo'shimcha ishora
    bo'lishi mumkin edi, lekin unga ehtiyoj yo'q: AI muqovani har doim
    `type: "title"` bilan, xulosani `type: "summary"` bilan beradi.
  */
  if (slide.type === "title") return "cover";
  if (slide.type === "summary") return "conclusion";
  void index;
  void total;

  /*
    Tartib MUHIM: eng aniq signal eng oldin tekshiriladi.
    Chart > statistika > taqqoslash > bosqichlar > kartalar > iqtibos.
  */
  if (slide.chart) return "chart";
  if (slide.statistic) return "statistic";
  if (slide.comparison) return "comparison";

  if (slide.steps && slide.steps.length > 0) {
    // Bosqichlarda tavsif bo'lsa — process, faqat yorliq bo'lsa — timeline.
    const hasBodies = slide.steps.some((s) => (s.body ?? "").length > 0);
    return hasBodies ? "process" : "timeline";
  }

  if (slide.cards && slide.cards.length > 0) {
    return slide.cards.length >= 4 ? "fourCards" : "threeCards";
  }

  if (slide.quote) return "quote";

  /*
    Bandsiz, lekin asosiy fikri bor slayd — bu "statement" slaydi:
    bitta kuchli jumla butun ekranni egallaydi.
  */
  if (slide.keyMessage && slide.bullets.length === 0) return "statement";

  return "bullets";
}

/** Maket mazmun bilan RENDER QILINADIGAN holatda mosmi. */
function layoutIsRenderable(slide: Slide, layout: SlideLayout): boolean {
  switch (layout) {
    case "chart":
      return Boolean(slide.chart);
    case "statistic":
      return Boolean(slide.statistic);
    case "comparison":
      return Boolean(slide.comparison);
    case "timeline":
    case "process":
      return Boolean(slide.steps && slide.steps.length >= 3);
    case "threeCards":
      return Boolean(slide.cards && slide.cards.length >= 2 && slide.cards.length <= 3);
    case "fourCards":
      return Boolean(slide.cards && slide.cards.length === 4);
    case "quote":
      return Boolean(slide.quote);
    case "statement":
      return Boolean(slide.keyMessage);
    case "bullets":
      return slide.bullets.length > 0 || Boolean(slide.keyMessage);
    case "cover":
    case "conclusion":
      return true;
  }
}

/**
 * Ketma-ket bir xil maketlarni kamaytirish.
 *
 * Faqat MAZMUN ruxsat bergan almashtirish qilinadi — maket mazmunsiz
 * qolib, bo'sh slayd chiqib ketmasligi kerak.
 */
function breakMonotony(slide: Slide, current: SlideLayout, previous: SlideLayout | null): SlideLayout {
  if (current !== previous) return current;

  // Muqova va xulosa takrorlanmaydi, ularga tegmaymiz.
  if (current === "cover" || current === "conclusion") return current;

  const alternatives: SlideLayout[] =
    current === "bullets"
      ? ["threeCards", "statement", "process"]
      : current === "threeCards"
        ? ["bullets", "process"]
        : current === "process"
          ? ["timeline", "bullets"]
          : current === "timeline"
            ? ["process", "bullets"]
            : ["bullets"];

  for (const candidate of alternatives) {
    if (layoutIsRenderable(slide, candidate)) return candidate;
  }
  return current;
}

/**
 * Butun prezentatsiya uchun maketlarni hisoblaydi.
 *
 * Natija — slaydlar bilan BIR XIL uzunlikdagi massiv. Slaydlar
 * o'zgartirilmaydi: renderer maketni shu yerdan oladi, shunda saqlangan
 * yozuv va chizish mantiqi bir-biriga bog'lanib qolmaydi.
 */
export function planLayouts(slides: Slide[]): SlideLayout[] {
  const planned: SlideLayout[] = [];
  let previous: SlideLayout | null = null;

  for (const [index, slide] of slides.entries()) {
    let layout = inferLayout(slide, index, slides.length);

    // Maket mazmunga mos kelmasa — xavfsiz zaxiraga tushamiz.
    if (!layoutIsRenderable(slide, layout)) {
      layout = slide.bullets.length > 0 || slide.keyMessage ? "bullets" : "statement";
      if (!layoutIsRenderable(slide, layout)) layout = "bullets";
    }

    layout = breakMonotony(slide, layout, previous);
    planned.push(layout);
    previous = layout;
  }

  return planned;
}

/** Prezentatsiyadagi maket xilma-xilligi (0..1) — QA uchun. */
export function layoutVariety(layouts: SlideLayout[]): number {
  if (layouts.length === 0) return 0;
  return new Set(layouts).size / layouts.length;
}
