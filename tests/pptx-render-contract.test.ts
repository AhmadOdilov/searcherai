import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { generatePptx } from "../lib/pptx/generate";
import type {
  PresentationContent,
  Slide,
  SlideLayout,
} from "../lib/validations/presentation";

/**
 * RENDER SHARTNOMASI — reja so'ragan mazmun FAYLGA TUSHDIMI?
 *
 * ── Nega bu fayl kerak bo'ldi ─────────────────────────────────────────────
 * Mavjud sinovlar ikki narsani tekshirardi: quvur qanday maket TANLAGANINI
 * (`presentation-layout-engine.test.ts`, `presentation-pipeline.test.ts`)
 * va faylning yaroqli ZIP ekanini (`pptx-generate.test.ts`). Ikkalasi
 * ham to'g'ri, lekin ORASIDAGI bo'shliqni hech kim qoplamasdi:
 *
 *     reja "kartalar" dedi  →  renderer boshqa maket tanladi  →  kartalar
 *     faylga umuman tushmadi  →  ikkala sinov ham YASHIL qoldi.
 *
 * Amalda aynan shu bo'ldi: `generatePptx` quvur hisoblagan `slide.layout`
 * ustidan `planLayouts()` ni qayta yugurtirardi va `breakMonotony`
 * qo'shni slaydlarning maketini almashtirardi. `statement` maketi esa
 * faqat `keyMessage` ni chizadi — bandlar, kartalar va bosqichlar
 * jimgina yo'qolardi.
 *
 * ── Shuning uchun bu yerda faqat OXIRGI ARTEFAKT tekshiriladi ─────────────
 * Reja obyekti emas, `.pptx` faylining o'zi: ZIP ochiladi,
 * `ppt/slides/slideN.xml` o'qiladi va har bir blokning O'ZIGA XOS matni
 * qidiriladi. "Fayl bor", "ZIP ochildi", "slayd soni to'g'ri" — bularning
 * hech biri muvaffaqiyat emas.
 *
 * Har bir slaydga ATAYLAB `keyMessage` ham qo'shiladi: agar renderer
 * maketni `statement` ga almashtirsa, faqat o'sha `keyMessage` chiziladi
 * va blok markerlari yo'qoladi — ya'ni sinov aynan o'sha regressiyani
 * tutadi.
 */

/** `ppt/slides/slideN.xml` — 1 dan boshlanadi. */
async function slideXml(buffer: Buffer, index: number): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file(`ppt/slides/slide${index}.xml`);
  assert.ok(file, `slide${index}.xml topilmadi`);
  return file.async("string");
}

/** XML'dagi matn bo'laklari — XML belgilari ochilgan holda. */
function textsIn(xml: string): string[] {
  return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((match) =>
    match[1]
      .replaceAll("&apos;", "'")
      .replaceAll("&quot;", '"')
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&"),
  );
}

function deck(slides: Slide[]): PresentationContent {
  return { title: "Render shartnomasi", slides };
}

/**
 * Bitta slaydni render qilib, kutilgan markerlarni tekshiradi.
 *
 * Markerlar ataylab to'qnashmaydigan qilib tanlangan (`CARD_ALPHA` kabi):
 * shablon matni yoki boshqa blok ularni tasodifan bermaydi.
 */
async function assertRendered(
  slide: Slide,
  expected: string[],
  context: string,
): Promise<string> {
  const { buffer } = await generatePptx(deck([slide]));
  const xml = await slideXml(buffer, 1);
  const texts = textsIn(xml);

  for (const marker of expected) {
    assert.ok(
      texts.some((text) => text.includes(marker)),
      `${context}: "${marker}" .pptx faylida topilmadi — chizilgan matn: ${texts.join(" | ")}`,
    );
  }

  return xml;
}

/*
  ── 12 MAKET ──────────────────────────────────────────────────────────────
  Ro'yxat `lib/validations/presentation.ts` dagi `slideLayoutSchema` dan
  olingan va TO'LIQ: bittasi ham tushib qolmasin.
*/
const ALL_LAYOUTS: SlideLayout[] = [
  "cover",
  "statement",
  "statistic",
  "bullets",
  "threeCards",
  "fourCards",
  "comparison",
  "timeline",
  "process",
  "chart",
  "quote",
  "conclusion",
];

