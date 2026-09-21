import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBrief } from "../lib/presentations/brief";
import {
  allowedContentTypes,
  buildSlidePlan,
  type SlideBlueprint,
} from "../lib/presentations/slide-plan";
import { planStoryline } from "../lib/presentations/storyline";
import { layoutForContentType } from "../lib/presentations/layout-engine";
import { compressSlide } from "../lib/presentations/density";
import {
  buildContentUserPrompt,
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
} from "../lib/presentations/stage-prompts";
import {
  outlineSchemaFor,
  plannedSlideSchema,
} from "../lib/validations/presentation-plan";
import { slideSchema, type Slide } from "../lib/validations/presentation";

/**
 * PHASE 2 TEST HOLATLARI — foydalanuvchi spetsifikatsiyasidan.
 *
 * ── Nega AI chaqirilmaydi ─────────────────────────────────────────────────
 * Tekshirilayotgan narsa — AI matni emas, QUVURNING DETERMINISTIK
 * QISMI: slaydlar soni, hikoya tuzilmasi, maket tanlovi, zichlik.
 * Aynan shular foydalanuvchi so'rovini bajarishi yoki buzishi mumkin,
 * va aynan shular AI'siz to'liq tekshirilishi mumkin.
 *
 * Model javobi o'rniga skeletning haqiqiy shakli qo'yiladi — u sxema
 * bilan tekshiriladi, ya'ni soxta emas: real model ham aynan shu
 * shaklni qaytarishi shart.
 */

/** Skeletni model qaytargandek yasaydi — sxemadan o'tishi tekshiriladi. */
function fakeOutlineFor(topic: string, language: "UZ" = "UZ") {
  const brief = buildBrief({ topic, language });
  const beats = planStoryline(brief.archetype, brief.slideCount.value);

  const outline = {
    title: topic.slice(0, 120),
    archetype: brief.archetype,
    slides: beats.map((beat, index) => ({
      beatKey: beat.key,
      heading: `Sarlavha ${index + 1}`,
      keyMessage: `${beat.purpose} uchun asosiy fikr.`,
      contentType: beat.suggested,
    })),
  };

  // Skelet HAQIQIY sxemadan o'tishi shart — aks holda sinov bo'sh ishlaydi.
  const parsed = outlineSchemaFor(beats.length).safeParse(outline);
  assert.ok(parsed.success, `skelet sxemadan o'tmadi: ${parsed.error?.message}`);

  return { brief, beats, outline: parsed.data };
}

/** Model matnini rejaga mos yasaydi. */
function fakeContent(blueprints: SlideBlueprint[]): Slide[] {
  return blueprints.map((blueprint) => {
    const base: Slide = {
      type: blueprint.slideType,
      heading: blueprint.heading,
      bullets: [],
      keyMessage: blueprint.keyMessage,
    };

    switch (blueprint.contentType) {
      case "bullets":
        return { ...base, bullets: ["Birinchi fikr", "Ikkinchi fikr", "Uchinchi fikr"] };
      case "cards":
        return {
          ...base,
          cards: [
            { title: "Birinchi", body: "Tavsif" },
            { title: "Ikkinchi", body: "Tavsif" },
            { title: "Uchinchi", body: "Tavsif" },
          ],
        };
      case "steps":
        return {
          ...base,
          steps: [
            { label: "Bosqich 1", body: "Tavsif" },
            { label: "Bosqich 2", body: "Tavsif" },
            { label: "Bosqich 3", body: "Tavsif" },
          ],
        };
      case "comparison":
        return {
          ...base,
          comparison: {
            leftTitle: "Chap",
            leftItems: ["A"],
            rightTitle: "O'ng",
            rightItems: ["B"],
          },
        };
      case "quote":
        return {
          ...base,
          quote: { text: "Bu yetarlicha uzun iqtibos matni.", author: "Muallif" },
        };
      case "statistic":
        return { ...base, statistic: { value: "35%", caption: "O'sish" } };
      case "chart":
        return {
          ...base,
          chart: {
            kind: "bar",
            categories: ["A", "B"],
            series: [{ name: "Qator", values: [1, 2] }],
          },
        };
      case "statement":
        return base;
    }
  });
}

