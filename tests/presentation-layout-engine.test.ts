import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  layoutForContentType,
  layoutVariety,
  legacyLayoutFor,
} from "../lib/presentations/layout-engine";
import type { Slide, SlideLayout } from "../lib/validations/presentation";

/*
  V6 — maket dvigateli.

  Muammo: renderer ikkitagina chizish funksiyasiga ega edi, shuning uchun
  10 slaydli prezentatsiyaning 9 tasi aynan bir xil ko'rinardi.

  Phase 0 dan keyin maket qarori BITTA joyda: `layoutForContentType`
  (quvur) va `legacyLayoutFor` (maketsiz eski yozuvlar). Renderer
  qatlamidagi ikkinchi qaror (`planLayouts` + `breakMonotony`) olib
  tashlandi — u xilma-xillikni mazmun hisobiga sotib olardi. Mazmun
  faylga tushishini `tests/pptx-render-contract.test.ts` tekshiradi.
*/

function slide(partial: Partial<Slide> = {}): Slide {
  return { type: "content", heading: "Sarlavha", bullets: [], ...partial };
}

describe("legacyLayoutFor — maketsiz slayd uchun maket mazmundan keladi", () => {
  const cases: Array<[string, Slide, SlideLayout]> = [
    [
      "chart bo'lsa",
      slide({
        chart: {
          kind: "bar",
          categories: ["a", "b"],
          series: [{ name: "s", values: [1, 2] }],
        },
      }),
      "chart",
    ],
    [
      "statistika bo'lsa",
      slide({ statistic: { value: "78%", caption: "izoh" } }),
      "statistic",
    ],
    [
      "taqqoslash bo'lsa",
      slide({
        comparison: {
          leftTitle: "A",
          leftItems: ["1"],
          rightTitle: "B",
          rightItems: ["2"],
        },
      }),
      "comparison",
    ],
    [
      "uchta karta bo'lsa",
      slide({ cards: [{ title: "1" }, { title: "2" }, { title: "3" }] }),
      "threeCards",
    ],
    [
      "to'rtta karta bo'lsa",
      slide({ cards: [{ title: "1" }, { title: "2" }, { title: "3" }, { title: "4" }] }),
      "fourCards",
    ],
    [
      "bosqichlar tavsifi bilan",
      slide({ steps: [{ label: "a", body: "x" }, { label: "b" }, { label: "c" }] }),
      "process",
    ],
    [
      "bosqichlar tavsifsiz",
      slide({ steps: [{ label: "a" }, { label: "b" }, { label: "c" }] }),
      "timeline",
    ],
    [
      "iqtibos bo'lsa",
      slide({ quote: { text: "Yetarlicha uzun iqtibos matni." } }),
      "quote",
    ],
    ["faqat asosiy fikr", slide({ keyMessage: "Bitta kuchli fikr" }), "statement"],
    ["oddiy bandlar", slide({ bullets: ["a", "b"] }), "bullets"],
  ];

  for (const [name, s, expected] of cases) {
    it(name, () => {
      assert.equal(legacyLayoutFor(s), expected);
    });
  }

  /*
    Muqova/xulosani `type` belgilaydi, POZITSIYA emas.

    Boshida bu qoida pozitsiyaga ham bog'langan edi va u regressiya berdi:
    qisqa deckda mazmun slaydi birinchi o'rinda tursa muqovaga aylanib,
    bandlari yo'qolardi. Endi pozitsiya umuman argument emas.
  */
  it("type=title muqova beradi", () => {
    assert.equal(legacyLayoutFor(slide({ type: "title" })), "cover");
  });

  it("type=summary bandlar bilan xulosa beradi", () => {
    assert.equal(
      legacyLayoutFor(slide({ type: "summary", bullets: ["a"] })),
      "conclusion",
    );
  });

  /*
    P0-2 ning eski yozuvlardagi ko'rinishi: kartali xulosa slaydi
    `conclusion` ga tushsa, kartalari chizilmay qolardi. Mazmun
    signali `type` dan USTUN turadi.
  */
  it("type=summary KARTALAR bilan conclusion BERMAYDI", () => {
    assert.equal(
      legacyLayoutFor(
        slide({
          type: "summary",
          cards: [{ title: "1" }, { title: "2" }, { title: "3" }],
        }),
      ),
      "threeCards",
    );
  });

  it("yozuvdagi maket HURMAT QILINADI", () => {
    // Maket saqlangan bo'lsa — qaror allaqachon qabul qilingan.
    assert.equal(legacyLayoutFor(slide({ layout: "quote", bullets: ["a"] })), "quote");
  });
});

