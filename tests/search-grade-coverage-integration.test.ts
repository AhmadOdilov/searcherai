import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { understandQuery } from "../lib/search/understanding";
import { validateAndGroundAnswer, isOfficiallyVerified } from "../lib/search/validator";
import type { RankedCurriculumMatch } from "../lib/search/curriculum-matcher";
import type { SearchAnswer } from "../lib/validations/search";

/*
  V6 PHASE 3 — qamrovsiz sinf uchun ehtiyot xabari.

  Bazaga ulanmasdan tekshiriladi: retrieval bo'sh natija qaytargan holatda
  validator TO'G'RI sababni ko'rsatishi kerak — "fan yo'q" emas, "bu SINF
  raqamlashtirilmagan", va qaysi sinflar mavjudligini aytishi kerak.
*/

const ANSWER: SearchAnswer = {
  answer:
    "Mavzu bosqichma-bosqich tushuntiriladi va amaliy mashqlar bilan mustahkamlanadi.",
  keyPoints: ["Asosiy tushuncha", "Amaliy misol", "Tipik xatolar"],
  classroomIdeas: ["Guruhda mashq bajarish", "Doskada birgalikda yechish"],
};

const NO_MATCHES: RankedCurriculumMatch[] = [];

describe("qamrovsiz sinf — ehtiyot va sabab", () => {
  it("1-sinf so'rovida SINF qamrovi aytiladi, fan yo'q deyilmaydi", () => {
    const u = understandQuery("1-sinf matematika sonlarni qo'shish va ayirish");
    const g = validateAndGroundAnswer(ANSWER, u, NO_MATCHES);

    assert.equal(g.isAbstained, true);
    assert.equal(g.isGrounded, false);
    assert.equal(isOfficiallyVerified(g, NO_MATCHES.length), false);
    assert.match(g.caution ?? "", /1-sinf/);
    assert.match(g.caution ?? "", /5-sinf/, "mavjud sinflar ko'rsatilishi kerak");
    assert.doesNotMatch(
      g.caution ?? "",
      /kiritilmagan\)/,
      "fan yo'q xabari bo'lmasligi kerak",
    );
  });

  it("ruscha so'rovda ham sabab ruscha ko'rsatiladi", () => {
    const u = understandQuery("3 класс математика сложение чисел");
    const g = validateAndGroundAnswer(ANSWER, u, NO_MATCHES);
    assert.match(g.caution ?? "", /оцифрован/);
  });

  it("rasmiy dasturi yo'q FAN uchun sabab boshqacha", () => {
    const u = understandQuery("7-sinf fizika Nyuton qonunlari");
    const g = validateAndGroundAnswer(ANSWER, u, NO_MATCHES);
    assert.equal(g.isAbstained, true);
    assert.match(g.caution ?? "", /Fizika/);
  });

  it("dalilsiz holatda hech qanday iqtibos chiqmaydi", () => {
    const u = understandQuery("2-sinf matematika sonlar va sanash");
    const g = validateAndGroundAnswer(ANSWER, u, NO_MATCHES);
    assert.deepEqual(g.sourceCitations, []);
    assert.equal(g.groundingScore, 0);
  });
});
