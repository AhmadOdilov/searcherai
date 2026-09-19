import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CurriculumIngestionPipeline } from "../lib/curriculum/ingestion/pipeline";
import type { IngestionFileInput } from "../lib/curriculum/ingestion/types";

describe("Curriculum Ingestion Pipeline V3 (Phase 23 Automated Quality Tests)", () => {
  const validTopicBase = {
    topicName: "Kvadrat tenglamalar va Viyet teoremasi",
    description: "Kvadrat tenglamalarni yechish usullari va ildizlar bog'liqligi",
    expectedHours: 4,
    expectedOutcomes: ["Kvadrat tenglamani yechadi", "Viyet teoremasini qo'llaydi"],
  };

  it("1. Duplicate topic detection test", () => {
    const fileWithDuplicates: IngestionFileInput = {
      subject: "Matematika",
      grade: "8-sinf",
      source: "https://edurtm.uz/curriculum/matematika-8",
      topics: [
        { ...validTopicBase, topicName: "Oddiy kasrlar" },
        { ...validTopicBase, topicName: "O‘nli kasrlar" },
        { ...validTopicBase, topicName: "Oddiy kasrlar" }, // Duplicate!
      ],
    };

    const result = CurriculumIngestionPipeline.ingestCurriculumFile(fileWithDuplicates);
    assert.strictEqual(result.summary.duplicateTopics, 1);
    assert.strictEqual(result.records.length, 2);
    assert.ok(
      result.summary.issues.some(
        (iss) =>
          iss.field === "topicName" &&
          iss.message.includes("Bir xil bo'lim bir necha marta qaytarilgan"),
      ),
      "Dublikat mavzu ogohlantirilmadi",
    );
  });

  it("2. Missing official source test", () => {
    // 2a. Bo'sh manba
    const valMissing = CurriculumIngestionPipeline.validateTopic(
      validTopicBase,
      "Matematika",
      "8-sinf",
      "",
    );
    assert.strictEqual(valMissing.isValid, false);
    assert.ok(
      valMissing.issues.some((iss) => iss.field === "source" && iss.severity === "ERROR"),
      "Bo'sh manba xatolik deb topilmadi",
    );

    // 2b. URL formatida bo'lmagan manba
    const valBadUrl = CurriculumIngestionPipeline.validateTopic(
      validTopicBase,
      "Matematika",
      "8-sinf",
      "ogzaki aytilgan",
    );
    assert.ok(
      valBadUrl.issues.some((iss) => iss.field === "source"),
      "URL bo'lmagan manba ogohlantirilmadi",
    );
  });

  it("3. Invalid grade and subject test", () => {
    // 3a. Noto'g'ri sinf
    const valBadGrade = CurriculumIngestionPipeline.validateTopic(
      validTopicBase,
      "Matematika",
      "15-sinf-advanced",
      "https://edurtm.uz",
    );
    assert.strictEqual(valBadGrade.isValid, false);
    assert.ok(
      valBadGrade.issues.some((iss) => iss.field === "grade"),
      "Noto'g'ri sinf aniqlanmadi",
    );

    // 3b. Bo'sh fan
    const valBadSubj = CurriculumIngestionPipeline.validateTopic(
      validTopicBase,
      "",
      "8-sinf",
      "https://edurtm.uz",
    );
    assert.strictEqual(valBadSubj.isValid, false);
    assert.ok(
      valBadSubj.issues.some((iss) => iss.field === "subject"),
      "Bo'sh fan aniqlanmadi",
    );

    // 3c. NOT_AVAILABLE statusidagi fan
    const valUnavailSubj = CurriculumIngestionPipeline.validateTopic(
      validTopicBase,
      "Fizika", // Hali rasmiy raqamli o'quv dasturi e'lon qilinmagan
      "8-sinf",
      "https://edurtm.uz",
    );
    assert.strictEqual(valUnavailSubj.isValid, false);
    assert.ok(
      valUnavailSubj.issues.some(
        (iss) => iss.field === "subject" && iss.message.includes("status: NOT_AVAILABLE"),
      ),
      "NOT_AVAILABLE fani to'xtatilmadi",
    );
  });

  it("4. Empty topic name test", () => {
    // 4a. Butunlay bo'sh mavzu nomi
    const valEmpty = CurriculumIngestionPipeline.validateTopic(
      { ...validTopicBase, topicName: "   " },
      "Matematika",
      "8-sinf",
      "https://edurtm.uz",
    );
    assert.strictEqual(valEmpty.isValid, false);
    assert.ok(
      valEmpty.issues.some(
        (iss) => iss.field === "topicName" && iss.message.includes("bo'sh"),
      ),
      "Bo'sh mavzu nomi aniqlanmadi",
    );

    // 4b. Faqat raqamdan iborat mavzu nomi (masalan, sahifa raqami)
    const valDigits = CurriculumIngestionPipeline.validateTopic(
      { ...validTopicBase, topicName: "123" },
      "Matematika",
      "8-sinf",
      "https://edurtm.uz",
    );
    assert.strictEqual(valDigits.isValid, false);
    assert.ok(
      valDigits.issues.some((iss) => iss.field === "topicName"),
      "Faqat raqamli mavzu aniqlanmadi",
    );
  });

  it("5. Negative and impossible hours test", () => {
    // 5a. Manfiy soat
    const valNeg = CurriculumIngestionPipeline.validateTopic(
      { ...validTopicBase, expectedHours: -4 },
      "Matematika",
      "8-sinf",
      "https://edurtm.uz",
    );
    assert.strictEqual(valNeg.isValid, false);
    assert.ok(
      valNeg.issues.some(
        (iss) =>
          iss.field === "expectedHours" && iss.message.includes("Manfiy dars soati"),
      ),
      "Manfiy soat aniqlanmadi",
    );

    // 5b. Mumkin bo'lmagan darajada katta soat (> 120 soat)
    const valHuge = CurriculumIngestionPipeline.validateTopic(
      { ...validTopicBase, expectedHours: 200 },
      "Matematika",
      "8-sinf",
      "https://edurtm.uz",
    );
    assert.strictEqual(valHuge.isValid, false);
    assert.ok(
      valHuge.issues.some(
        (iss) =>
          iss.field === "expectedHours" &&
          iss.message.includes("Imkonsiz darajada katta dars soati"),
      ),
      "Haddan tashqari katta soat aniqlanmadi",
    );
  });

  it("6. Malformed learning outcomes test", () => {
    // Bo'sh yoki juda qisqa kutilgan natijalar
    const valShortOutcome = CurriculumIngestionPipeline.validateTopic(
      { ...validTopicBase, expectedOutcomes: ["a", "ok", "   "] },
      "Matematika",
      "8-sinf",
      "https://edurtm.uz",
    );
    assert.ok(
      valShortOutcome.issues.some(
        (iss) => iss.field === "expectedOutcomes" && iss.message.includes("juda qisqa"),
      ),
      "Qisqa kutilgan natija xatosi aniqlanmadi",
    );
  });

  it("7. Unicode corruption test", () => {
    // Kirill va lotin harflari bir so'z ichida aralashib ketgan holat (masalan, 'u' o'rniga kirill 'у', 'e' o'rniga kirill 'е')
    const valUnicode = CurriculumIngestionPipeline.validateTopic(
      { ...validTopicBase, topicName: "Uchburchak va aylanadagi mеtrik munosabatlar" }, // 'е' kirillcha
      "Matematika",
      "8-sinf",
      "https://edurtm.uz",
    );
    assert.ok(
      valUnicode.issues.some(
        (iss) =>
          iss.field === "topicName" &&
          iss.message.includes("kirill va lotin harflari noo'rin aralashgan"),
      ),
      "Kirill/lotin aralashuvi (unicode mixing) aniqlanmadi",
    );
  });

  it("8. Valid topic passes pipeline without any errors", () => {
    const valValid = CurriculumIngestionPipeline.validateTopic(
      validTopicBase,
      "Matematika",
      "8-sinf",
      "https://edurtm.uz/curriculum/matematika-8",
    );
    assert.strictEqual(valValid.isValid, true);
    assert.strictEqual(
      valValid.issues.filter((iss) => iss.severity === "ERROR").length,
      0,
    );
    assert.ok(valValid.normalizedRecord);
    assert.strictEqual(valValid.normalizedRecord.topicName, validTopicBase.topicName);
    assert.strictEqual(valValid.normalizedRecord.grade, "8-sinf");
    assert.strictEqual(valValid.normalizedRecord.subject, "Matematika");
    assert.strictEqual(valValid.normalizedRecord.expectedHours, 4);
  });
});