/** Quvurning deterministik qismini to'liq o'tkazadi. */
function runPipeline(topic: string) {
  const { brief, beats, outline } = fakeOutlineFor(topic);
  const allowed = allowedContentTypes({
    researchAvailable: false,
    sourceText: topic,
  });
  const blueprints = buildSlidePlan(brief, beats, outline.slides, { allowed });
  const generated = fakeContent(blueprints);

  const slides = blueprints.map((blueprint, index) => {
    const compressed = compressSlide(generated[index], blueprint.density);
    return {
      ...compressed,
      layout: layoutForContentType(
        blueprint.contentType,
        blueprint.slideType,
        compressed,
      ),
    };
  });

  return { brief, beats, blueprints, slides };
}

describe('Phase 2 — test holati 1: "AI haqida prezentatsiya"', () => {
  const result = runPipeline("Sun'iy intellekt haqida prezentatsiya");

  it("mantiqiy slaydlar soni tanlanadi (majburan 10 emas)", () => {
    assert.equal(result.brief.slideCount.source, "scope");
    assert.ok(
      result.slides.length >= 5 && result.slides.length <= 15,
      `son chegaradan chiqdi: ${result.slides.length}`,
    );
  });

  it("hikoya bog'langan: muqova → mazmun → xulosa", () => {
    assert.equal(result.slides[0].type, "title");
    assert.equal(result.slides[result.slides.length - 1].type, "summary");
    for (const slide of result.slides.slice(1, -1)) {
      assert.equal(slide.type, "content");
    }
  });

  it("slaydlar tartibi TASODIFIY emas — hikoya bosqichlariga bog'langan", () => {
    const keys = result.beats.map((beat) => beat.key);
    assert.equal(keys[0], "cover");
    assert.equal(result.beats[result.beats.length - 1].role, "close");
  });
});

describe('Phase 2 — test holati 2: "exactly 10 slides for investors"', () => {
  const result = runPipeline(
    "Create exactly 10 slides about AI startups in Uzbekistan for investors",
  );

  it("AYNAN 10 slayd", () => {
    assert.equal(result.slides.length, 10);
    assert.equal(result.brief.slideCount.source, "explicit");
  });

  it("investor hikoyasi ishlatiladi", () => {
    assert.equal(result.brief.archetype, "investor");
    assert.equal(result.brief.archetypeLocked, true);
  });

  it("slaydlarning vazifalari investor deckiga mos", () => {
    const keys = result.beats.map((beat) => beat.key);
    for (const required of ["problem", "solution", "market", "ask"]) {
      assert.ok(keys.includes(required), `"${required}" bosqichi yo'q`);
    }
    // "Ask" — oxirgi slayd.
    assert.equal(keys[keys.length - 1], "ask");
  });

  it("manba yo'q — raqamli maketlar ISHLATILMAYDI", () => {
    // Investor decki odatda raqamlarga to'la. Aynan shuning uchun
    // bu yerda o'ylab topilgan statistika xavfi eng yuqori.
    for (const slide of result.slides) {
      assert.notEqual(slide.layout, "chart", "manbasiz diagramma chiqdi");
      assert.notEqual(slide.layout, "statistic", "manbasiz statistika chiqdi");
    }
  });
});

describe('Phase 2 — test holati 3: "fotosintez, 12 yoshli o\'quvchilar"', () => {
  const result = runPipeline(
    "Fotosintezni 12 yoshli o'quvchilarga tushuntiruvchi prezentatsiya",
  );

  it("ta'limiy hikoya tanlanadi", () => {
    assert.equal(result.brief.archetype, "educational");
    assert.equal(result.brief.audience, "students");
  });

  it("yosh aniqlanadi va matn QISQARADI", () => {
    assert.equal(result.brief.audienceAge, 12);

    const adult = runPipeline("Fotosintezni tushuntiruvchi prezentatsiya");

    /*
      Taqqoslash BANDLAR slaydida qilinadi: `statement` maketida
      bandlar umuman yo'q (chegara 0) va ikkala tomon ham nolga teng
      bo'lib, sinov hech narsani tekshirmay o'tib ketardi.
    */
    const childLimit = result.blueprints.find(
      (blueprint) => blueprint.contentType === "bullets",
    )?.density.maxBulletChars;
    const adultLimit = adult.blueprints.find(
      (blueprint) => blueprint.contentType === "bullets",
    )?.density.maxBulletChars;

    assert.ok(childLimit !== undefined && childLimit > 0, "bandlar slaydi topilmadi");
    assert.ok(adultLimit !== undefined && adultLimit > 0, "bandlar slaydi topilmadi");
    assert.ok(childLimit < adultLimit, `${childLimit} >= ${adultLimit}`);
  });

  it("vizual g'oyalar rejalashtiriladi", () => {
    const withVisual = result.blueprints.filter(
      (blueprint) => blueprint.visual.visualType !== "none",
    );
    assert.ok(withVisual.length > 0, "birorta vizual reja yo'q");
    for (const blueprint of withVisual) {
      assert.ok(blueprint.visual.visualBrief.length > 10);
    }
  });
});

