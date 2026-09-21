import type { Slide } from "@/lib/validations/presentation";
import { legacyLayoutFor } from "@/lib/presentations/layout-engine";

/**
 * SLAYD BLOKLARI — slaydda NIMA CHIZILISHINI aytadigan yagona ro'yxat.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * Slayd sxemasida o'n beshta maydon bor (`lib/validations/presentation.ts`),
 * `.pptx` renderer ularning barchasini chizadi, ekrandagi ko'rish rejimi esa
 * atigi ikkitasini bilardi: `heading` va `bullets`. Ya'ni kartali yoki
 * bosqichli slayd ekranda BO'SH ko'rinar, yuklab olingan faylda esa to'la
 * chiqardi.
 *
 * Muharrir ham xuddi shunday: u uchta maydonni tahrirlardi, qolganlari
 * ko'rinmas bo'lib yozuvda yotardi.
 *
 * ── Yechim ────────────────────────────────────────────────────────────────
 * "Bu slaydda nima chiziladi?" degan savolga javob BITTA joyda beriladi va
 * uni uchala iste'molchi ham o'qiydi:
 *
 *     blocksOf(slide)  →  preview (HTML)
 *                      →  muharrir (qaysi maydonlarni ko'rsatish)
 *                      →  .pptx renderer bilan solishtiriladigan shartnoma
 *
 * ── Nega MAKETGA bog'liq ──────────────────────────────────────────────────
 * Bir xil slayd maketga qarab boshqacha chiziladi: `bullets` maketida
 * `keyMessage` ko'rinmaydi (bandlar bo'lsa), `chart` maketida esa u
 * diagramma yonida turadi. Preview haqiqatga mos bo'lishi uchun ro'yxat
 * aynan renderer mantiqini takrorlashi kerak — aks holda "ekranda bir xil,
 * faylda boshqacha" muammosi shakl o'zgartirib qaytadi.
 *
 * Shu sababli `tests/preview-parity.test.ts` bu ro'yxatni HAQIQIY .pptx
 * chiqishi bilan solishtiradi.
 *
 * ── IR uchun tayyor ───────────────────────────────────────────────────────
 * Bloklar ro'yxati — kelajakdagi Presentation IR ning shakli. Hozir u
 * mavjud `Slide` yozuvidan keltirib chiqariladi; IR joriy etilganda faqat
 * shu funksiya o'rnini bosadi, iste'molchilar o'zgarmaydi.
 */

export interface CardBlockItem {
  title: string;
  body?: string;
}

export interface StepBlockItem {
  label: string;
  body?: string;
}

export interface ComparisonColumn {
  title: string;
  items: string[];
}

export interface ChartSeries {
  name: string;
  values: number[];
}

export type SlideBlock =
  /** Sarlavha ustidagi kichik yorliq. */
  | { kind: "eyebrow"; text: string }
  /** Slaydning yagona asosiy fikri — katta matn. */
  | { kind: "keyMessage"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "cards"; items: CardBlockItem[] }
  /** `withBodies: false` — faqat yorliqlar chiziladi (timeline). */
  | { kind: "steps"; items: StepBlockItem[]; withBodies: boolean }
  | { kind: "comparison"; left: ComparisonColumn; right: ComparisonColumn }
  | { kind: "statistic"; value: string; caption: string }
  | {
      kind: "chart";
      chartKind: "bar" | "line" | "pie" | "doughnut";
      categories: string[];
      series: ChartSeries[];
    }
  | { kind: "quote"; text: string; author?: string }
  /** Slayd pastidagi manba qatori. */
  | { kind: "source"; text: string };

export interface SlideView {
  /** Renderer ishlatadigan maket — yozuvdan yoki mazmundan. */
  layout: string;
  /**
   * Sarlavha CHIZILADIMI.
   *
   * `quote` maketi sarlavha chizmaydi: iqtibos butun slaydni egallaydi.
   * Preview buni yashirmasligi kerak — o'qituvchi sarlavhasi faylda
   * ko'rinmasligini BILIB turishi kerak.
   */
  showsHeading: boolean;
  heading: string;
  blocks: SlideBlock[];
}

