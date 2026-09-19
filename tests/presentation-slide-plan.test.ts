import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBrief } from "../lib/presentations/brief";
import {
  allowedContentTypes,
  buildSlidePlan,
  hasNumericEvidence,
} from "../lib/presentations/slide-plan";
import { planStoryline, type ContentType } from "../lib/presentations/storyline";
import type { OutlineSlide } from "../lib/validations/presentation-plan";

/**
 * SLAYD REJASI sinovlari.
 *
 * Bu bosqich AI tanlovini TEKSHIRADI. Uning eng muhim vazifasi —
 * manbasiz raqamli maketlarni to'sish: aks holda model bozor hajmi
 * yoki foizlarni o'ylab topadi va ular slaydda ishonchli ko'rinadi.
 */

function briefFor(topic: string) {
  return buildBrief({ topic, language: "UZ" });
}

function outlineFor(
  keys: string[],
  contentType: ContentType = "bullets",
): OutlineSlide[] {
  return keys.map((key, index) => ({
    beatKey: key,
    heading: `Sarlavha ${index + 1}`,
    keyMessage: `Asosiy fikr ${index + 1}`,
    contentType,
  }));
}

const OPEN_ALL = new Set<ContentType>([
  "statement",
  "bullets",
  "cards",
  "steps",
  "comparison",
  "statistic",
  "chart",
  "quote",
]);

describe("allowedContentTypes", () => {
  it("manba yo'q bo'lsa raqamli shakllarni TAQIQLAYDI", () => {
    const allowed = allowedContentTypes({
      researchAvailable: false,
      sourceText: "Sun'iy intellekt haqida",
    });
    assert.equal(allowed.has("statistic"), false);
    assert.equal(allowed.has("chart"), false);
    // Qolganlari ochiq qoladi.
    assert.equal(allowed.has("bullets"), true);
    assert.equal(allowed.has("cards"), true);
  });

  it("tadqiqot provayderi ulangan bo'lsa raqamli shakllarni ochadi", () => {
    const allowed = allowedContentTypes({
      researchAvailable: true,
      sourceText: "Sun'iy intellekt haqida",
    });
    assert.equal(allowed.has("statistic"), true);
    assert.equal(allowed.has("chart"), true);
  });

  it("foydalanuvchining O'ZI raqam bergan bo'lsa ochadi", () => {
    const allowed = allowedContentTypes({
      researchAvailable: false,
      sourceText: "Savdo 2024-yilda 35% o'sdi, 12 mln so'm daromad",
    });
    assert.equal(allowed.has("chart"), true);
  });
});

describe("hasNumericEvidence", () => {
  it("o'lchovli raqamlarni tanidi", () => {
    assert.equal(hasNumericEvidence("o'sish 35%"), true);
    assert.equal(hasNumericEvidence("12 mln foydalanuvchi"), true);
    assert.equal(hasNumericEvidence("daromad $500000"), true);
    assert.equal(hasNumericEvidence("1, 2 va 3-chorak natijalari"), true);
  });

  it("yolg'iz yilni ma'lumot deb hisoblamaydi", () => {
    assert.equal(hasNumericEvidence("2024 yil hisoboti"), false);
    assert.equal(hasNumericEvidence("Fotosintez jarayoni"), false);
  });
});

describe("buildSlidePlan — tuzilma", () => {
  it("beatlar soniga TENG reja qaytaradi", () => {
    const brief = briefFor("Sun'iy intellekt");
    const beats = planStoryline(brief.archetype, 8);
    const plan = buildSlidePlan(brief, beats, outlineFor(beats.map((b) => b.key)), {
      allowed: OPEN_ALL,
    });
    assert.equal(plan.length, 8);
  });

  it("muqova HAR DOIM bitta kuchli jumla", () => {
    const brief = briefFor("Sun'iy intellekt");
    const beats = planStoryline(brief.archetype, 8);
    // Model muqovaga kartalar so'ragan bo'lsa ham.
    const outline = outlineFor(
      beats.map((b) => b.key),
      "cards",
    );
    const plan = buildSlidePlan(brief, beats, outline, { allowed: OPEN_ALL });

    assert.equal(plan[0].contentType, "statement");
    assert.equal(plan[0].slideType, "title");
  });

  it("identifikatorlar noyob va barqaror", () => {
    const brief = briefFor("Sun'iy intellekt");
    const beats = planStoryline(brief.archetype, 12);
    const outline = outlineFor(beats.map((b) => b.key));

    const first = buildSlidePlan(brief, beats, outline, { allowed: OPEN_ALL });
    const second = buildSlidePlan(brief, beats, outline, { allowed: OPEN_ALL });

    assert.deepEqual(
      first.map((slide) => slide.id),
      second.map((slide) => slide.id),
    );
    assert.equal(new Set(first.map((slide) => slide.id)).size, first.length);
  });

  it("skelet boshqa TARTIBDA kelsa ham beat bo'yicha moslashtiradi", () => {
    const brief = briefFor("Sun'iy intellekt");
    const beats = planStoryline(brief.archetype, 8);
    const keys = beats.map((beat) => beat.key);

    const shuffled = outlineFor([...keys].reverse());
    // Sarlavhalarni kalitga bog'laymiz — moslashtirishni tekshirish uchun.
    for (const slide of shuffled) slide.heading = `H-${slide.beatKey}`;

    const plan = buildSlidePlan(brief, beats, shuffled, { allowed: OPEN_ALL });

    for (const [index, beat] of beats.entries()) {
      assert.equal(
        plan[index].heading,
        `H-${beat.key}`,
        `${beat.key}: noto'g'ri slayd moslashtirildi`,
      );
    }
  });
});

