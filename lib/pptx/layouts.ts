import PptxGenJS from "pptxgenjs";
import type { Slide } from "@/lib/validations/presentation";
import { ACCENT_BAR_WIDTH, FONT, MARGIN, SLIDE, type PptxPalette } from "./theme";

/**
 * MAZMUNGA MOS MAKETLAR — PowerPointda TAHRIRLANADIGAN obyektlar bilan.
 *
 * ── Nega alohida fayl ─────────────────────────────────────────────────────
 * `generate.ts` faylida ikkitagina chizish funksiyasi bor edi va u
 * butun renderer'ning imkoniyatini belgilardi. Yangi maketlarni o'sha
 * faylga qo'shish uni 800+ qatorlik aralashmaga aylantirardi.
 *
 * ── Har bir maket NATIVE obyekt chizadi ───────────────────────────────────
 * Rasm (screenshot) emas: matn — matn, shakl — shakl, diagramma —
 * `addChart` orqali haqiqiy chart obyekti. Foydalanuvchi PowerPointda
 * ochib, matnni ham, diagramma ma'lumotini ham o'zgartira oladi.
 */

type Target = ReturnType<PptxGenJS["addSlide"]>;

const CONTENT_WIDTH = SLIDE.width - MARGIN.x * 2;

/** Chap chetdagi rangli tasma (faqat "rangli" shablonda). */
function addAccentBar(target: Target, palette: PptxPalette): void {
  if (!palette.accentBar) return;
  target.addShape("rect", {
    x: 0,
    y: 0,
    w: ACCENT_BAR_WIDTH,
    h: SLIDE.height,
    fill: { color: palette.accentBar },
    line: { color: palette.accentBar, width: 0 },
  });
}

/** Yorliq + sarlavha + ajratuvchi chiziq — deyarli barcha maketlarda umumiy. */
function addHeader(
  target: Target,
  palette: PptxPalette,
  slide: Slide,
  options: { compact?: boolean } = {},
): number {
  const top = MARGIN.top;
  let y = top;

  if (slide.eyebrow) {
    target.addText(slide.eyebrow.toUpperCase(), {
      x: MARGIN.x,
      y,
      w: CONTENT_WIDTH,
      h: 0.22,
      fontFace: FONT.family,
      fontSize: 11,
      bold: true,
      charSpacing: 1.6,
      color: palette.muted,
    });
    y += 0.28;
  }

  target.addText(clamp(slide.heading, 120), {
    x: MARGIN.x,
    y,
    w: CONTENT_WIDTH,
    h: options.compact ? 0.55 : 0.7,
    fontFace: FONT.family,
    fontSize: options.compact ? 22 : FONT.headingSize,
    bold: true,
    color: palette.heading,
    valign: "top",
  });
  y += options.compact ? 0.62 : 0.78;

  target.addShape("line", {
    x: MARGIN.x,
    y,
    w: 1.1,
    h: 0,
    line: { color: palette.rule, width: 2.5 },
  });

  return y + 0.28;
}

/** Slayd raqami va (bo'lsa) manba — pastki qator. */
function addFooter(
  target: Target,
  palette: PptxPalette,
  slide: Slide,
  position: number,
  total: number,
): void {
  const y = SLIDE.height - MARGIN.bottom;

  if (slide.source) {
    target.addText(`Manba: ${clamp(slide.source, 120)}`, {
      x: MARGIN.x,
      y,
      w: CONTENT_WIDTH - 1.2,
      h: 0.25,
      fontFace: FONT.family,
      fontSize: 9,
      italic: true,
      color: palette.muted,
    });
  }

  target.addText(`${position} / ${total}`, {
    x: SLIDE.width - MARGIN.x - 1.2,
    y,
    w: 1.2,
    h: 0.25,
    fontFace: FONT.family,
    fontSize: FONT.footerSize,
    color: palette.muted,
    align: "right",
  });
}

