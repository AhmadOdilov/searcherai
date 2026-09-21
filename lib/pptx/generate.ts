import PptxGenJS from "pptxgenjs";
import {
  EDIT_MAX_SLIDES,
  type PresentationContent,
  type Slide,
} from "@/lib/validations/presentation";
import {
  ACCENT_BAR_WIDTH,
  DEFAULT_TEMPLATE,
  FONT,
  MARGIN,
  SLIDE,
  paletteOf,
  type PptxPalette,
  type PptxTemplate,
} from "@/lib/pptx/theme";
import { legacyLayoutFor } from "@/lib/presentations/layout-engine";
import {
  addCardsSlide,
  addChartSlide,
  addComparisonSlide,
  addQuoteSlide,
  addStatementSlide,
  addStatisticSlide,
  addStepsSlide,
} from "./layouts";

/**
 * .pptx generatsiya qatlami.
 *
 * ── Bu qatlam AI'dan MUSTAQIL ─────────────────────────────────────────────
 * Kirish — slaydlar JSON'i, chiqish — .pptx Buffer. Bazaga, sessiyaga,
 * AI'ga yoki muhit o'zgaruvchilariga BOG'LANMAGAN. Shu ajratish tufayli
 * uni sinovda hech narsa mock qilmasdan chaqirish mumkin, va aksincha —
 * fayl formatini o'zgartirganda AI qatlamiga tegish kerak emas.
 *
 * `server-only` belgisi YO'Q: bu qatlam brauzerda ham ishlashi mumkin
 * (pptxgenjs ikkisini ham qo'llab-quvvatlaydi) va sinovlar uni oddiy Node
 * jarayonida chaqiradi.
 */

export interface GeneratePptxResult {
  buffer: Buffer;
  slideCount: number;
}

/**
 * Bandlar ro'yxati juda uzun bo'lsa slaydga sig'maydi. Sxema 8 ta bandga
 * cheklaydi, lekin bu qatlam sxemadan MUSTAQIL ishlashi kerak — shuning
 * uchun o'z himoyasi bor.
 */
const MAX_BULLETS_PER_SLIDE = 8;

/** Bitta bandning maksimal uzunligi — undan keyin qisqartiriladi. */
const MAX_BULLET_CHARS = 300;

/**
 * Slaydlar JSON'idan .pptx fayl yasaydi.
 *
 * Chegaradan oshgan kirishni XATO QILMAYDI, balki xavfsiz qiymatga
 * keltiradi (slaydlarni kesadi, uzun matnni qisqartiradi). Sabab: bu qatlam
 * generatsiya oqimining OXIRIDA turadi — bu yerda yiqilish foydalanuvchi
 * uchun butun ishning bekor ketishini bildiradi, holbuki bir oz kesilgan
 * matn bilan ham yaroqli fayl chiqadi.
 *
 * `template` — foydalanuvchi tanlagan ko'rinish. Notanish nom (masalan
 * eski yozuvda saqlangan) standart shablonga tushadi; bu yerda ham
 * yiqilmaslik muhimroq.
 */