interface LayoutCase {
  layout: SlideLayout;
  slide: Slide;
  /** Faylda BO'LISHI SHART bo'lgan matnlar. */
  expect: string[];
  /** Maket haqiqatan ishlatilganini bildiruvchi imzo (matndan tashqari). */
  signature?: (xml: string) => boolean;
}

const CASES: LayoutCase[] = [
  {
    layout: "cover",
    slide: {
      type: "title",
      layout: "cover",
      heading: "COVER_HEADING",
      bullets: [],
      keyMessage: "KEY_MESSAGE",
    },
    expect: ["COVER_HEADING", "KEY_MESSAGE"],
  },
  {
    layout: "statement",
    slide: {
      type: "content",
      layout: "statement",
      heading: "STATEMENT_HEADING",
      bullets: [],
      keyMessage: "KEY_MESSAGE",
    },
    expect: ["STATEMENT_HEADING", "KEY_MESSAGE"],
  },
  {
    layout: "statistic",
    slide: {
      type: "content",
      layout: "statistic",
      heading: "STATISTIC_HEADING",
      bullets: [],
      keyMessage: "KEY_MESSAGE",
      statistic: { value: "STAT_VALUE", caption: "STAT_CAPTION" },
    },
    expect: ["STATISTIC_HEADING", "STAT_VALUE", "STAT_CAPTION"],
  },
  {
    layout: "bullets",
    slide: {
      type: "content",
      layout: "bullets",
      heading: "BULLETS_HEADING",
      bullets: ["BULLET_ALPHA", "BULLET_BETA", "BULLET_GAMMA"],
      keyMessage: "KEY_MESSAGE",
    },
    expect: ["BULLETS_HEADING", "BULLET_ALPHA", "BULLET_BETA", "BULLET_GAMMA"],
  },
  {
    layout: "threeCards",
    slide: {
      type: "content",
      layout: "threeCards",
      heading: "THREECARDS_HEADING",
      bullets: [],
      keyMessage: "KEY_MESSAGE",
      cards: [
        { title: "CARD_ALPHA", body: "CARD_ALPHA_BODY" },
        { title: "CARD_BETA", body: "CARD_BETA_BODY" },
        { title: "CARD_GAMMA", body: "CARD_GAMMA_BODY" },
      ],
    },
    expect: [
      "THREECARDS_HEADING",
      "CARD_ALPHA",
      "CARD_ALPHA_BODY",
      "CARD_BETA",
      "CARD_GAMMA",
    ],
  },
  {
    layout: "fourCards",
    slide: {
      type: "content",
      layout: "fourCards",
      heading: "FOURCARDS_HEADING",
      bullets: [],
      keyMessage: "KEY_MESSAGE",
      cards: [
        { title: "CARD_ALPHA" },
        { title: "CARD_BETA" },
        { title: "CARD_GAMMA" },
        { title: "CARD_DELTA" },
      ],
    },
    expect: ["FOURCARDS_HEADING", "CARD_ALPHA", "CARD_BETA", "CARD_GAMMA", "CARD_DELTA"],
  },
  {
    layout: "comparison",
    slide: {
      type: "content",
      layout: "comparison",
      heading: "COMPARISON_HEADING",
      bullets: [],
      keyMessage: "KEY_MESSAGE",
      comparison: {
        leftTitle: "LEFT_COLUMN",
        leftItems: ["LEFT_ITEM_ALPHA", "LEFT_ITEM_BETA"],
        rightTitle: "RIGHT_COLUMN",
        rightItems: ["RIGHT_ITEM_ALPHA"],
      },
    },
    expect: [
      "COMPARISON_HEADING",
      "LEFT_COLUMN",
      "LEFT_ITEM_ALPHA",
      "LEFT_ITEM_BETA",
      "RIGHT_COLUMN",
      "RIGHT_ITEM_ALPHA",
    ],
  },
  {
    layout: "timeline",
    slide: {
      type: "content",
      layout: "timeline",
      heading: "TIMELINE_HEADING",
      bullets: [],
      keyMessage: "KEY_MESSAGE",
      steps: [{ label: "STEP_ALPHA" }, { label: "STEP_BETA" }, { label: "STEP_GAMMA" }],
    },
    expect: ["TIMELINE_HEADING", "STEP_ALPHA", "STEP_BETA", "STEP_GAMMA"],
  },
  {
    layout: "process",
    slide: {
      type: "content",
      layout: "process",
      heading: "PROCESS_HEADING",
      bullets: [],
      keyMessage: "KEY_MESSAGE",
      steps: [
        { label: "STEP_ALPHA", body: "STEP_ALPHA_BODY" },
        { label: "STEP_BETA", body: "STEP_BETA_BODY" },
        { label: "STEP_GAMMA", body: "STEP_GAMMA_BODY" },
      ],
    },
    expect: [
      "PROCESS_HEADING",
      "STEP_ALPHA",
      "STEP_ALPHA_BODY",
      "STEP_BETA_BODY",
      "STEP_GAMMA",
    ],
  },
  {
    layout: "chart",
    slide: {
      type: "content",
      layout: "chart",
      heading: "CHART_HEADING",
      bullets: [],
      keyMessage: "KEY_MESSAGE",
      chart: {
        kind: "bar",
        categories: ["CHART_LABEL_A", "CHART_LABEL_B"],
        series: [{ name: "CHART_SERIES", values: [3, 7] }],
        source: "CHART_SOURCE",
      },
    },
    /*
      Diagramma matni slaydda emas, `ppt/charts/chart1.xml` da yashaydi —
      shuning uchun slaydda sarlavha, asosiy fikr va manba tekshiriladi,
      chart obyektining o'zi esa `signature` bilan.
    */
    expect: ["CHART_HEADING", "KEY_MESSAGE", "CHART_SOURCE"],
    signature: (xml) => xml.includes("<p:graphicFrame>"),
  },
  {
    layout: "quote",
    slide: {
      type: "content",
      layout: "quote",
      heading: "QUOTE_HEADING",
      bullets: [],
      keyMessage: "KEY_MESSAGE",
      quote: { text: "QUOTE_TEXT — yetarlicha uzun iqtibos", author: "QUOTE_AUTHOR" },
    },
    expect: ["QUOTE_TEXT", "QUOTE_AUTHOR"],
  },
  {
    layout: "conclusion",
    slide: {
      type: "summary",
      layout: "conclusion",
      heading: "CONCLUSION_HEADING",
      bullets: ["BULLET_ALPHA", "BULLET_BETA"],
      keyMessage: "KEY_MESSAGE",
    },
    expect: ["CONCLUSION_HEADING", "BULLET_ALPHA", "BULLET_BETA"],
  },
];

