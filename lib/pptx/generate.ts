import PptxGenJS from "pptxgenjs";
import {
  MAX_SLIDES,
  type PresentationContent,
  type Slide,
} from "@/lib/validations/presentation";
import { COLORS, FONT, MARGIN, SLIDE } from "@/lib/pptx/theme";

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
 */
export async function generatePptx(
  content: PresentationContent,
): Promise<GeneratePptxResult> {
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_16x9";
  pptx.title = content.title;
  pptx.author = "Searcher AI";
  pptx.company = "Searcher AI";

  // Juda ko'p slayd berilsa kesamiz — fayl ishlatib bo'lmaydigan
  // holga kelmasligi uchun.
  const slides = content.slides.slice(0, MAX_SLIDES);

  slides.forEach((slide, index) => {
    switch (slide.type) {
      case "title":
        addTitleSlide(pptx, slide, content.title);
        break;
      case "summary":
        addContentSlide(pptx, slide, index + 1, slides.length, true);
        break;
      default:
        addContentSlide(pptx, slide, index + 1, slides.length, false);
    }
  });

  // Hech bo'lmasa bitta slayd bo'lishi kerak — bo'sh .pptx ni ba'zi
  // dasturlar buzuq fayl deb hisoblaydi.
  if (slides.length === 0) {
    addTitleSlide(
      pptx,
      { type: "title", heading: content.title, bullets: [] },
      content.title,
    );
  }

  const output = await pptx.write({ outputType: "nodebuffer" });

  return {
    buffer: output as Buffer,
    slideCount: Math.max(slides.length, 1),
  };
}

/** Sarlavha slaydi — to'q fon, markazda katta matn. */
function addTitleSlide(pptx: PptxGenJS, slide: Slide, presentationTitle: string): void {
  const target = pptx.addSlide();
  target.background = { color: COLORS.primary };

  target.addText(clamp(slide.heading, 150), {
    x: MARGIN.x,
    y: 1.7,
    w: SLIDE.width - MARGIN.x * 2,
    h: 1.6,
    fontFace: FONT.family,
    fontSize: FONT.titleSize,
    bold: true,
    color: COLORS.onPrimary,
    align: "center",
    valign: "middle",
    // Uzun sarlavha chekkadan chiqib ketmasin.
    shrinkText: true,
  });

  // Bandlar bo'lsa — sarlavha ostida kichik matn (masalan fan, sinf).
  const subtitle = slide.bullets.slice(0, 3).join("  ·  ");
  if (subtitle.length > 0) {
    target.addText(clamp(subtitle, 200), {
      x: MARGIN.x,
      y: 3.4,
      w: SLIDE.width - MARGIN.x * 2,
      h: 0.8,
      fontFace: FONT.family,
      fontSize: FONT.subtitleSize,
      color: COLORS.rule,
      align: "center",
      valign: "top",
    });
  }

  if (slide.speakerNotes !== undefined) {
    target.addNotes(slide.speakerNotes);
  }

  // Sarlavha slaydida `presentationTitle` faqat metadata sifatida ishlatiladi
  // (fayl xossalarida) — slaydda `heading` ko'rinadi.
  void presentationTitle;
}

/** Mazmun va xulosa slaydi — yuqorida sarlavha, ostida bandlar. */
function addContentSlide(
  pptx: PptxGenJS,
  slide: Slide,
  position: number,
  total: number,
  isSummary: boolean,
): void {
  const target = pptx.addSlide();
  target.background = { color: COLORS.background };

  // Sarlavha
  target.addText(clamp(slide.heading, 120), {
    x: MARGIN.x,
    y: MARGIN.top,
    w: SLIDE.width - MARGIN.x * 2,
    h: 0.8,
    fontFace: FONT.family,
    fontSize: FONT.headingSize,
    bold: true,
    color: isSummary ? COLORS.primary : COLORS.heading,
    valign: "middle",
    shrinkText: true,
  });

  // Sarlavha ostidagi ajratuvchi chiziq
  target.addShape("line", {
    x: MARGIN.x,
    y: 1.32,
    w: SLIDE.width - MARGIN.x * 2,
    h: 0,
    line: { color: isSummary ? COLORS.primary : COLORS.rule, width: 1.5 },
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
        fontSize: FONT.bulletSize,
        color: COLORS.body,
        valign: "top",
        // Ko'p band bo'lsa shrift avtomatik kichrayadi.
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
    color: COLORS.muted,
    align: "right",
  });

  if (slide.speakerNotes !== undefined) {
    target.addNotes(slide.speakerNotes);
  }
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
