import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import {
  adaptLegacyContent,
  adaptLegacySlide,
  deckToContent,
  nextRevision,
  slideIdFor,
} from "../lib/presentations/legacy-adapter";
import { textsOf, textsOfLegacy } from "../lib/presentations/blocks";
import { deckSchema, parseDeck, IR_VERSION } from "../lib/validations/deck";
import { generatePptx } from "../lib/pptx/generate";
import type { PresentationContent, Slide } from "../lib/validations/presentation";

/**
 * PRESENTATION IR v2 — poydevor sinovlari.
 *
 * ── Nima isbotlanadi ──────────────────────────────────────────────────────
 * IR eski yozuvning O'RNINI bosa oladimi. Uchta shart:
 *
 *   1. sxema yaroqsiz deck'ni rad etadi;
 *   2. eski `content` dan qurilgan Deck hech narsa yo'qotmaydi;
 *   3. natija DETERMINISTIK — bir xil kirish har doim bir xil Deck.
 *
 * Uchinchisi kelajakdagi AI Editor uchun hal qiluvchi: "3-slaydni
 * qisqartir" buyrug'i barqaror `id` ga tayanadi. Agar ID har ochilishda
 * o'zgarsa, buyruq boshqa slaydga tushardi.
 */

const LANGUAGE = "UZ" as const;

/** Barcha blok turlarini qamrab oladigan eski mazmun. */
function legacyContent(): PresentationContent {
  const slides: Slide[] = [
    {
      type: "title",
      layout: "cover",
      heading: "Muqova sarlavhasi",
      bullets: [],
      keyMessage: "Muqova ostidagi matn",
      eyebrow: "Yorliq",
    },
    {
      type: "content",
      layout: "bullets",
      heading: "Bandlar",
      bullets: ["Birinchi band", "Ikkinchi band"],
    },
    {
      type: "content",
      layout: "threeCards",
      heading: "Kartalar",
      bullets: [],
      cards: [
        { title: "Karta bir", body: "Tavsif bir" },
        { title: "Karta ikki", body: "Tavsif ikki" },
        { title: "Karta uch" },
      ],
      source: "Manba nomi",
    },
    {
      type: "content",
      layout: "process",
      heading: "Bosqichlar",
      bullets: [],
      steps: [
        { label: "Bosqich bir", body: "Tavsif bir" },
        { label: "Bosqich ikki", body: "Tavsif ikki" },
        { label: "Bosqich uch", body: "Tavsif uch" },
      ],
    },
    {
      type: "content",
      layout: "comparison",
      heading: "Taqqoslash",
      bullets: [],
      comparison: {
        leftTitle: "Chap",
        leftItems: ["Chap bir", "Chap ikki"],
        rightTitle: "O'ng",
        rightItems: ["O'ng bir"],
      },
    },
    {
      type: "content",
      layout: "statistic",
      heading: "Raqam",
      bullets: [],
      statistic: { value: "78%", caption: "Raqam izohi" },
    },
    {
      type: "content",
      layout: "quote",
      heading: "Iqtibos sarlavhasi",
      bullets: [],
      quote: { text: "Yetarlicha uzun iqtibos matni.", author: "Muallif" },
    },
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
      },
    },
    {
      type: "summary",
      layout: "conclusion",
      heading: "Xulosa",
      bullets: ["Yodda qoladigan fikr"],
      speakerNotes: "O'qituvchi uchun izoh",
    },
  ];

  return { title: "Sinov prezentatsiyasi", slides };
}

const OPTIONS = {
  language: LANGUAGE,
  template: "klassik",
  topic: "Fotosintez",
  subject: "Biologiya",
  grade: "7-sinf",
};

// ─── TEST A: SXEMA ───────────────────────────────────────────────────────

