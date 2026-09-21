import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { generatePptx } from "../lib/pptx/generate";
import { textsOfLegacy, viewOfLegacy } from "../lib/presentations/blocks";
import type { Slide, SlideLayout } from "../lib/validations/presentation";

/**
 * PREVIEW SHARTNOMASI — ekranda ko'ringan narsa faylda ham bormi?
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * Render shartnomasi (`pptx-render-contract.test.ts`) "yozuvdagi mazmun
 * faylga tushdimi" degan savolga javob beradi. Lekin o'qituvchi faylni
 * emas, EKRANNI ko'radi va ikkisi bir-biridan mustaqil yozilgan edi:
 * renderer o'n beshta maydonni chizardi, ko'rish rejimi ikkitasini.
 *
 * Ya'ni kartali slayd ekranda bo'sh, faylda to'la ko'rinardi — bu
 * "yuklab olgandan keyin bilib qolasiz" degan mahsulot.
 *
 * ── Bu sinov nimani qulflaydi ─────────────────────────────────────────────
 * `viewOfLegacy(slide)` — ekran uchun yagona manba. Bu yerda uning chiqishi
 * HAQIQIY `.pptx` bilan IKKALA YO'NALISHDA solishtiriladi:
 *
 *   1. ekranda ko'rinadigan har bir matn faylda ham bor;
 *   2. faylda ko'rinadigan har bir matn ekranda ham bor.
 *
 * Ikkinchisi muhimroq: aynan u "renderer chizdi, preview unutdi"
 * holatini tutadi.
 */

/** Renderer o'zi qo'shadigan bezaklar — mazmun emas, shuning uchun hisobga olinmaydi. */
const DECORATIONS = [
  /^\d+ \/ \d+$/, // sahifa raqami
  /^\d{2}$/, // karta tartib raqami: 01, 02, 03
  /^\d$/, // bosqich raqami: 1, 2, 3
  /^“$/, // iqtibos belgisi
];

function isDecoration(text: string): boolean {
  return DECORATIONS.some((pattern) => pattern.test(text));
}

async function slideTexts(slide: Slide): Promise<string[]> {
  const { buffer } = await generatePptx({ title: "Parity", slides: [slide] });
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");

  return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)]
    .map((match) =>
      match[1]
        .replaceAll("&apos;", "'")
        .replaceAll("&quot;", '"')
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&"),
    )
    .filter((text) => text.trim().length > 0 && !isDecoration(text));
}

/**
 * Taqqoslash uchun matnni keltiradi.
 *
 * Ikkita KO'RINISH o'zgarishi mazmun farqi emas va olib tashlanadi:
 *   · manba qatori faylda "Manba: " prefiksi bilan chiziladi;
 *   · yorliq (`eyebrow`) faylda bosh harfga o'giriladi
 *     (`lib/pptx/layouts.ts` → `toUpperCase()`), ekranda esa buni CSS
 *     qiladi — saqlangan matn ikkalasida ham bir xil.
 */
function normalize(text: string): string {
  return text
    .replace(/^Manba:\s*/, "")
    .trim()
    .toLocaleLowerCase("uz");
}