function clamp(text: string, limit: number): string {
  const trimmed = text.trim();
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit - 1).trimEnd()}…`;
}

function baseSlide(pptx: PptxGenJS, palette: PptxPalette): Target {
  const target = pptx.addSlide();
  target.background = { color: palette.background };
  addAccentBar(target, palette);
  return target;
}

/* ─────────────────────────────────────────────────────────────────────────
   STATEMENT — bitta kuchli fikr butun ekranda.
   ───────────────────────────────────────────────────────────────────────── */
export function addStatementSlide(
  pptx: PptxGenJS,
  palette: PptxPalette,
  slide: Slide,
  position: number,
  total: number,
): void {
  const target = baseSlide(pptx, palette);
  const y = addHeader(target, palette, slide);

  target.addText(clamp(slide.keyMessage ?? slide.heading, 200), {
    x: MARGIN.x,
    y: y + 0.35,
    w: CONTENT_WIDTH,
    h: 1.9,
    fontFace: FONT.family,
    fontSize: 30,
    bold: true,
    color: palette.heading,
    valign: "top",
  });

  addFooter(target, palette, slide, position, total);
}

/* ─────────────────────────────────────────────────────────────────────────
   STATISTIC — bitta katta raqam va uning izohi.
   ───────────────────────────────────────────────────────────────────────── */
export function addStatisticSlide(
  pptx: PptxGenJS,
  palette: PptxPalette,
  slide: Slide,
  position: number,
  total: number,
): void {
  const target = baseSlide(pptx, palette);
  const y = addHeader(target, palette, slide);
  const stat = slide.statistic;
  if (!stat) return;

  /*
    Raqam shrifti uzunlikka qarab tushadi: "78%" va "1 250 000" bir xil
    o'lchamda berilsa, ikkinchisi slayddan chiqib ketadi.
  */
  const size = stat.value.length <= 4 ? 96 : stat.value.length <= 7 ? 72 : 54;

  target.addText(stat.value, {
    x: MARGIN.x,
    y: y + 0.25,
    w: CONTENT_WIDTH,
    h: 1.5,
    fontFace: FONT.family,
    fontSize: size,
    bold: true,
    color: palette.heading,
    align: "center",
    valign: "middle",
  });

  target.addText(clamp(stat.caption, 160), {
    x: MARGIN.x + 0.8,
    y: y + 1.85,
    w: CONTENT_WIDTH - 1.6,
    h: 0.75,
    fontFace: FONT.family,
    fontSize: 18,
    color: palette.body,
    align: "center",
    valign: "top",
  });

  addFooter(target, palette, slide, position, total);
}

/* ─────────────────────────────────────────────────────────────────────────
   KARTALAR — 2, 3 yoki 4 ustun.
   ───────────────────────────────────────────────────────────────────────── */
export function addCardsSlide(
  pptx: PptxGenJS,
  palette: PptxPalette,
  slide: Slide,
  position: number,
  total: number,
): void {
  const target = baseSlide(pptx, palette);
  const y = addHeader(target, palette, slide);
  const cards = slide.cards ?? [];
  if (cards.length === 0) return;

  const gap = 0.24;
  const cardWidth = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 2.5;
  const cardTop = y + 0.2;

  cards.forEach((card, index) => {
    const x = MARGIN.x + index * (cardWidth + gap);

    target.addShape("roundRect", {
      x,
      y: cardTop,
      w: cardWidth,
      h: cardHeight,
      rectRadius: 0.08,
      fill: { color: palette.cardFill },
      line: { color: palette.rule, width: 1 },
    });

    // Tartib raqami — ko'z uchun langar.
    target.addText(String(index + 1).padStart(2, "0"), {
      x: x + 0.22,
      y: cardTop + 0.18,
      w: cardWidth - 0.44,
      h: 0.3,
      fontFace: FONT.family,
      fontSize: 13,
      bold: true,
      color: palette.summary,
    });

    target.addText(clamp(card.title, 60), {
      x: x + 0.22,
      y: cardTop + 0.55,
      w: cardWidth - 0.44,
      h: 0.6,
      fontFace: FONT.family,
      fontSize: cards.length >= 4 ? 15 : 17,
      bold: true,
      color: palette.heading,
      valign: "top",
    });

    if (card.body) {
      target.addText(clamp(card.body, 160), {
        x: x + 0.22,
        y: cardTop + 1.18,
        w: cardWidth - 0.44,
        h: cardHeight - 1.38,
        fontFace: FONT.family,
        fontSize: cards.length >= 4 ? 11 : 13,
        color: palette.body,
        valign: "top",
      });
    }
  });

  addFooter(target, palette, slide, position, total);
}

/* ─────────────────────────────────────────────────────────────────────────
   TAQQOSLASH — ikki ustun.
   ───────────────────────────────────────────────────────────────────────── */
export function addComparisonSlide(
  pptx: PptxGenJS,
  palette: PptxPalette,
  slide: Slide,
  position: number,
  total: number,
): void {
  const target = baseSlide(pptx, palette);
  const y = addHeader(target, palette, slide);
  const cmp = slide.comparison;
  if (!cmp) return;

  const gap = 0.3;
  const colWidth = (CONTENT_WIDTH - gap) / 2;
  const colTop = y + 0.2;
  const colHeight = 2.55;

  const columns = [
    { title: cmp.leftTitle, items: cmp.leftItems, accent: palette.heading },
    { title: cmp.rightTitle, items: cmp.rightItems, accent: palette.summary },
  ];

  columns.forEach((col, index) => {
    const x = MARGIN.x + index * (colWidth + gap);

    target.addShape("roundRect", {
      x,
      y: colTop,
      w: colWidth,
      h: colHeight,
      rectRadius: 0.08,
      fill: { color: palette.cardFill },
      line: { color: palette.rule, width: 1 },
    });

    target.addShape("rect", {
      x,
      y: colTop,
      w: colWidth,
      h: 0.05,
      fill: { color: col.accent },
      line: { color: col.accent, width: 0 },
    });

    target.addText(clamp(col.title, 60), {
      x: x + 0.22,
      y: colTop + 0.25,
      w: colWidth - 0.44,
      h: 0.45,
      fontFace: FONT.family,
      fontSize: 17,
      bold: true,
      color: col.accent,
    });

    target.addText(
      col.items.slice(0, 5).map((item) => ({
        text: clamp(item, 120),
        options: { bullet: { characterCode: "2022" }, breakLine: true },
      })),
      {
        x: x + 0.22,
        y: colTop + 0.8,
        w: colWidth - 0.44,
        h: colHeight - 1.0,
        fontFace: FONT.family,
        fontSize: 13,
        color: palette.body,
        lineSpacingMultiple: 1.25,
        valign: "top",
      },
    );
  });

  addFooter(target, palette, slide, position, total);
}

/* ─────────────────────────────────────────────────────────────────────────
   TIMELINE / PROCESS — bosqichlar zanjiri.
   ───────────────────────────────────────────────────────────────────────── */
export function addStepsSlide(
  pptx: PptxGenJS,
  palette: PptxPalette,
  slide: Slide,
  position: number,
  total: number,
  withBodies: boolean,
): void {
  const target = baseSlide(pptx, palette);
  const y = addHeader(target, palette, slide);
  const steps = slide.steps ?? [];
  if (steps.length === 0) return;

  const gap = 0.18;
  const stepWidth = (CONTENT_WIDTH - gap * (steps.length - 1)) / steps.length;
  const lineY = y + 0.55;

  // Bosqichlarni bog'lovchi chiziq — zanjir hissi beradi.
  target.addShape("line", {
    x: MARGIN.x + stepWidth / 2,
    y: lineY,
    w: CONTENT_WIDTH - stepWidth,
    h: 0,
    line: { color: palette.rule, width: 2 },
  });

  steps.forEach((step, index) => {
    const x = MARGIN.x + index * (stepWidth + gap);
    const centerX = x + stepWidth / 2;

    target.addShape("ellipse", {
      x: centerX - 0.19,
      y: lineY - 0.19,
      w: 0.38,
      h: 0.38,
      fill: { color: palette.summary },
      line: { color: palette.summary, width: 0 },
    });

    target.addText(String(index + 1), {
      x: centerX - 0.19,
      y: lineY - 0.19,
      w: 0.38,
      h: 0.38,
      fontFace: FONT.family,
      fontSize: 13,
      bold: true,
      color: palette.titleText,
      align: "center",
      valign: "middle",
    });

    target.addText(clamp(step.label, 60), {
      x,
      y: lineY + 0.35,
      w: stepWidth,
      h: 0.55,
      fontFace: FONT.family,
      fontSize: steps.length >= 5 ? 12 : 14,
      bold: true,
      color: palette.heading,
      align: "center",
      valign: "top",
    });

    if (withBodies && step.body) {
      target.addText(clamp(step.body, 140), {
        x,
        y: lineY + 0.95,
        w: stepWidth,
        h: 1.3,
        fontFace: FONT.family,
        fontSize: steps.length >= 5 ? 10 : 11,
        color: palette.body,
        align: "center",
        valign: "top",
      });
    }
  });

  addFooter(target, palette, slide, position, total);
}

/* ─────────────────────────────────────────────────────────────────────────
   CHART — PowerPointda TAHRIRLANADIGAN native diagramma.
   ───────────────────────────────────────────────────────────────────────── */
export function addChartSlide(
  pptx: PptxGenJS,
  palette: PptxPalette,
  slide: Slide,
  position: number,
  total: number,
): void {
  const target = baseSlide(pptx, palette);
  const y = addHeader(target, palette, slide, { compact: true });
  const chart = slide.chart;
  if (!chart) return;

  const chartType =
    chart.kind === "line"
      ? pptx.ChartType.line
      : chart.kind === "pie"
        ? pptx.ChartType.pie
        : chart.kind === "doughnut"
          ? pptx.ChartType.doughnut
          : pptx.ChartType.bar;

  /*
    `addChart` haqiqiy chart obyektini quradi — rasm emas. Foydalanuvchi
    PowerPointda diagrammani bosib, ma'lumotini tahrirlashi mumkin.
  */
  target.addChart(
    chartType,
    chart.series.map((s) => ({
      name: s.name,
      labels: chart.categories,
      values: s.values,
    })),
    {
      x: MARGIN.x,
      y: y + 0.1,
      w: slide.keyMessage ? CONTENT_WIDTH * 0.62 : CONTENT_WIDTH,
      h: 2.75,
      chartColors: [palette.heading, palette.summary, palette.muted],
      showLegend:
        chart.series.length > 1 || chart.kind === "pie" || chart.kind === "doughnut",
      legendPos: "b",
      legendFontSize: 10,
      catAxisLabelFontSize: 10,
      valAxisLabelFontSize: 10,
      dataLabelFontSize: 10,
      showValue: chart.kind === "pie" || chart.kind === "doughnut",
    },
  );

  // Diagramma yonida asosiy fikr — "nima uchun bu muhim".
  if (slide.keyMessage) {
    target.addText(clamp(slide.keyMessage, 200), {
      x: MARGIN.x + CONTENT_WIDTH * 0.66,
      y: y + 0.35,
      w: CONTENT_WIDTH * 0.34,
      h: 2.2,
      fontFace: FONT.family,
      fontSize: 15,
      color: palette.body,
      valign: "top",
    });
  }

  addFooter(
    target,
    palette,
    { ...slide, source: slide.source ?? chart.source },
    position,
    total,
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   QUOTE — iqtibos.
   ───────────────────────────────────────────────────────────────────────── */
export function addQuoteSlide(
  pptx: PptxGenJS,
  palette: PptxPalette,
  slide: Slide,
  position: number,
  total: number,
): void {
  const target = baseSlide(pptx, palette);
  const quote = slide.quote;
  if (!quote) return;

  target.addText("“", {
    x: MARGIN.x,
    y: MARGIN.top + 0.1,
    w: 1,
    h: 0.9,
    fontFace: FONT.family,
    fontSize: 80,
    bold: true,
    color: palette.rule,
  });

  target.addText(clamp(quote.text, 300), {
    x: MARGIN.x + 0.5,
    y: MARGIN.top + 0.95,
    w: CONTENT_WIDTH - 1,
    h: 2.1,
    fontFace: FONT.family,
    fontSize: 24,
    italic: true,
    color: palette.heading,
    valign: "top",
  });

  if (quote.author) {
    target.addText(`— ${clamp(quote.author, 80)}`, {
      x: MARGIN.x + 0.5,
      y: MARGIN.top + 3.15,
      w: CONTENT_WIDTH - 1,
      h: 0.35,
      fontFace: FONT.family,
      fontSize: 14,
      color: palette.muted,
    });
  }

  addFooter(target, palette, slide, position, total);
}