describe('Phase 2 — test holati 4: "7 slaydli chorak hisoboti"', () => {
  const result = runPipeline("a 7-slide quarterly business report");

  it("AYNAN 7 slayd", () => {
    assert.equal(result.slides.length, 7);
  });

  it("hisobot hikoyasi ishlatiladi", () => {
    assert.equal(result.brief.archetype, "report");
    const keys = result.beats.map((beat) => beat.key);
    assert.deepEqual(keys, [
      "cover",
      "executive-summary",
      "data",
      "findings",
      "analysis",
      "implications",
      "recommendations",
    ]);
  });
});

describe("Phase 2 — umumiy kafolatlar", () => {
  const topics = [
    "Sun'iy intellekt haqida prezentatsiya",
    "Create exactly 10 slides about AI startups in Uzbekistan for investors",
    "Fotosintezni 12 yoshli o'quvchilarga tushuntiruvchi prezentatsiya",
    "a 7-slide quarterly business report",
  ];

  it("har bir slayd SXEMADAN o'tadi", () => {
    for (const topic of topics) {
      for (const slide of runPipeline(topic).slides) {
        const parsed = slideSchema.safeParse(slide);
        assert.ok(
          parsed.success,
          `${topic}: ${JSON.stringify(parsed.error?.issues?.[0])}`,
        );
      }
    }
  });

  it("maket xilma-xil — bir xil maket ketma-ket 3 marta kelmaydi", () => {
    for (const topic of topics) {
      const layouts = runPipeline(topic).slides.map((slide) => slide.layout);
      for (let index = 2; index < layouts.length; index++) {
        const three =
          layouts[index] === layouts[index - 1] && layouts[index] === layouts[index - 2];
        assert.equal(three, false, `${topic}: ${index}-slaydda uchta bir xil maket`);
      }
    }
  });

  it("bir xil so'rov — bir xil natija (takrorlanuvchanlik)", () => {
    for (const topic of topics) {
      const first = runPipeline(topic);
      const second = runPipeline(topic);
      assert.deepEqual(
        first.slides.map((slide) => slide.layout),
        second.slides.map((slide) => slide.layout),
        `${topic}: maketlar har safar boshqacha`,
      );
      assert.deepEqual(
        first.blueprints.map((blueprint) => blueprint.id),
        second.blueprints.map((blueprint) => blueprint.id),
      );
    }
  });

  it("muqova MAKETI hikoyadagi o'rnidan keladi", () => {
    for (const topic of topics) {
      const slides = runPipeline(topic).slides;
      assert.equal(slides[0].layout, "cover");
    }
  });

  /*
    ── P0-2 dan keyin o'zgargan kutilma ───────────────────────────────────
    Ilgari bu yerda `layout === "conclusion"` tekshirilardi va u
    NUQSONNI qulflab qo'ygan edi: `conclusion` amalda `bullets`
    maketning boshqa rangli ko'rinishi, ya'ni faqat bandlarni chizadi.
    Kartali yoki bosqichli xulosa slaydi unga tushsa, mazmuni faylga
    umuman tushmasdi.

    To'g'ri invariant — maket nomi emas, ikki shart: slayd XULOSA
    ekanligi va maketning uning MAZMUNINI chiza olishi.
  */
  it("xulosa slaydi mazmunini chiza oladigan maket oladi", () => {
    const rendersBullets: Array<string | undefined> = ["conclusion", "bullets"];

    for (const topic of topics) {
      const slides = runPipeline(topic).slides;
      const last = slides[slides.length - 1];

      assert.equal(last.type, "summary", `${topic}: oxirgi slayd xulosa emas`);

      if (last.cards && last.cards.length > 0) {
        assert.ok(
          last.layout === "threeCards" || last.layout === "fourCards",
          `${topic}: kartali xulosa "${last.layout}" maketiga tushdi — kartalar yo'qoladi`,
        );
      } else if (last.steps && last.steps.length > 0) {
        assert.ok(
          last.layout === "process" || last.layout === "timeline",
          `${topic}: bosqichli xulosa "${last.layout}" maketiga tushdi`,
        );
      } else {
        assert.ok(
          rendersBullets.includes(last.layout),
          `${topic}: bandli xulosa kutilmagan maket oldi: ${last.layout}`,
        );
      }
    }
  });

  it("slayd shartnomasi SXEMADAN o'tadi", () => {
    const { blueprints, slides } = runPipeline(topics[1]);

    for (const [index, blueprint] of blueprints.entries()) {
      const parsed = plannedSlideSchema.safeParse({
        id: blueprint.id,
        index: blueprint.index,
        beatKey: blueprint.beatKey,
        purpose: blueprint.purpose,
        keyMessage: slides[index].keyMessage ?? "",
        supportingPoints: slides[index].bullets,
        contentType: blueprint.contentType,
        data: null,
        visualConcept: blueprint.visual.rationale,
        visualType: blueprint.visual.visualType,
        visualBrief: blueprint.visual.visualBrief,
        layoutType: slides[index].layout,
        source: null,
      });
      assert.ok(parsed.success, `${blueprint.id}: ${parsed.error?.message}`);
    }
  });
});