describe("buildSlidePlan — mazmun shaklini tekshirish", () => {
  it("taqiqlangan raqamli shaklni ALMASHTIRADI", () => {
    const brief = briefFor("Sun'iy intellekt");
    const beats = planStoryline(brief.archetype, 8);
    const outline = outlineFor(
      beats.map((b) => b.key),
      "chart",
    );

    const allowed = allowedContentTypes({
      researchAvailable: false,
      sourceText: "Sun'iy intellekt",
    });
    const plan = buildSlidePlan(brief, beats, outline, { allowed });

    for (const slide of plan) {
      assert.notEqual(slide.contentType, "chart", `${slide.id}: chart o'tib ketdi`);
      assert.notEqual(
        slide.contentType,
        "statistic",
        `${slide.id}: statistic o'tib ketdi`,
      );
    }
    // Almashtirish YOZIB QO'YILADI — diagnostika uchun.
    assert.ok(plan.slice(1).some((slide) => slide.adjustedFrom === "chart"));
  });

  it("ketma-ket UCHTA bir xil shaklga yo'l qo'ymaydi", () => {
    const brief = briefFor("Sun'iy intellekt");
    const beats = planStoryline(brief.archetype, 10);
    const outline = outlineFor(
      beats.map((b) => b.key),
      "bullets",
    );
    const plan = buildSlidePlan(brief, beats, outline, { allowed: OPEN_ALL });

    for (let index = 2; index < plan.length; index++) {
      const three =
        plan[index].contentType === plan[index - 1].contentType &&
        plan[index].contentType === plan[index - 2].contentType;
      assert.equal(three, false, `${index}-slaydda uchta bir xil shakl ketma-ket`);
    }
  });

  it("yakuniy slaydga mos kelmaydigan shaklni almashtiradi", () => {
    const brief = briefFor("Sun'iy intellekt");
    const beats = planStoryline(brief.archetype, 8);
    const outline = outlineFor(
      beats.map((b) => b.key),
      "quote",
    );
    const plan = buildSlidePlan(brief, beats, outline, { allowed: OPEN_ALL });

    const last = plan[plan.length - 1];
    assert.equal(last.slideType, "summary");
    assert.notEqual(last.contentType, "quote");
  });
});

describe("buildSlidePlan — vizual reja", () => {
  it("muqovaga tasvir topshirig'i beriladi", () => {
    const brief = briefFor("Sun'iy intellekt");
    const beats = planStoryline(brief.archetype, 8);
    const plan = buildSlidePlan(brief, beats, outlineFor(beats.map((b) => b.key)), {
      allowed: OPEN_ALL,
    });

    assert.equal(plan[0].visual.visualType, "generated_image");
    assert.ok(plan[0].visual.visualBrief.length > 20, "topshiriq juda qisqa");
  });

  it("tasvir kerak bo'lmagan slaydda topshiriq BO'SH", () => {
    // Bo'sh bo'lmasa, keyingi bosqichda yo'q narsaga so'rov ketardi.
    const brief = briefFor("Sun'iy intellekt");
    const beats = planStoryline(brief.archetype, 8);
    const plan = buildSlidePlan(brief, beats, outlineFor(beats.map((b) => b.key)), {
      allowed: OPEN_ALL,
    });

    for (const slide of plan) {
      if (slide.visual.visualType !== "none") continue;
      assert.equal(
        slide.visual.visualBrief,
        "",
        `${slide.id}: tasvir yo'q, lekin topshiriq bor`,
      );
    }
  });

  it("zichlik chegaralari mazmun turiga qarab FARQ qiladi", () => {
    const brief = briefFor("Sun'iy intellekt");
    const beats = planStoryline(brief.archetype, 8);
    const plan = buildSlidePlan(brief, beats, outlineFor(beats.map((b) => b.key)), {
      allowed: OPEN_ALL,
    });

    // Muqova (statement) da bandlar bo'lmaydi.
    assert.equal(plan[0].density.maxBullets, 0);

    const bulletSlide = plan.find((slide) => slide.contentType === "bullets");
    assert.ok(bulletSlide, "bandlar slaydi topilmadi");
    assert.ok(bulletSlide.density.maxBullets >= 3);
  });

  it("yosh auditoriya uchun chegaralar QISQARADI", () => {
    const young = buildBrief({
      topic: "Fotosintezni 10 yoshli bolalarga tushuntir",
      language: "UZ",
    });
    const adult = buildBrief({ topic: "Fotosintezni tushuntir", language: "UZ" });

    const youngBeats = planStoryline(young.archetype, 8);
    const adultBeats = planStoryline(adult.archetype, 8);

    const youngPlan = buildSlidePlan(
      young,
      youngBeats,
      outlineFor(youngBeats.map((b) => b.key)),
      { allowed: OPEN_ALL },
    );
    const adultPlan = buildSlidePlan(
      adult,
      adultBeats,
      outlineFor(adultBeats.map((b) => b.key)),
      { allowed: OPEN_ALL },
    );

    assert.ok(
      youngPlan[1].density.maxBulletChars < adultPlan[1].density.maxBulletChars,
      "yosh auditoriya uchun band uzunligi qisqarishi kerak",
    );
  });
});
