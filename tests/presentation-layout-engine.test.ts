import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  planLayouts,
  inferLayout,
  layoutVariety,
} from "../lib/presentations/layout-engine";
import type { Slide } from "../lib/validations/presentation";

/*
  V6 — maket dvigateli.

  Muammo: renderer ikkitagina chizish funksiyasiga ega edi, shuning uchun
  10 slaydli prezentatsiyaning 9 tasi aynan bir xil ko'rinardi.
*/

function slide(partial: Partial<Slide> = {}): Slide {
  return { type: "content", heading: "Sarlavha", bullets: [], ...partial };
}

describe("maket mazmun shakliga qarab tanlanadi", () => {
  const cases: Array<[string, Slide, string]> = [
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
      assert.equal(inferLayout(s, 2, 6), expected);
    });
  }

  /*
    Muqova/xulosani `type` belgilaydi, POZITSIYA emas.

    Boshida bu qoida pozitsiyaga ham bog'langan edi va u regressiya berdi:
    qisqa deckda mazmun slaydi birinchi o'rinda tursa muqovaga aylanib,
    bandlari yo'qolardi. `tests/pptx-generate.test.ts` buni tutdi.
  */
  it("type=title muqova beradi", () => {
    assert.equal(inferLayout(slide({ type: "title" }), 3, 5), "cover");
  });

  it("type=summary xulosa beradi", () => {
    assert.equal(
      inferLayout(slide({ type: "summary", bullets: ["a"] }), 1, 5),
      "conclusion",
    );
  });

  it("birinchi o'rindagi MAZMUN slaydi muqovaga AYLANMAYDI", () => {
    assert.equal(inferLayout(slide({ bullets: ["a", "b"] }), 0, 5), "bullets");
  });

  it("oxirgi o'rindagi mazmun slaydi xulosaga AYLANMAYDI", () => {
    assert.equal(inferLayout(slide({ bullets: ["a"] }), 4, 5), "bullets");
  });
});

describe("maket mazmunga mos kelmasa xavfsiz zaxiraga tushadi", () => {
  it("chart maketi so'ralgan, lekin chart yo'q", () => {
    const layouts = planLayouts([
      slide({ type: "title" }),
      slide({ layout: "chart", bullets: ["band"] }),
      slide({ type: "summary" }),
    ]);
    assert.notEqual(layouts[1], "chart", "mazmunsiz maket ishlatilmasligi kerak");
    assert.equal(layouts[1], "bullets");
  });

  it("kartalar maketi so'ralgan, lekin kartalar yo'q", () => {
    const layouts = planLayouts([
      slide({ type: "title" }),
      slide({ layout: "fourCards", keyMessage: "fikr" }),
    ]);
    assert.notEqual(layouts[1], "fourCards");
  });
});

describe("vizual ritm — ketma-ket bir xil maketlar kamaytiriladi", () => {
  it("uchta ketma-ket bandli slayd bir xil qolmaydi", () => {
    const layouts = planLayouts([
      slide({ type: "title" }),
      slide({
        bullets: ["a", "b"],
        cards: [{ title: "1" }, { title: "2" }, { title: "3" }],
      }),
      slide({
        bullets: ["c", "d"],
        cards: [{ title: "1" }, { title: "2" }, { title: "3" }],
      }),
      slide({ type: "summary", bullets: ["e"] }),
    ]);
    assert.notEqual(
      layouts[1],
      layouts[2],
      "qo'shni slaydlar bir xil maket olmasligi kerak",
    );
  });

  it("muqova va xulosa almashtirilmaydi", () => {
    const layouts = planLayouts([
      slide({ type: "title" }),
      slide({ type: "title" }),
      slide({ type: "summary", bullets: ["a"] }),
      slide({ type: "summary", bullets: ["b"] }),
    ]);
    assert.deepEqual(layouts, ["cover", "cover", "conclusion", "conclusion"]);
  });
});

describe("xilma-xillik o'lchovi", () => {
  it("bir xil maketlarda past, turlichada yuqori", () => {
    assert.equal(layoutVariety(["bullets", "bullets", "bullets", "bullets"]), 0.25);
    assert.equal(layoutVariety(["cover", "chart", "statistic", "conclusion"]), 1);
  });

  it("to'liq deck yuqori xilma-xillik beradi", () => {
    const layouts = planLayouts([
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
    ]);
    assert.ok(
      layoutVariety(layouts) >= 0.9,
      `xilma-xillik past: ${layoutVariety(layouts)}`,
    );
    const consecutive = layouts.filter((l, i) => i > 0 && l === layouts[i - 1]).length;
    assert.equal(consecutive, 0);
  });
});

describe("eski yozuvlar buzilmaydi (orqaga moslik)", () => {
  it("faqat type va bullets bo'lgan eski slaydlar ishlaydi", () => {
    const layouts = planLayouts([
      { type: "title", heading: "Eski muqova", bullets: ["Matematika", "8-sinf"] },
      { type: "content", heading: "Eski mazmun", bullets: ["band 1", "band 2"] },
      { type: "summary", heading: "Eski xulosa", bullets: ["xulosa"] },
    ]);
    assert.deepEqual(layouts, ["cover", "bullets", "conclusion"]);
  });
});