describe("layoutForContentType — quvurning YAGONA maket qarori", () => {
  it("muqova hikoyadagi o'rnidan keladi", () => {
    assert.equal(layoutForContentType("bullets", "title", slide()), "cover");
  });

  it("mazmun shakli maketni belgilaydi", () => {
    assert.equal(
      layoutForContentType(
        "cards",
        "content",
        slide({ cards: [{ title: "1" }, { title: "2" }, { title: "3" }] }),
      ),
      "threeCards",
    );
  });

  /*
    Reja "kartalar" desa-yu, model kartalarni qaytarmasa — maket
    MAZMUNGA mos zaxiraga tushadi, aks holda bo'sh slayd chiqardi.
    Bu tekshiruv renderer qatlamida EMAS, aynan shu yerda turadi.
  */
  it("reja mazmun bilan mos kelmasa mazmunga qaytadi", () => {
    assert.equal(
      layoutForContentType("cards", "content", slide({ bullets: ["a", "b"] })),
      "bullets",
    );
    assert.equal(
      layoutForContentType("chart", "content", slide({ keyMessage: "fikr" })),
      "statement",
    );
  });

  /*
    ── P0-2 REGRESSIYASI ──────────────────────────────────────────────────
    `summary` — slaydning MAQSADI, `contentType` esa mazmun SHAKLI.
    Ilgari har qanday xulosa slaydi `conclusion` maketiga tushardi, u esa
    faqat bandlarni chizadi. Zichlik kartalar uchun bandlarni
    bo'shatgani sababli natija BO'SH slayd bo'lardi.
  */
  it("xulosa + bandlar — conclusion", () => {
    assert.equal(
      layoutForContentType("bullets", "summary", slide({ bullets: ["a"] })),
      "conclusion",
    );
  });

  it("xulosa + bitta fikr — conclusion", () => {
    assert.equal(
      layoutForContentType("statement", "summary", slide({ keyMessage: "fikr" })),
      "conclusion",
    );
  });

  it("xulosa + kartalar — KARTALAR maketi (conclusion emas)", () => {
    assert.equal(
      layoutForContentType(
        "cards",
        "summary",
        slide({ cards: [{ title: "1" }, { title: "2" }, { title: "3" }] }),
      ),
      "threeCards",
    );
  });

  it("xulosa + bosqichlar — bosqichlar maketi", () => {
    assert.equal(
      layoutForContentType(
        "steps",
        "summary",
        slide({ steps: [{ label: "a", body: "x" }, { label: "b" }, { label: "c" }] }),
      ),
      "process",
    );
  });

  it("xulosa + taqqoslash — taqqoslash maketi", () => {
    assert.equal(
      layoutForContentType(
        "comparison",
        "summary",
        slide({
          comparison: {
            leftTitle: "A",
            leftItems: ["1"],
            rightTitle: "B",
            rightItems: ["2"],
          },
        }),
      ),
      "comparison",
    );
  });

  it("xulosa + statistika — statistika maketi", () => {
    assert.equal(
      layoutForContentType(
        "statistic",
        "summary",
        slide({ statistic: { value: "78%", caption: "izoh" } }),
      ),
      "statistic",
    );
  });

  /*
    Xulosa slaydida karta SO'RALGAN, lekin model uni qaytarmagan:
    mazmun bandlarga tushadi, ya'ni yana klassik `conclusion`.
  */
  it("xulosa + kartalar so'ralgan, lekin kartalar yo'q — conclusion", () => {
    assert.equal(
      layoutForContentType("cards", "summary", slide({ bullets: ["a"] })),
      "conclusion",
    );
  });

  it("bir xil kirish — bir xil maket (pozitsiyaga bog'liq emas)", () => {
    const s = slide({ bullets: ["a", "b"] });
    assert.equal(
      layoutForContentType("bullets", "content", s),
      layoutForContentType("bullets", "content", s),
    );
  });
});

describe("xilma-xillik o'lchovi", () => {
  it("bir xil maketlarda past, turlichada yuqori", () => {
    assert.equal(layoutVariety(["bullets", "bullets", "bullets", "bullets"]), 0.25);
    assert.equal(layoutVariety(["cover", "chart", "statistic", "conclusion"]), 1);
  });

  it("turli mazmunli deck yuqori xilma-xillik beradi", () => {
    const layouts = [
      slide({ type: "title" }),
      slide({ statistic: { value: "78%", caption: "izoh" } }),
      slide({ cards: [{ title: "1" }, { title: "2" }, { title: "3" }] }),
      slide({
        comparison: {
          leftTitle: "A",
          leftItems: ["1"],
          rightTitle: "B",
          rightItems: ["2"],
        },
      }),
      slide({ steps: [{ label: "a", body: "x" }, { label: "b" }, { label: "c" }] }),
      slide({
        chart: {
          kind: "bar",
          categories: ["a", "b"],
          series: [{ name: "s", values: [1, 2] }],
        },
      }),
      slide({ type: "summary", bullets: ["xulosa"] }),
    ].map(legacyLayoutFor);

    assert.ok(
      layoutVariety(layouts) >= 0.9,
      `xilma-xillik past: ${layoutVariety(layouts)}`,
    );
  });
});

describe("eski yozuvlar buzilmaydi (orqaga moslik)", () => {
  it("faqat type va bullets bo'lgan eski slaydlar ishlaydi", () => {
    const layouts = [
      { type: "title", heading: "Eski muqova", bullets: ["Matematika", "8-sinf"] },
      { type: "content", heading: "Eski mazmun", bullets: ["band 1", "band 2"] },
      { type: "summary", heading: "Eski xulosa", bullets: ["xulosa"] },
    ].map((s) => legacyLayoutFor(s as Slide));

    assert.deepEqual(layouts, ["cover", "bullets", "conclusion"]);
  });
});