export async function generatePptx(
  content: PresentationContent,
  template: PptxTemplate | string = DEFAULT_TEMPLATE,
): Promise<GeneratePptxResult> {
  const pptx = new PptxGenJS();
  const palette = paletteOf(template);

  pptx.layout = "LAYOUT_16x9";
  pptx.title = content.title;
  pptx.author = "Searcher AI";
  pptx.company = "Searcher AI";

  /*
    ── Yashirilgan slaydlar faylga TUSHMAYDI ──────────────────────────────
    O'qituvchi slaydni "hozircha kerak emas" deb belgilashi mumkin.
    Yozuvda u saqlanadi (fikridan qaytsa — bir bosishda tiklaydi), lekin
    .pptx ga chiqmaydi.

    ── Nega chegara EDIT_MAX_SLIDES ───────────────────────────────────────
    Ilgari bu yerda `MAX_SLIDES` (10) turardi va u AI javobi uchun
    yetarli edi. Tahrirlash qo'shilgach chegara kengaydi: 14 slaydli
    ochiq dars tayyorlagan o'qituvchining oxirgi to'rtta slaydi JIM
    yo'qolib qolardi.

    Chegara baribir qoladi — bu qatlam sxemadan MUSTAQIL ishlashi va
    o'z himoyasiga ega bo'lishi kerak.
  */
  const slides = content.slides
    .filter((slide) => slide.hidden !== true)
    .slice(0, EDIT_MAX_SLIDES);

  /*
    ── MAKETNI RENDERER TANLAMAYDI ────────────────────────────────────────

    Maket quvurda (`lib/presentations/layout-engine.ts` →
    `layoutForContentType`) tanlanadi va yozuv bilan birga saqlanadi.
    Bu yerda u faqat O'QILADI.

    Ilgari bu yerda `planLayouts(slides)` turardi va u saqlangan qarorni
    QAYTA hisoblardi: qo'shni slaydlarning maketi bir xil bo'lsa,
    ikkinchisini "xilma-xillik uchun" boshqa maketga o'tkazardi.
    Almashtirish faqat yangi maketning chizilishi mumkinligini
    tekshirardi, mazmunning saqlanishini emas — natijada bandlar,
    kartalar va bosqichlar jimgina yo'qolardi (8 mavzuli o'lchovda
    68 slayddan 13 tasi).

    Maket YO'Q eski yozuvlar uchun `legacyLayoutFor` maketni mazmundan
    tiklaydi — u yerda tanlanadigan qaror umuman yo'q.
  */
  slides.forEach((slide, index) => {
    const position = index + 1;
    const layout = slide.layout ?? legacyLayoutFor(slide);

    switch (layout) {
      case "cover":
        addTitleSlide(pptx, palette, slide);
        break;
      case "conclusion":
        addContentSlide(pptx, palette, slide, position, slides.length, true);
        break;
      case "statement":
        addStatementSlide(pptx, palette, slide, position, slides.length);
        break;
      case "statistic":
        addStatisticSlide(pptx, palette, slide, position, slides.length);
        break;
      case "threeCards":
      case "fourCards":
        addCardsSlide(pptx, palette, slide, position, slides.length);
        break;
      case "comparison":
        addComparisonSlide(pptx, palette, slide, position, slides.length);
        break;
      case "timeline":
        addStepsSlide(pptx, palette, slide, position, slides.length, false);
        break;
      case "process":
        addStepsSlide(pptx, palette, slide, position, slides.length, true);
        break;
      case "chart":
        addChartSlide(pptx, palette, slide, position, slides.length);
        break;
      case "quote":
        addQuoteSlide(pptx, palette, slide, position, slides.length);
        break;
      case "bullets":
        addContentSlide(pptx, palette, slide, position, slides.length, false);
        break;
    }
  });

  // Hech bo'lmasa bitta slayd bo'lishi kerak — bo'sh .pptx ni ba'zi
  // dasturlar buzuq fayl deb hisoblaydi.
  if (slides.length === 0) {
    addTitleSlide(pptx, palette, {
      type: "title",
      heading: content.title,
      bullets: [],
    });
  }

  const output = await pptx.write({ outputType: "nodebuffer" });

  return {
    buffer: output as Buffer,
    slideCount: Math.max(slides.length, 1),
  };
}

/** Sarlavha slaydi — markazda katta matn. */
function addTitleSlide(pptx: PptxGenJS, palette: PptxPalette, slide: Slide): void {
  const target = pptx.addSlide();
  target.background = { color: palette.titleBackground };

  target.addText(clamp(slide.heading, 150), {
    x: MARGIN.x,
    y: 1.7,
    w: SLIDE.width - MARGIN.x * 2,
    h: 1.6,
    fontFace: FONT.family,
    fontSize: FONT.titleSize,
    bold: true,
    color: palette.titleText,
    align: "center",
    valign: "middle",
    // Uzun sarlavha chekkadan chiqib ketmasin.
    shrinkText: true,
  });

  /*
    Sarlavha ostidagi kichik matn.

    `keyMessage` USTUN turadi: V6 da muqova slaydi uchun asosiy fikr aynan
    shu maydonga yoziladi ("Investorlar uchun 2026-yil sharhi"). Faqat
    bandlarga qarab qolsak, u jimgina yo'qolardi — vizual tekshiruvda
    aynan shu holat aniqlandi.

    Bandlar zaxira bo'lib qoladi: eski yozuvlarda fan/sinf aynan shu
    yerda saqlangan.
  */
  const subtitle = slide.keyMessage ?? slide.bullets.slice(0, 3).join("  ·  ");
  if (subtitle.length > 0) {
    target.addText(clamp(subtitle, 200), {
      x: MARGIN.x,
      y: 3.4,
      w: SLIDE.width - MARGIN.x * 2,
      h: 0.8,
      fontFace: FONT.family,
      fontSize: FONT.subtitleSize,
      color: palette.titleSubtext,
      align: "center",
      valign: "top",
    });
  }

  if (slide.speakerNotes !== undefined) {
    target.addNotes(slide.speakerNotes);
  }
}