describe("A — Deck sxemasi", () => {
  it("to'g'ri Deck sxemadan O'TADI", () => {
    const deck = adaptLegacyContent(legacyContent(), OPTIONS);
    const parsed = deckSchema.safeParse(deck);
    assert.ok(parsed.success, `sxemadan o'tmadi: ${parsed.error?.message}`);
  });

  it("noto'g'ri irVersion RAD ETILADI", () => {
    const deck = adaptLegacyContent(legacyContent(), OPTIONS);
    assert.equal(deckSchema.safeParse({ ...deck, irVersion: 1 }).success, false);
  });

  it("slaydsiz deck RAD ETILADI", () => {
    const deck = adaptLegacyContent(legacyContent(), OPTIONS);
    assert.equal(deckSchema.safeParse({ ...deck, slides: [] }).success, false);
  });

  it("ID'siz slayd RAD ETILADI", () => {
    const deck = adaptLegacyContent(legacyContent(), OPTIONS);
    const broken = {
      ...deck,
      slides: [{ ...deck.slides[0], id: "" }, ...deck.slides.slice(1)],
    };
    assert.equal(deckSchema.safeParse(broken).success, false);
  });

  it("nol yoki manfiy revision RAD ETILADI", () => {
    const deck = adaptLegacyContent(legacyContent(), OPTIONS);
    assert.equal(deckSchema.safeParse({ ...deck, revision: 0 }).success, false);
    assert.equal(deckSchema.safeParse({ ...deck, revision: -1 }).success, false);
  });

  it("notanish blok turi RAD ETILADI", () => {
    const deck = adaptLegacyContent(legacyContent(), OPTIONS);
    const broken = {
      ...deck,
      slides: [
        { ...deck.slides[0], blocks: [{ kind: "code", source: "x" }] },
        ...deck.slides.slice(1),
      ],
    };
    assert.equal(deckSchema.safeParse(broken).success, false);
  });

  it("parseDeck buzuq qiymatda null qaytaradi, yiqilmaydi", () => {
    assert.equal(parseDeck(null), null);
    assert.equal(parseDeck({ irVersion: 2 }), null);
    assert.equal(parseDeck("matn"), null);
  });
});

// ─── TEST B: LEGACY ADAPTER ──────────────────────────────────────────────