describe("render shartnomasi — 12 maketning HAR BIRI mazmunini faylga chizadi", () => {
  it("sinov ro'yxati BARCHA maketlarni qamraydi", () => {
    // Yangi maket qo'shilsa, u shu yerda ham paydo bo'lishi shart —
    // aks holda u sinovsiz ishlab ketardi.
    assert.deepEqual(
      [...CASES.map((c) => c.layout)].sort(),
      [...ALL_LAYOUTS].sort(),
      "sinov ro'yxati va maket ro'yxati mos emas",
    );
  });

  for (const testCase of CASES) {
    it(`${testCase.layout} — mazmun .pptx ichida`, async () => {
      const xml = await assertRendered(testCase.slide, testCase.expect, testCase.layout);

      if (testCase.signature) {
        assert.ok(
          testCase.signature(xml),
          `${testCase.layout}: maket imzosi topilmadi — boshqa maket chizilgan`,
        );
      }
    });
  }
});

describe("renderer PLANNER bergan maketni O'ZGARTIRMAYDI", () => {
  /*
    Bu ikki sinov P0-1 ning bevosita regressiyasi.

    Ilgari `planLayouts` renderer ichida qayta yugurardi va qo'shni
    slaydlarning maketi bir xil bo'lsa, ikkinchisini "xilma-xillik uchun"
    boshqa maketga o'tkazardi. Almashtirish esa faqat maketning
    CHIZILISHI mumkinligini tekshirardi, mazmunning saqlanishini emas.
  */
  it("ketma-ket bir xil maketlarda mazmun yo'qolmaydi", async () => {
    const slides: Slide[] = [
      {
        type: "content",
        layout: "bullets",
        heading: "FIRST_HEADING",
        bullets: ["FIRST_ALPHA", "FIRST_BETA"],
        keyMessage: "KEY_MESSAGE",
      },
      {
        type: "content",
        layout: "bullets",
        heading: "SECOND_HEADING",
        bullets: ["SECOND_ALPHA", "SECOND_BETA"],
        keyMessage: "KEY_MESSAGE",
      },
      {
        type: "content",
        layout: "bullets",
        heading: "THIRD_HEADING",
        bullets: ["THIRD_ALPHA", "THIRD_BETA"],
        keyMessage: "KEY_MESSAGE",
      },
    ];

    const { buffer } = await generatePptx(deck(slides));

    for (const [index, marker] of [
      "FIRST_ALPHA",
      "SECOND_ALPHA",
      "THIRD_ALPHA",
    ].entries()) {
      const texts = textsIn(await slideXml(buffer, index + 1));
      assert.ok(
        texts.some((text) => text.includes(marker)),
        `${index + 1}-slayd: "${marker}" yo'qoldi — chizilgan: ${texts.join(" | ")}`,
      );
    }
  });

  it("ketma-ket kartalar slaydlari kartalarini saqlaydi", async () => {
    const cardsSlide = (prefix: string): Slide => ({
      type: "content",
      layout: "threeCards",
      heading: `${prefix}_HEADING`,
      bullets: [],
      keyMessage: "KEY_MESSAGE",
      cards: [
        { title: `${prefix}_CARD_ALPHA` },
        { title: `${prefix}_CARD_BETA` },
        { title: `${prefix}_CARD_GAMMA` },
      ],
    });

    const { buffer } = await generatePptx(deck([cardsSlide("ONE"), cardsSlide("TWO")]));

    for (const [index, prefix] of ["ONE", "TWO"].entries()) {
      const texts = textsIn(await slideXml(buffer, index + 1));
      assert.ok(
        texts.some((text) => text.includes(`${prefix}_CARD_ALPHA`)),
        `${index + 1}-slayd: kartalar yo'qoldi — chizilgan: ${texts.join(" | ")}`,
      );
    }
  });
});

