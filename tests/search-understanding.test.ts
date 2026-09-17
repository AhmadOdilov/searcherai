import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { understandQuery } from "../lib/search/understanding";

describe("search understanding — query extraction", () => {
  it("8-sinf biologiya fotosintez savolini to'liq tahlil qiladi", () => {
    const res = understandQuery("8-sinf biologiya fotosintez mavzusini tushuntir");

    assert.equal(res.detectedSubject, "Biologiya");
    assert.equal(res.detectedGrade, "8-sinf");
    assert.equal(res.detectedIntent, "explain");
    assert.equal(res.audience, "teacher");
    assert.equal(res.detectedLanguage, "UZ");
    assert.ok(res.extractedTopic.includes("fotosintez"));
  });

  it("dars ishlanmasi intentini taniydi", () => {
    const res = understandQuery("7-sinf matematika kasrlar bo'yicha 45 minutlik dars ishlanmasi");

    assert.equal(res.detectedSubject, "Matematika");
    assert.equal(res.detectedGrade, "7-sinf");
    assert.equal(res.detectedIntent, "lesson_plan");
    assert.equal(res.audience, "teacher");
    assert.ok(res.extractedTopic.includes("kasrlar"));
  });

  it("prezentatsiya intentini taniydi", () => {
    const res = understandQuery("fizika Nyuton qonunlari bo'yicha slaydlar tayyorlash");

    assert.equal(res.detectedSubject, "Fizika");
    assert.equal(res.detectedIntent, "presentation");
  });

  it("test/quiz intentini taniydi", () => {
    const res = understandQuery("ona tili 6-sinf ot so'z turkumi bo'yicha 10 ta test");

    assert.equal(res.detectedSubject, "Ona tili");
    assert.equal(res.detectedGrade, "6-sinf");
    assert.equal(res.detectedIntent, "quiz_test");
  });

  it("rus tilidagi so'rovni va uning intentini taniydi", () => {
    const res = understandQuery("план урока по математике для 5 класса дроби");

    assert.equal(res.detectedLanguage, "RU");
    assert.equal(res.detectedSubject, "Matematika");
    assert.equal(res.detectedGrade, "5-sinf");
    assert.equal(res.detectedIntent, "lesson_plan");
  });

  it("qo'lda kiritilgan parametrlar avtomatik aniqlashdan ustun turadi", () => {
    const res = understandQuery("fotosintez nima?", "Biologiya", "6-sinf", "UZ");

    assert.equal(res.detectedSubject, "Biologiya");
    assert.equal(res.detectedGrade, "6-sinf");
    assert.equal(res.detectedLanguage, "UZ");
  });
});