/** Har bir maket uchun to'liq to'ldirilgan namuna slayd. */
const SAMPLES: Array<[SlideLayout, Slide]> = [
  [
    "cover",
    {
      type: "title",
      layout: "cover",
      heading: "Muqova sarlavhasi",
      bullets: [],
      keyMessage: "Muqova ostidagi matn",
      eyebrow: "Yorliq",
    },
  ],
  [
    "statement",
    {
      type: "content",
      layout: "statement",
      heading: "Bitta fikr",
      bullets: [],
      keyMessage: "Yagona kuchli jumla",
      eyebrow: "Yorliq",
      source: "Manba nomi",
    },
  ],
  [
    "statistic",
    {
      type: "content",
      layout: "statistic",
      heading: "Raqam",
      bullets: [],
      eyebrow: "Yorliq",
      statistic: { value: "78%", caption: "Raqam izohi" },
      source: "Manba nomi",
    },
  ],
  [
    "bullets",
    {
      type: "content",
      layout: "bullets",
      heading: "Bandlar",
      bullets: ["Birinchi band", "Ikkinchi band", "Uchinchi band"],
      eyebrow: "Yorliq",
      keyMessage: "Bandlar bor, shuning uchun bu chizilmaydi",
    },
  ],
  [
    "threeCards",
    {
      type: "content",
      layout: "threeCards",
      heading: "Uch karta",
      bullets: [],
      eyebrow: "Yorliq",
      cards: [
        { title: "Birinchi karta", body: "Birinchi tavsif" },
        { title: "Ikkinchi karta", body: "Ikkinchi tavsif" },
        { title: "Uchinchi karta" },
      ],
      source: "Manba nomi",
    },
  ],
  [
    "fourCards",
    {
      type: "content",
      layout: "fourCards",
      heading: "To'rt karta",
      bullets: [],
      cards: [
        { title: "Karta A" },
        { title: "Karta B" },
        { title: "Karta V" },
        { title: "Karta G" },
      ],
    },
  ],
  [
    "comparison",
    {
      type: "content",
      layout: "comparison",
      heading: "Taqqoslash",
      bullets: [],
      eyebrow: "Yorliq",
      comparison: {
        leftTitle: "Chap ustun",
        leftItems: ["Chap birinchi", "Chap ikkinchi"],
        rightTitle: "O'ng ustun",
        rightItems: ["O'ng birinchi"],
      },
      source: "Manba nomi",
    },
  ],
  [
    "timeline",
    {
      type: "content",
      layout: "timeline",
      heading: "Vaqt chizig'i",
      bullets: [],
      steps: [
        { label: "Bosqich bir" },
        { label: "Bosqich ikki" },
        { label: "Bosqich uch" },
      ],
    },
  ],
  [
    "process",
    {
      type: "content",
      layout: "process",
      heading: "Jarayon",
      bullets: [],
      eyebrow: "Yorliq",
      steps: [
        { label: "Bosqich bir", body: "Birinchi tavsif" },
        { label: "Bosqich ikki", body: "Ikkinchi tavsif" },
        { label: "Bosqich uch", body: "Uchinchi tavsif" },
      ],
      source: "Manba nomi",
    },
  ],
  [
    "chart",
    {
      type: "content",
      layout: "chart",
      heading: "Diagramma",
      bullets: [],
      keyMessage: "Diagramma yonidagi fikr",
      chart: {
        kind: "bar",
        categories: ["Yanvar", "Fevral"],
        series: [{ name: "Qator", values: [1, 2] }],
        source: "Diagramma manbasi",
      },
    },
  ],
  [
    "quote",
    {
      type: "content",
      layout: "quote",
      heading: "Bu sarlavha CHIZILMAYDI",
      bullets: [],
      quote: { text: "Yetarlicha uzun iqtibos matni bu yerda.", author: "Muallif" },
      source: "Manba nomi",
    },
  ],
  [
    "conclusion",
    {
      type: "summary",
      layout: "conclusion",
      heading: "Xulosa",
      bullets: ["Yodda qoladigan fikr"],
      eyebrow: "Yorliq",
    },
  ],
];

describe("preview shartnomasi — ekran va .pptx BIR XIL matnni ko'rsatadi", () => {
  it("namunalar BARCHA maketlarni qamraydi", () => {
    const covered = SAMPLES.map(([layout]) => layout).sort();
    const all: SlideLayout[] = [
      "bullets",
      "chart",
      "comparison",
      "conclusion",
      "cover",
      "fourCards",
      "process",
      "quote",
      "statement",
      "statistic",
      "threeCards",
      "timeline",
    ];
    assert.deepEqual(covered, all, "namunalar ro'yxati to'liq emas");
  });

  for (const [layout, slide] of SAMPLES) {
    it(`${layout} — ekranda ko'ringan matn faylda ham bor`, async () => {
      const onScreen = textsOfLegacy(slide).map(normalize);
      const inFile = (await slideTexts(slide)).map(normalize);

      for (const text of onScreen) {
        assert.ok(
          inFile.some(
            (candidate) => candidate.includes(text) || text.includes(candidate),
          ),
          `${layout}: ekranda "${text}" bor, faylda yo'q — fayldagi: ${inFile.join(" | ")}`,
        );
      }
    });

    it(`${layout} — faylda ko'ringan matn ekranda ham bor`, async () => {
      const onScreen = textsOfLegacy(slide).map(normalize);
      const inFile = (await slideTexts(slide)).map(normalize);

      for (const text of inFile) {
        assert.ok(
          onScreen.some(
            (candidate) => candidate.includes(text) || text.includes(candidate),
          ),
          `${layout}: faylda "${text}" bor, ekranda yo'q — ekrandagi: ${onScreen.join(" | ")}`,
        );
      }
    });
  }
});

describe("viewOf — maket qarori renderer bilan bir xil", () => {
  it("yozuvdagi maket hurmat qilinadi", () => {
    assert.equal(viewOfLegacy(SAMPLES[4][1]).layout, "threeCards");
  });

  it("maketsiz slaydda mazmundan keltirib chiqariladi", () => {
    const view = viewOfLegacy({
      type: "content",
      heading: "Maketsiz",
      bullets: [],
      cards: [{ title: "A" }, { title: "B" }, { title: "C" }],
    });
    assert.equal(view.layout, "threeCards");
  });

  /*
    Iqtibos maketi sarlavha chizmaydi. Preview buni YASHIRMASLIGI kerak:
    o'qituvchi sarlavhasi faylga tushmasligini bilib turishi kerak.
  */
  it("iqtibos maketi sarlavha chizmasligini AYTADI", () => {
    assert.equal(viewOfLegacy(SAMPLES[10][1]).showsHeading, false);
  });

  it("qolgan maketlar sarlavha chizadi", () => {
    for (const [layout, slide] of SAMPLES) {
      if (layout === "quote") continue;
      assert.equal(
        viewOfLegacy(slide).showsHeading,
        true,
        `${layout}: sarlavha yo'qolgan`,
      );
    }
  });
});