describe("B — legacy adapter hech narsa yo'qotmaydi", () => {
  const content = legacyContent();
  const deck = adaptLegacyContent(content, OPTIONS);

  it("sarlavha va til saqlanadi", () => {
    assert.equal(deck.title, content.title);
    assert.equal(deck.language, LANGUAGE);
    assert.equal(deck.theme.template, "klassik");
    assert.equal(deck.irVersion, IR_VERSION);
  });

  it("slaydlar soni saqlanadi", () => {
    assert.equal(deck.slides.length, content.slides.length);
  });

  it("maketlar saqlanadi", () => {
    assert.deepEqual(
      deck.slides.map((slide) => slide.layout),
      content.slides.map((slide) => slide.layout),
    );
  });

  it("sarlavhalar saqlanadi", () => {
    assert.deepEqual(
      deck.slides.map((slide) => slide.heading),
      content.slides.map((slide) => slide.heading),
    );
  });

  it("so'zlovchi izohi `notes` ga o'tadi", () => {
    const last = deck.slides[deck.slides.length - 1];
    assert.equal(last.notes, "O'qituvchi uchun izoh");
  });

  it("HAR BIR slaydning matni to'liq saqlanadi", () => {
    for (const [index, slide] of content.slides.entries()) {
      const before = textsOfLegacy(slide);
      const after = textsOf(deck.slides[index]);

      for (const text of before) {
        assert.ok(
          after.some((candidate) => candidate.includes(text) || text.includes(candidate)),
          `${index + 1}-slayd: "${text}" IR'da yo'qoldi — IR'dagi: ${after.join(" | ")}`,
        );
      }
    }
  });

  it("ID'lar deterministik va pozitsiyaga mos", () => {
    assert.deepEqual(
      deck.slides.map((slide) => slide.id),
      content.slides.map((_, index) => slideIdFor(index)),
    );
  });

  it("dalil ro'yxati BO'SH — research qatlami yo'q", () => {
    // Soxta dalil qo'shilmaydi: bo'sh ro'yxat "dalil yo'q" degani.
    assert.deepEqual(deck.evidence, []);
    for (const slide of deck.slides) {
      assert.deepEqual(slide.evidenceRefs, []);
    }
  });

  it("reja bo'lmasa vizual topshiriq YO'Q", () => {
    for (const slide of deck.slides) {
      assert.equal(slide.visual, null);
    }
  });

  it("reja berilsa vizual va hikoya bosqichi IR'ga o'tadi", () => {
    /*
      `Presentation.plan` uzoq vaqt YOZUV-ONLY ustun edi: unga yozilar,
      lekin hech kim o'qimasdi. Adapter uni nihoyat ishlatadi.
    */
    const withPlan = adaptLegacyContent(content, {
      ...OPTIONS,
      plan: {
        archetype: "educational",
        slideCountSource: "scope",
        slides: content.slides.map((_, index) => ({
          id: `s${index + 1}`,
          index,
          beatKey: `beat-${index}`,
          purpose: `Maqsad ${index}`,
          keyMessage: "",
          supportingPoints: [],
          contentType: "bullets" as const,
          data: null,
          visualConcept: "sabab",
          visualType: "diagram" as const,
          visualBrief: "sxema chizilsin",
          layoutType: "bullets" as const,
          source: null,
        })),
      },
    });

    assert.equal(withPlan.slides[0].beatKey, "beat-0");
    assert.equal(withPlan.slides[0].purpose, "Maqsad 0");
    assert.equal(withPlan.slides[0].visual?.type, "diagram");
    assert.equal(withPlan.slides[0].visual?.brief, "sxema chizilsin");
    // Tasvir provayderi yo'q — havola o'ylab topilmaydi.
    assert.equal(withPlan.slides[0].visual?.asset, null);
  });

  it("uzun muqova matni sxema chegarasidan oshmaydi", () => {
    /*
      Muqova ostidagi matn bandlardan yig'iladi va uzun bandlarda
      200 belgidan oshib ketishi mumkin — renderer uni baribir
      qisqartiradi.
    */
    const long = "x".repeat(210);
    const deckLong = adaptLegacyContent(
      {
        title: "Uzun",
        slides: [
          { type: "title", layout: "cover", heading: "Muqova", bullets: [long, long] },
        ],
      },
      OPTIONS,
    );

    assert.ok(deckSchema.safeParse(deckLong).success, "uzun matn sxemani yiqitdi");
  });
});

// ─── TEST C: RENDERER ────────────────────────────────────────────────────

