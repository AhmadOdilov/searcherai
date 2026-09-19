import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STORYLINE_ARCHETYPES,
  minimumSlideCount,
  naturalSlideCount,
  planStoryline,
  slideTypeForBeat,
  type StorylineArchetype,
} from "../lib/presentations/storyline";

/**
 * HIKOYA REJASI sinovlari.
 *
 * Eng muhim shart: `planStoryline` HAR DOIM so'ralgan sondagi beat
 * qaytarishi kerak. Foydalanuvchi "10 ta slayd" desa, 9 ta beat
 * qaytsa — u 9 slaydli prezentatsiya oladi va buni faqat natijani
 * sanab bilish mumkin bo'lardi.
 */

describe("planStoryline — slaydlar soni", () => {
  it("har bir arxetip uchun 5 dan 15 gacha AYNAN so'ralgan sonni beradi", () => {
    for (const archetype of STORYLINE_ARCHETYPES) {
      for (let count = 5; count <= 15; count++) {
        const beats = planStoryline(archetype, count);
        assert.equal(
          beats.length,
          count,
          `${archetype} / ${count}: ${beats.length} ta beat qaytdi`,
        );
      }
    }
  });

  it("arxetip tabiiy uzunligidan kam so'ralsa ham sonni bajaradi", () => {
    // Investorda 10 ta beat bor; 5 ta slayd so'ralsa qisqarishi kerak.
    const beats = planStoryline("investor", 5);
    assert.equal(beats.length, 5);
  });

  it("majburiy beatlar sonidan kam so'ralsa ham yiqilmaydi", () => {
    for (const archetype of STORYLINE_ARCHETYPES) {
      const minimum = minimumSlideCount(archetype);
      const beats = planStoryline(archetype, Math.max(2, minimum - 2));
      assert.ok(beats.length > 0, `${archetype}: bo'sh reja`);
    }
  });
});

describe("planStoryline — tuzilma", () => {
  it("birinchi beat HAR DOIM muqova", () => {
    for (const archetype of STORYLINE_ARCHETYPES) {
      assert.equal(planStoryline(archetype, 8)[0].key, "cover");
    }
  });

  it("oxirgi beat yakunlovchi rolda", () => {
    for (const archetype of STORYLINE_ARCHETYPES) {
      const beats = planStoryline(archetype, naturalSlideCount(archetype));
      assert.equal(
        beats[beats.length - 1].role,
        "close",
        `${archetype}: oxirgi beat yakunlovchi emas`,
      );
    }
  });

  it("qisqartirilganda ham yakunlovchi beat SAQLANADI", () => {
    // Bu jim buziladigan narsa: ixtiyoriylarni oxiridan tushirsak,
    // yakun ham tushib ketishi mumkin edi.
    for (const archetype of STORYLINE_ARCHETYPES) {
      for (let count = 3; count <= 7; count++) {
        const beats = planStoryline(archetype, count);
        assert.equal(
          beats[beats.length - 1].role,
          "close",
          `${archetype} / ${count}: yakun yo'qoldi`,
        );
      }
    }
  });

  it("majburiy beatlar tabiiy uzunlikda tushmaydi", () => {
    for (const archetype of STORYLINE_ARCHETYPES) {
      const beats = planStoryline(archetype, naturalSlideCount(archetype));
      const keys = new Set(beats.map((beat) => beat.key));
      // Tabiiy uzunlikda hamma beat bo'lishi kerak.
      assert.equal(keys.size, naturalSlideCount(archetype));
    }
  });

  it("kengaytirilganda hikoya TARTIBI buzilmaydi", () => {
    /*
      Takrorlangan beat aslining ORTIDAN turishi kerak. Aks holda
      "Muammo → Yechim → Muammo" kabi sakrash chiqardi.
    */
    const beats = planStoryline("investor", 14);
    const firstSolution = beats.findIndex((beat) => beat.key === "solution");
    const lastProblem = beats.map((beat) => beat.key).lastIndexOf("problem");
    assert.ok(
      lastProblem < firstSolution,
      "takrorlangan 'problem' yechimdan keyin qolib ketdi",
    );
  });

  it("takrorlangan beatlar qism raqamini oladi", () => {
    const beats = planStoryline("report", 12);
    const repeated = beats.filter((beat) => beat.parts > 1);
    assert.ok(repeated.length > 0, "12 slaydda takrorlanish bo'lishi kerak");
    for (const beat of repeated) {
      assert.ok(beat.part >= 1 && beat.part <= beat.parts);
    }
  });

  it("bir xil kirish — bir xil natija (deterministik)", () => {
    for (const archetype of STORYLINE_ARCHETYPES) {
      const first = planStoryline(archetype, 9).map((beat) => `${beat.key}#${beat.part}`);
      const second = planStoryline(archetype, 9).map(
        (beat) => `${beat.key}#${beat.part}`,
      );
      assert.deepEqual(first, second);
    }
  });
});

describe("planStoryline — arxetip mazmuni", () => {
  const expectations: Record<StorylineArchetype, string[]> = {
    educational: ["question", "concept", "how-it-works", "example", "summary"],
    investor: ["problem", "solution", "market", "business-model", "ask"],
    business: ["context", "problem", "insight", "solution", "next-steps"],
    report: ["executive-summary", "data", "findings", "analysis", "recommendations"],
  };

  for (const [archetype, required] of Object.entries(expectations)) {
    it(`${archetype} arxetipi kutilgan bosqichlarni o'z ichiga oladi`, () => {
      const beats = planStoryline(
        archetype as StorylineArchetype,
        naturalSlideCount(archetype as StorylineArchetype),
      );
      const keys = beats.map((beat) => beat.key);
      for (const key of required) {
        assert.ok(keys.includes(key), `${archetype}: "${key}" yo'q`);
      }
    });
  }

  it("investor arxetipi AYNAN 10 slaydda to'liq ishlaydi", () => {
    // Foydalanuvchi test holati №2 — "exactly 10 slides for investors".
    const beats = planStoryline("investor", 10);
    assert.equal(beats.length, 10);
    assert.equal(beats[0].key, "cover");
    assert.equal(beats[9].key, "ask");
  });

  it("report arxetipi 7 slaydda to'liq ishlaydi", () => {
    // Foydalanuvchi test holati №4 — "7-slide quarterly business report".
    const beats = planStoryline("report", 7);
    assert.equal(beats.length, 7);
    assert.deepEqual(
      beats.map((beat) => beat.key),
      [
        "cover",
        "executive-summary",
        "data",
        "findings",
        "analysis",
        "implications",
        "recommendations",
      ],
    );
  });
});

describe("slideTypeForBeat", () => {
  it("birinchi — title, oxirgi — summary, qolgani content", () => {
    assert.equal(slideTypeForBeat(0, 8), "title");
    assert.equal(slideTypeForBeat(7, 8), "summary");
    assert.equal(slideTypeForBeat(3, 8), "content");
  });
});