/** Mazmun va xulosa slaydi — yuqorida sarlavha, ostida bandlar. */
function addContentSlide(
  pptx: PptxGenJS,
  palette: PptxPalette,
  slide: Slide,
  position: number,
  total: number,
  isSummary: boolean,
): void {
  const target = pptx.addSlide();
  target.background = { color: palette.background };

  /*
    "Rangli" shablonning chap tasmasi — slaydning butun balandligi
    bo'ylab. Matn maydonlari `MARGIN.x` (0.6″) dan boshlanadi, tasma esa
    0.16″ — ular ustma-ust tushmaydi.
  */
  if (palette.accentBar !== null) {
    target.addShape("rect", {
      x: 0,
      y: 0,
      w: ACCENT_BAR_WIDTH,
      h: SLIDE.height,
      fill: { color: isSummary ? palette.summary : palette.accentBar },
      line: { color: isSummary ? palette.summary : palette.accentBar, width: 0 },
    });
  }

  // Sarlavha
  target.addText(clamp(slide.heading, 120), {
    x: MARGIN.x,
    y: MARGIN.top,
    w: SLIDE.width - MARGIN.x * 2,
    h: 0.8,
    fontFace: FONT.family,
    fontSize: FONT.headingSize,
    bold: true,
    color: isSummary ? palette.summary : palette.heading,
    valign: "middle",
    shrinkText: true,
  });

  // Sarlavha ostidagi ajratuvchi chiziq
  target.addShape("line", {
    x: MARGIN.x,
    y: 1.32,
    w: SLIDE.width - MARGIN.x * 2,
    h: 0,
    line: { color: isSummary ? palette.summary : palette.rule, width: 1.5 },
  });

  // Bandlar
  const bullets = slide.bullets
    .slice(0, MAX_BULLETS_PER_SLIDE)
    .filter((bullet) => bullet.trim().length > 0)
    .map((bullet) => clamp(bullet, MAX_BULLET_CHARS));

  if (bullets.length > 0) {
    target.addText(
      bullets.map((bullet) => ({
        text: bullet,
        options: {
          bullet: { code: "2022" },
          // Bandlar orasidagi bo'shliq — o'qish uchun.
          paraSpaceAfter: 8,
        },
      })),
      {
        x: MARGIN.x,
        y: 1.6,
        w: SLIDE.width - MARGIN.x * 2,
        h: SLIDE.height - 1.6 - MARGIN.bottom - 0.3,
        fontFace: FONT.family,
        fontSize: bulletFontSize(bullets),
        color: palette.body,
        valign: "top",
        // Hisob-kitob xato qilsa ham matn chekkadan chiqmasin.
        shrinkText: true,
      },
    );
  }

  // Pastda slayd raqami
  target.addText(`${position} / ${total}`, {
    x: SLIDE.width - MARGIN.x - 1,
    y: SLIDE.height - MARGIN.bottom - 0.05,
    w: 1,
    h: 0.3,
    fontFace: FONT.family,
    fontSize: FONT.footerSize,
    color: palette.muted,
    align: "right",
  });

  if (slide.speakerNotes !== undefined) {
    target.addNotes(slide.speakerNotes);
  }
}

/**
 * Bandlar shriftini matn hajmiga qarab tanlaydi.
 *
 * ── Nega faqat `shrinkText` yetarli emas ──────────────────────────────────
 * `shrinkText` PowerPoint'ning o'z xossasi: u matnni maydonga sig'dirish
 * uchun shriftni kichraytiradi, LEKIN buni PowerPoint ochilganda qiladi.
 * LibreOffice va Google Slides uni boshqacha hisoblaydi, telefondagi
 * ko'ruvchilar esa umuman e'tiborsiz qoldiradi — natijada o'qituvchi
 * darsga tayyorlagan slaydining pastki bandlari kesilib qolardi.
 *
 * Shuning uchun o'lcham FAYLGA YOZILADI: uchta pog'ona, matn hajmiga
 * qarab. `shrinkText` esa zaxira bo'lib qoladi.
 *
 * Pog'onalar 10×5.625″ slayd va 0.6″ chekka uchun hisoblangan: matn
 * maydoni ≈ 8.8 × 3.2″. 20pt Arial'da bir qator ≈ 95 belgi.
 */
export function bulletFontSize(bullets: string[]): number {
  const characters = bullets.reduce((sum, bullet) => sum + bullet.length, 0);

  // Har band kamida bitta qator egallaydi, uzunlari — bir nechta.
  const lines = bullets.reduce(
    (sum, bullet) => sum + Math.max(1, Math.ceil(bullet.length / 95)),
    0,
  );

  if (lines <= 6 && characters <= 420) return FONT.bulletSize;
  if (lines <= 9 && characters <= 760) return FONT.bulletSizeDense;
  return FONT.bulletSizeTight;
}

/**
 * Matnni belgilangan uzunlikka keltiradi.
 *
 * Kesilganini bildirish uchun "…" qo'shiladi — o'qituvchi matn to'liq
 * emasligini ko'rib, slaydni o'zi tuzatadi.
 */
function clamp(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1).trimEnd()}…`;
}