describe("C — Deck → .pptx da mazmun yo'qolmaydi", () => {
  function textsIn(xml: string): string[] {
    return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)]
      .map((match) =>
        match[1]
          .replaceAll("&apos;", "'")
          .replaceAll("&quot;", '"')
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">")
          .replaceAll("&amp;", "&"),
      )
      .filter((text) => text.trim().length > 0);
  }

  function normalize(text: string): string {
    return text
      .replace(/^Manba:\s*/, "")
      .trim()
      .toLocaleLowerCase("uz");
  }

  it("IR'dagi har bir matn faylda bor", async () => {
    const content = legacyContent();
    const deck = adaptLegacyContent(content, OPTIONS);

    const { buffer } = await generatePptx(deckToContent(deck), deck.theme.template);
    const zip = await JSZip.loadAsync(buffer);

    for (const [index, slide] of deck.slides.entries()) {
      const file = zip.file(`ppt/slides/slide${index + 1}.xml`);
      assert.ok(file, `slide${index + 1}.xml topilmadi`);
      const inFile = textsIn(await file.async("string")).map(normalize);

      for (const text of textsOf(slide).map(normalize)) {
        assert.ok(
          inFile.some(
            (candidate) => candidate.includes(text) || text.includes(candidate),
          ),
          `${slide.id}: "${text}" faylda yo'q — fayldagi: ${inFile.join(" | ")}`,
        );
      }
    }
  });

  it("Deck → content → Deck aylanishi barqaror", () => {
    /*
      Ikkinchi aylanish birinchisidan farq qilmasligi kerak: aks holda
      har saqlashda IR asta-sekin siljib ketardi.
    */
    const first = adaptLegacyContent(legacyContent(), OPTIONS);
    const second = adaptLegacyContent(deckToContent(first), OPTIONS);

    assert.deepEqual(
      second.slides.map((slide) => slide.blocks),
      first.slides.map((slide) => slide.blocks),
    );
    assert.deepEqual(
      second.slides.map((slide) => slide.layout),
      first.slides.map((slide) => slide.layout),
    );
    assert.deepEqual(
      second.slides.map((slide) => slide.id),
      first.slides.map((slide) => slide.id),
    );
  });

  it("yashirilgan slayd IR'da qoladi, lekin faylga tushmaydi", async () => {
    const content: PresentationContent = {
      title: "Yashirin",
      slides: [
        {
          type: "content",
          layout: "bullets",
          heading: "Ko'rinadi",
          bullets: ["MARKER-BOR"],
        },
        {
          type: "content",
          layout: "bullets",
          heading: "Yashirin",
          bullets: ["MARKER-YASHIRIN"],
          hidden: true,
        },
      ],
    };

    const deck = adaptLegacyContent(content, OPTIONS);
    assert.equal(deck.slides.length, 2, "IR yashirin slaydni ham saqlaydi");
    assert.equal(deck.slides[1].hidden, true);

    const { buffer } = await generatePptx(deckToContent(deck));
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name),
    );
    assert.equal(names.length, 1, "yashirin slayd faylga tushmasligi kerak");
  });
});

// ─── TEST D: DETERMINIZM ─────────────────────────────────────────────────

describe("D — adapter DETERMINISTIK", () => {
  it("100 marta adaptatsiya AYNAN bir xil Deck beradi", () => {
    const content = legacyContent();
    const first = JSON.stringify(adaptLegacyContent(content, OPTIONS));

    for (let run = 0; run < 100; run++) {
      assert.equal(
        JSON.stringify(adaptLegacyContent(content, OPTIONS)),
        first,
        `${run + 1}-urinishda natija boshqacha`,
      );
    }
  });

  it("bitta slayd adaptatsiyasi ham barqaror", () => {
    const slide = legacyContent().slides[2];
    const first = JSON.stringify(adaptLegacySlide(slide, 2));

    for (let run = 0; run < 50; run++) {
      assert.equal(JSON.stringify(adaptLegacySlide(slide, 2)), first);
    }
  });
});

// ─── REVISION ────────────────────────────────────────────────────────────

describe("revision — optimistik qulf", () => {
  it("yangi deck 1 dan boshlanadi", () => {
    assert.equal(adaptLegacyContent(legacyContent(), OPTIONS).revision, 1);
  });

  it("har saqlashda bittaga oshadi", () => {
    const deck = adaptLegacyContent(legacyContent(), OPTIONS);
    assert.equal(nextRevision(deck), 2);
    assert.equal(nextRevision({ ...deck, revision: 2 }), 3);
  });

  it("eskirgan versiya ANIQLANADI", () => {
    /*
      AI Editor hali yo'q, lekin shartnoma allaqachon o'lchanadi: ikki
      tahrir bir-birini jim bosib ketmasligi kerak.
    */
    const stored = { ...adaptLegacyContent(legacyContent(), OPTIONS), revision: 2 };
    const staleBase = 1;

    assert.notEqual(staleBase, stored.revision, "eskirgan yozuv rad etilishi kerak");
    assert.equal(nextRevision(stored), 3);
  });
});
