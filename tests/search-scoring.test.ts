import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateJaccardSimilarity, calculateHybridScore } from "../lib/search/scoring";

describe("search scoring & hybrid ranker", () => {
  it("matnlar o'xshashligini to'g'ri hisoblaydi", () => {
    const sim1 = calculateJaccardSimilarity(
      "oddiy kasrlar",
      "oddiy kasrlar va aralash sonlar",
    );
    assert.ok(sim1 > 0.4);

    const sim2 = calculateJaccardSimilarity("fotosintez", "Nyuton qonunlari mexanika");
    assert.equal(sim2, 0);
  });

  it("aniq mavzu va fan/sinf mos kelganda yuqori ball beradi", () => {
    const res = calculateHybridScore({
      queryTopic: "kasrlar",
      keywords: ["kasrlar", "qo'shish"],
      detectedSubject: "Matematika",
      detectedGrade: "5-sinf",
      detectedIntent: "lesson_plan",
      candidateTopicName: "ODDIY KASRLARNI QO'SHISH VA AYIRISH",
      candidateDescription:
        "Bir xil maxrajli oddiy kasrlarni qo'shish va ayirish amallari.",
      candidateSubject: "Matematika",
      candidateGrade: "5-sinf",
      candidateExpectedHours: 18,
      candidateExpectedOutcomes: [
        "oddiy kasrlarni qo'shish va ayirish amallarini bajaradi",
      ],
    });

    assert.ok(res.totalScore > 0.7, `Kutilgan ball > 0.7, olindi: ${res.totalScore}`);
    assert.equal(res.exactMatch, 1.0);
    assert.equal(res.gradeSubjectMatch, 1.0);
  });

  it("fan yoki sinf mos kelmaganda ball pasayadi", () => {
    const res = calculateHybridScore({
      queryTopic: "kasrlar",
      keywords: ["kasrlar"],
      detectedSubject: "Biologiya",
      detectedGrade: "9-sinf",
      detectedIntent: "explain",
      candidateTopicName: "ODDIY KASRLAR",
      candidateDescription: "Kasrlar haqida",
      candidateSubject: "Matematika",
      candidateGrade: "5-sinf",
      candidateExpectedHours: 10,
      candidateExpectedOutcomes: [],
    });

    assert.ok(res.totalScore < 0.6, `Kutilgan ball < 0.6, olindi: ${res.totalScore}`);
    assert.equal(res.gradeSubjectMatch, 0);
  });
});