function cleanBullets(bullets: string[]): string[] {
  return bullets.filter((bullet) => bullet.trim().length > 0);
}

/**
 * Bandsiz, lekin asosiy fikri bor slayd uchun zaxira.
 *
 * `addContentSlide` aynan shunday ishlaydi: band bo'lmasa `keyMessage`
 * band o'rnida chiziladi.
 */
function bulletsOrKeyMessage(slide: Slide): SlideBlock[] {
  const bullets = cleanBullets(slide.bullets);
  if (bullets.length > 0) return [{ kind: "bullets", items: bullets }];
  if (slide.keyMessage) return [{ kind: "bullets", items: [slide.keyMessage] }];
  return [];
}

/**
 * Maket kutgan mazmun yo'q bo'lganda chiziladigan zaxira.
 *
 * `lib/pptx/layouts.ts` dagi `addFallbackBody` bilan bir xil: asosiy fikr
 * va bandlar, boshqa hech narsa o'ylab topilmaydi.
 */
function fallbackBody(slide: Slide): SlideBlock[] {
  const items = [
    ...(slide.keyMessage ? [slide.keyMessage] : []),
    ...cleanBullets(slide.bullets),
  ];
  return items.length > 0 ? [{ kind: "bullets", items }] : [];
}

function sourceBlock(slide: Slide, fallback?: string): SlideBlock[] {
  const text = slide.source ?? fallback;
  return text ? [{ kind: "source", text }] : [];
}

function eyebrowBlock(slide: Slide): SlideBlock[] {
  return slide.eyebrow ? [{ kind: "eyebrow", text: slide.eyebrow }] : [];
}

/**
 * Slaydning ko'rinishini hisoblaydi.
 *
 * Mantiq `lib/pptx/generate.ts` va `lib/pptx/layouts.ts` ni takrorlaydi —
 * ikkisi ajralib ketmasligini parity sinovi qulflaydi.
 */