describe("XULOSA slaydi mazmunini yo'qotmaydi (P0-2)", () => {
  /*
    `summary` — slaydning MAQSADI, `contentType` esa mazmun SHAKLI.
    Ilgari ikkisi bir tushunchaga qo'shib yuborilgan edi: har qanday
    xulosa slaydi `conclusion` maketiga tushardi, u esa faqat bandlarni
    chizadi. Zichlik qoidasi kartalar uchun bandlarni bo'shatgani uchun
    natija sarlavha + sahifa raqamidan iborat BO'SH slayd bo'lardi.
  */
  const summaryCases: Array<[string, Slide, string[]]> = [
    [
      "summary + bullets",
      {
        type: "summary",
        heading: "SUMMARY_HEADING",
        bullets: ["BULLET_ALPHA", "BULLET_BETA"],
        keyMessage: "KEY_MESSAGE",
      },
      ["SUMMARY_HEADING", "BULLET_ALPHA", "BULLET_BETA"],
    ],
    [
      "summary + cards",
      {
        type: "summary",
        heading: "SUMMARY_HEADING",
        bullets: [],
        keyMessage: "KEY_MESSAGE",
        cards: [
          { title: "CARD_ALPHA", body: "CARD_ALPHA_BODY" },
          { title: "CARD_BETA" },
          { title: "CARD_GAMMA" },
        ],
      },
      ["SUMMARY_HEADING", "CARD_ALPHA", "CARD_ALPHA_BODY", "CARD_BETA", "CARD_GAMMA"],
    ],
    [
      "summary + steps",
      {
        type: "summary",
        heading: "SUMMARY_HEADING",
        bullets: [],
        keyMessage: "KEY_MESSAGE",
        steps: [
          { label: "STEP_ALPHA", body: "STEP_ALPHA_BODY" },
          { label: "STEP_BETA" },
          { label: "STEP_GAMMA" },
        ],
      },
      ["SUMMARY_HEADING", "STEP_ALPHA", "STEP_BETA", "STEP_GAMMA"],
    ],
    [
      "summary + comparison",
      {
        type: "summary",
        heading: "SUMMARY_HEADING",
        bullets: [],
        keyMessage: "KEY_MESSAGE",
        comparison: {
          leftTitle: "LEFT_COLUMN",
          leftItems: ["LEFT_ITEM_ALPHA"],
          rightTitle: "RIGHT_COLUMN",
          rightItems: ["RIGHT_ITEM_ALPHA"],
        },
      },
      ["SUMMARY_HEADING", "LEFT_COLUMN", "LEFT_ITEM_ALPHA", "RIGHT_COLUMN"],
    ],
    [
      "summary + statistic",
      {
        type: "summary",
        heading: "SUMMARY_HEADING",
        bullets: [],
        keyMessage: "KEY_MESSAGE",
        statistic: { value: "STAT_VALUE", caption: "STAT_CAPTION" },
      },
      ["SUMMARY_HEADING", "STAT_VALUE", "STAT_CAPTION"],
    ],
  ];

  for (const [name, slide, expected] of summaryCases) {
    it(name, async () => {
      await assertRendered(slide, expected, name);
    });
  }
});