describe("Phase 2 — bosqich promptlari", () => {
  it("skelet prompti slaydlar sonini AYNAN aytadi", () => {
    const { brief, beats } = fakeOutlineFor(
      "Create exactly 10 slides about AI startups for investors",
    );
    const prompt = buildOutlineUserPrompt({
      brief,
      beats,
      allowed: allowedContentTypes({ researchAvailable: false, sourceText: "" }),
    });

    assert.match(prompt, /10/);
    // Har bir beat kaliti promptda bo'lishi kerak.
    for (const beat of beats) {
      assert.ok(prompt.includes(`beatKey="${beat.key}"`), `${beat.key} yo'q`);
    }
  });

  it("manba yo'q bo'lsa prompt raqam O'YLAB TOPISHNI taqiqlaydi", () => {
    const { brief, beats } = fakeOutlineFor("Sun'iy intellekt");
    const prompt = buildOutlineUserPrompt({
      brief,
      beats,
      allowed: allowedContentTypes({ researchAvailable: false, sourceText: "AI" }),
    });

    assert.match(prompt, /O'YLAB TOPMA/);
    // Taqiqlangan shakllar ro'yxatda KO'RSATILMAYDI.
    assert.ok(!prompt.includes('"chart" —'), "chart hali ham taklif qilinmoqda");
  });

  it("skelet system prompti uch tilda mavjud", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      const prompt = buildOutlineSystemPrompt(language);
      assert.ok(prompt.length > 300, `${language} juda qisqa`);
      // JSON maydon nomlari har doim inglizcha.
      for (const key of ["beatKey", "heading", "keyMessage", "contentType"]) {
        assert.ok(prompt.includes(`"${key}"`), `${language}: "${key}" yo'q`);
      }
    }
  });

  it("mazmun prompti har bir slayd uchun chegara beradi", () => {
    const { brief, beats, outline } = fakeOutlineFor("Sun'iy intellekt");
    const blueprints = buildSlidePlan(brief, beats, outline.slides, {
      allowed: allowedContentTypes({ researchAvailable: false, sourceText: "AI" }),
    });

    const prompt = buildContentUserPrompt({ brief, blueprints, title: "Sarlavha" });

    for (const blueprint of blueprints) {
      assert.ok(
        prompt.includes(`SLAYD ${blueprint.index + 1}`),
        `${blueprint.id} promptda yo'q`,
      );
    }
    assert.match(prompt, /heading ≤/);
    assert.match(prompt, /O'YLAB TOPMA/);
  });
});