export function viewOf(slide: Slide): SlideView {
  const layout = slide.layout ?? legacyLayoutFor(slide);

  const base = { layout, showsHeading: true, heading: slide.heading };

  switch (layout) {
    case "cover": {
      /*
        Muqovada sarlavha ostidagi kichik matn: `keyMessage` ustun,
        bandlar zaxira (eski yozuvlarda fan/sinf aynan u yerda).
      */
      const subtitle =
        slide.keyMessage ?? cleanBullets(slide.bullets).slice(0, 3).join("  ·  ");
      return {
        ...base,
        blocks: [
          ...eyebrowBlock(slide),
          ...(subtitle.length > 0
            ? [{ kind: "keyMessage" as const, text: subtitle }]
            : []),
        ],
      };
    }

    case "statement":
      return {
        ...base,
        blocks: [
          ...eyebrowBlock(slide),
          { kind: "keyMessage", text: slide.keyMessage ?? slide.heading },
          ...sourceBlock(slide),
        ],
      };

    case "statistic":
      return {
        ...base,
        blocks: slide.statistic
          ? [
              ...eyebrowBlock(slide),
              {
                kind: "statistic",
                value: slide.statistic.value,
                caption: slide.statistic.caption,
              },
              ...sourceBlock(slide),
            ]
          : [...eyebrowBlock(slide), ...fallbackBody(slide), ...sourceBlock(slide)],
      };

    case "threeCards":
    case "fourCards":
      return {
        ...base,
        blocks:
          slide.cards && slide.cards.length > 0
            ? [
                ...eyebrowBlock(slide),
                { kind: "cards", items: slide.cards },
                ...sourceBlock(slide),
              ]
            : [...eyebrowBlock(slide), ...fallbackBody(slide), ...sourceBlock(slide)],
      };

    case "comparison":
      return {
        ...base,
        blocks: slide.comparison
          ? [
              ...eyebrowBlock(slide),
              {
                kind: "comparison",
                left: {
                  title: slide.comparison.leftTitle,
                  items: slide.comparison.leftItems.slice(0, 5),
                },
                right: {
                  title: slide.comparison.rightTitle,
                  items: slide.comparison.rightItems.slice(0, 5),
                },
              },
              ...sourceBlock(slide),
            ]
          : [...eyebrowBlock(slide), ...fallbackBody(slide), ...sourceBlock(slide)],
      };

    case "timeline":
    case "process":
      return {
        ...base,
        blocks:
          slide.steps && slide.steps.length > 0
            ? [
                ...eyebrowBlock(slide),
                { kind: "steps", items: slide.steps, withBodies: layout === "process" },
                ...sourceBlock(slide),
              ]
            : [...eyebrowBlock(slide), ...fallbackBody(slide), ...sourceBlock(slide)],
      };

    case "chart":
      return {
        ...base,
        blocks: slide.chart
          ? [
              ...eyebrowBlock(slide),
              {
                kind: "chart",
                chartKind: slide.chart.kind,
                categories: slide.chart.categories,
                series: slide.chart.series,
              },
              ...(slide.keyMessage
                ? [{ kind: "keyMessage" as const, text: slide.keyMessage }]
                : []),
              ...sourceBlock(slide, slide.chart.source),
            ]
          : [...eyebrowBlock(slide), ...fallbackBody(slide), ...sourceBlock(slide)],
      };

    case "quote":
      /*
        Iqtibos maketi SARLAVHA CHIZMAYDI — iqtibosning o'zi butun
        slaydni egallaydi (`lib/pptx/layouts.ts` → `addQuoteSlide`).
        Mazmun yo'q bo'lsa esa oddiy slaydga qaytadi.
      */
      return slide.quote
        ? {
            ...base,
            showsHeading: false,
            blocks: [
              { kind: "quote", text: slide.quote.text, author: slide.quote.author },
              ...sourceBlock(slide),
            ],
          }
        : {
            ...base,
            blocks: [
              ...eyebrowBlock(slide),
              ...fallbackBody(slide),
              ...sourceBlock(slide),
            ],
          };

    /*
      `bullets` va `conclusion` bitta chizuvchiga (`addContentSlide`)
      tushadi va u MANBANI chizmaydi — shuning uchun bu yerda ham yo'q.
    */
    case "bullets":
    case "conclusion":
    default:
      return {
        ...base,
        blocks: [...eyebrowBlock(slide), ...bulletsOrKeyMessage(slide)],
      };
  }
}

/** Faqat bloklar kerak bo'lganda — qisqa yo'l. */
export function blocksOf(slide: Slide): SlideBlock[] {
  return viewOf(slide).blocks;
}

/**
 * Blokdagi BARCHA matn bo'laklari — parity sinovi va qidiruv uchun.
 *
 * Diagramma matni slaydda emas, `ppt/charts/chartN.xml` da yashaydi,
 * shuning uchun u ATAYLAB qaytarilmaydi.
 */
export function textsOfBlock(block: SlideBlock): string[] {
  switch (block.kind) {
    case "eyebrow":
      return [block.text];
    case "keyMessage":
      return [block.text];
    case "bullets":
      return block.items;
    case "cards":
      return block.items.flatMap((card) => [
        card.title,
        ...(card.body ? [card.body] : []),
      ]);
    case "steps":
      return block.items.flatMap((step) => [
        step.label,
        ...(block.withBodies && step.body ? [step.body] : []),
      ]);
    case "comparison":
      return [
        block.left.title,
        ...block.left.items,
        block.right.title,
        ...block.right.items,
      ];
    case "statistic":
      return [block.value, block.caption];
    case "chart":
      return [];
    case "quote":
      return [block.text, ...(block.author ? [block.author] : [])];
    case "source":
      return [block.text];
  }
}

/** Slaydda ko'rinadigan barcha matn — sarlavha bilan birga. */
export function textsOf(slide: Slide): string[] {
  const view = viewOf(slide);
  return [
    ...(view.showsHeading ? [view.heading] : []),
    ...view.blocks.flatMap(textsOfBlock),
  ];
}
