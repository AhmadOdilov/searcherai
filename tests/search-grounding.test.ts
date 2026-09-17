import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateAndGroundAnswer } from "../lib/search/validator";
import { understandQuery } from "../lib/search/understanding";
import type { RankedCurriculumMatch } from "../lib/search/curriculum-matcher";
import type { SearchAnswer } from "../lib/validations/search";

describe("search validator & grounding guard", () => {
  const dummyAnswer: SearchAnswer = {
    answer: "Kasrlar bir butunning qismlarini ifodalaydi. Ularni qo'shish uchun maxrajlari bir xil bo'lishi shart.",
    keyPoints: ["Surat va maxraj tushunchasi", "Bir xil maxrajli kasrlar", "Aralash sonlar"],
    classroomIdeas: ["Pitsa yoki qog'oz bo'laklari yordamida ko'rsatish", "Interaktiv doskada o'yin"],
  };

  it("o'quv dasturi topilmaganda ungrounded ogohlantirish qo'shadi", () => {
    const understanding = understandQuery("kvant teleportatsiyasi 5-sinf");
    const res = validateAndGroundAnswer(dummyAnswer, understanding, []);

    assert.equal(res.isGrounded, false);
    assert.ok(res.caution?.includes("rasmiy o'quv dasturidan topilmadi"));
    assert.equal(res.sourceCitations.length, 0);
  });

  it("yuqori balli o'quv dasturi topilganda isGrounded true bo'ladi va citation saqlanadi", () => {
    const understanding = understandQuery("5-sinf matematika kasrlar");
    const matches: RankedCurriculumMatch[] = [
      {
        topicName: "ODDIY KASRLAR",
        description: "Oddiy kasrlar haqida",
        expectedHours: 16,
        expectedOutcomes: ["kasrlarni qo'shadi"],
        source: "https://uzbmb.uz/math.pdf",
        score: 0.85,
        scoreBreakdown: {
          exactMatch: 1,
          semanticSimilarity: 0.8,
          outcomeMatch: 0.9,
          gradeSubjectMatch: 1,
          intentMatch: 1,
        },
      },
    ];

    const res = validateAndGroundAnswer(dummyAnswer, understanding, matches);

    assert.equal(res.isGrounded, true);
    assert.equal(res.groundingScore, 0.85);
    assert.equal(res.sourceCitations.length, 1);
    assert.equal(res.sourceCitations[0].topicName, "ODDIY KASRLAR");
  });
});