describe("maket mazmunga mos kelmasa ham slayd BO'SH chiqmaydi", () => {
  /*
    Bu holat quvurdan kelmaydi (planner maketni mazmunga qarab
    tekshiradi), lekin `PATCH /api/presentations/[id]` orqali
    o'qituvchi istalgan maketni qo'yishi mumkin. Ilgari chizuvchilar
    bunday holatda `return` qilardi va slayd butunlay bo'sh chiqardi.

    Renderer bu yerda BOSHQA MAKET TANLAMAYDI — u shunchaki mavjud
    mazmunni chizadi.
  */
  const brokenCases: Array<[SlideLayout, string[]]> = [
    ["chart", ["FALLBACK_HEADING", "FALLBACK_BULLET"]],
    ["statistic", ["FALLBACK_HEADING", "FALLBACK_BULLET"]],
    ["comparison", ["FALLBACK_HEADING", "FALLBACK_BULLET"]],
    ["threeCards", ["FALLBACK_HEADING", "FALLBACK_BULLET"]],
    ["process", ["FALLBACK_HEADING", "FALLBACK_BULLET"]],
    ["quote", ["FALLBACK_HEADING", "FALLBACK_BULLET"]],
  ];

  for (const [layout, expected] of brokenCases) {
    it(`${layout} maketi mazmunsiz berilsa ham matn chiziladi`, async () => {
      await assertRendered(
        {
          type: "content",
          layout,
          heading: "FALLBACK_HEADING",
          bullets: ["FALLBACK_BULLET"],
        },
        expected,
        `${layout} (mazmunsiz)`,
      );
    });
  }
});

describe("eski yozuvlar (maketsiz) buzilmaydi", () => {
  /*
    Bazadagi eski `content` yozuvlarida `layout` maydoni yo'q. Ular
    uchun maket MAZMUNDAN keltirib chiqariladi — bu legacy adapter va
    u renderer qarori emas: yozuvda qaror umuman yo'q.
  */
  it("maketsiz bandli slayd bandlarini chizadi", async () => {
    await assertRendered(
      { type: "content", heading: "LEGACY_HEADING", bullets: ["LEGACY_BULLET"] },
      ["LEGACY_HEADING", "LEGACY_BULLET"],
      "legacy bullets",
    );
  });

  it("maketsiz kartali slayd kartalarini chizadi", async () => {
    await assertRendered(
      {
        type: "content",
        heading: "LEGACY_HEADING",
        bullets: [],
        cards: [{ title: "CARD_ALPHA" }, { title: "CARD_BETA" }, { title: "CARD_GAMMA" }],
      },
      ["LEGACY_HEADING", "CARD_ALPHA", "CARD_BETA", "CARD_GAMMA"],
      "legacy cards",
    );
  });

  it("maketsiz eski muqova va xulosa avvalgidek chiziladi", async () => {
    await assertRendered(
      { type: "title", heading: "LEGACY_COVER", bullets: ["LEGACY_SUBTITLE"] },
      ["LEGACY_COVER", "LEGACY_SUBTITLE"],
      "legacy cover",
    );
    await assertRendered(
      { type: "summary", heading: "LEGACY_SUMMARY", bullets: ["LEGACY_BULLET"] },
      ["LEGACY_SUMMARY", "LEGACY_BULLET"],
      "legacy summary",
    );
  });
});
