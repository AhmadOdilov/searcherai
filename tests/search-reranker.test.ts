import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rerankCandidates, type RerankerCandidate } from "../lib/search/reranker";
import { understandQuery } from "../lib/search/understanding";

/*
  Bu testlar PRODUCTION reranker'ini (lib/search/reranker.ts) tekshiradi.

  Nega alohida fayl kerak bo'ldi: `tests/search-scoring.test.ts` faqat
  `lib/search/scoring.ts` ni tekshiradi, lekin u fayl qidiruv quvurida
  UMUMAN chaqirilmaydi — haqiqiy reyting reranker ichida hisoblanadi.
  Ya'ni V4'gacha reranker skoringi testlar bilan qoplanmagan edi.
*/

function candidate(partial: Partial<RerankerCandidate> & { id: string; topicName: string }): RerankerCandidate {
  return {
    description: "",
    expectedHours: 10,
    expectedOutcomes: [],
    source: "https://uzbmb.uz/example.pdf",
    subject: "Matematika",
    grade: "8-sinf",
    ...partial,
  };
}

describe("reranker — exact/subphrase skoring (V5 regressiya)", () => {
  it("BUTUNLAY ALOQASIZ mavzuga exact match bali BERMAYDI", async () => {
    /*
      V4 REGRESSIYASI: subphrase sharti `candTitle.includes(p)` ko'rinishida edi,
      p esa candTitle'ning o'zidan kesib olinardi — ya'ni shart har doim rost.
      Natijada HAR QANDAY nomzod exactScore = 0.85 olardi va umumiy bal
      grounding chegarasidan (0.45) oshib ketardi.
    */
    const u = understandQuery("8-sinf matematika kvadrat tenglama");
    const [unrelated] = await rerankCandidates(
      [candidate({ id: "x", topicName: "FOTOSINTEZ VA HUJAYRA NAFAS OLISHI" })],
      u,
      1,
    );

    assert.equal(unrelated.scoreBreakdown.exactMatch, 0);
    assert.ok(
      unrelated.score < 0.45,
      `Aloqasiz mavzu grounding chegarasidan past bo'lishi shart, olindi: ${unrelated.score}`,
    );
  });

  it("mos mavzu aloqasiz mavzudan SEZILARLI yuqori turadi", async () => {
    const u = understandQuery("8-sinf matematika kvadrat tenglama");
    const ranked = await rerankCandidates(
      [
        candidate({ id: "unrelated", topicName: "MA'LUMOTLAR TAHLILI" }),
        candidate({
          id: "correct",
          topicName: "KVADRAT TENGLAMALAR",
          description: "Kvadrat tenglama ta'rifi, diskriminant, Viet teoremasi.",
        }),
      ],
      u,
      2,
    );

    assert.equal(ranked[0].sourceId, "correct");
    assert.ok(
      ranked[0].score - ranked[1].score > 0.3,
      `Ajratuvchi farq kutilgan edi, olindi: ${ranked[0].score} vs ${ranked[1].score}`,
    );
  });

  it("sarlavha bo'lagi so'rovda uchrasa subphrase mosligi SAQLANADI", async () => {
    // "MUSBAT VA MANFIY SONLAR. BUTUN SONLAR" -> so'rov "butun sonlar"
    const u = understandQuery("6-sinf matematika butun sonlar");
    const [match] = await rerankCandidates(
      [candidate({ id: "sub", topicName: "MUSBAT VA MANFIY SONLAR. BUTUN SONLAR", grade: "6-sinf" })],
      u,
      1,
    );

    assert.ok(
      match.scoreBreakdown.exactMatch >= 0.85,
      `Subphrase mosligi kutilgan edi, olindi: ${match.scoreBreakdown.exactMatch}`,
    );
  });

  it("so'rovning tinish belgisi bilan ajralgan bo'lagi nomzod sarlavhasida uchrasa moslik topiladi", async () => {
    /*
      Yangi (b) yo'nalishi aynan shu holatda ishlaydi: so'rov tinish belgisi
      bilan bo'laklarga ajraladi va bo'laklardan biri nomzod sarlavhasida uchraydi.
      Butun so'rov sarlavha ichida bo'lsa, undan yuqoridagi 0.90 shoxi ishlaydi.
    */
    const u = understandQuery("8-sinf matematika kvadrat tenglamalar, diskriminant va Viet teoremasi");
    const [match] = await rerankCandidates(
      [candidate({ id: "rev", topicName: "KVADRAT TENGLAMALAR" })],
      u,
      1,
    );

    assert.ok(
      match.scoreBreakdown.exactMatch >= 0.85,
      `Teskari yo'nalishli moslik kutilgan edi, olindi: ${match.scoreBreakdown.exactMatch}`,
    );
  });
});

describe("reranker — ketma-ket ibora mosligi (V6 regressiya)", () => {
  it("so'rovning asosiy iborasi bilan BOSHLANGAN sarlavha moslik oladi", async () => {
    /*
      V5 REGRESSIYASI: bo'lak mosligi faqat TINISH BELGISI chegarasida
      tekshirilardi. «NUTQ USLUBLARI VA USLUBIYAT. TAKRORLASH» sarlavhasi
      so'rovning asosiy iborasi bilan boshlanishiga qaramay, moslik
      hisobga olinmasdi.
    */
    const u = understandQuery("10-sinf ona tili nutq uslublari rasmiy publitsistik badiiy");
    const [m] = await rerankCandidates(
      [
        candidate({
          id: "gold",
          topicName: "NUTQ USLUBLARI VA USLUBIYAT. TAKRORLASH",
          subject: "Ona tili",
          grade: "9-sinf",
        }),
      ],
      u,
      1,
    );

    assert.ok(
      m.scoreBreakdown.exactMatch >= 0.85,
      `ibora mosligi kutilgan edi, olindi: ${m.scoreBreakdown.exactMatch}`,
    );
  });

  it("ibora mos kelgan nomzod aloqasiz nomzoddan YUQORI turadi", async () => {
    const u = understandQuery("10-sinf ona tili nutq uslublari rasmiy publitsistik badiiy");
    const ranked = await rerankCandidates(
      [
        candidate({ id: "other", topicName: "Nutqning aniqligi", subject: "Ona tili", grade: "11-sinf" }),
        candidate({
          id: "gold",
          topicName: "NUTQ USLUBLARI VA USLUBIYAT. TAKRORLASH",
          subject: "Ona tili",
          grade: "9-sinf",
        }),
      ],
      u,
      2,
    );

    assert.equal(ranked[0].sourceId, "gold");
  });

  it("bitta umumiy so'z moslik uchun YETARLI EMAS", async () => {
    // Faqat ikki va undan ortiq ketma-ket so'z hisobga olinadi.
    const u = understandQuery("8-sinf matematika kvadrat tenglama");
    const [m] = await rerankCandidates(
      [candidate({ id: "weak", topicName: "CHIZIQLI TENGLAMA SISTEMALARI" })],
      u,
      1,
    );

    assert.ok(
      m.scoreBreakdown.exactMatch < 0.85,
      `yakka so'z mosligi 0.85 bermasligi kerak, olindi: ${m.scoreBreakdown.exactMatch}`,
    );
  });
});

describe("reranker — TO'LIQ sarlavha mosligi sinf yaqinligidan ustun (V6 audit)", () => {
  it("aynan shu nomli bo'lim qisman mosликdan yuqori turadi", async () => {
    /*
      V6 AUDITIDA TOPILGAN REGRESSIYA.

      Bigram ibora mosligi qo'shilgandan keyin uzun sarlavhali nomzod
      («FAZODA TO'G'RI CHIZIQLAR VA TEKISLIKLARNING PARALLELLIGI»)
      «to'g'ri chiziqlar» bigrammasi tufayli 0.85 ball oldi va so'ralgan
      sinfga 1 pog'ona yaqinligi tufayli AYNAN shu nomli bo'limdan
      («PARALLEL TO'G'RI CHIZIQLAR», exact = 1.0) yuqori chiqib ketdi.

      V5 da 7-sinf birinchi edi (0.7911 vs 0.7806) — ya'ni bu V6
      o'zgarishlari keltirib chiqargan regressiya.
    */
    const u = understandQuery("9-sinf matematika parallel to'g'ri chiziqlar");
    const ranked = await rerankCandidates(
      [
        candidate({
          id: "far-exact",
          topicName: "PARALLEL TO‘G‘RI CHIZIQLAR",
          description: "Parallel to‘g‘ri chiziqlar va ularning xossalari.",
          grade: "7-sinf",
        }),
        candidate({
          id: "near-partial",
          topicName: "FAZODA TOʻGʻRI CHIZIQLAR VA TEKISLIKLARNING PARALLELLIGI",
          description: "Fazoda to‘g‘ri chiziqlar va tekisliklarning o‘zaro joylashuvi.",
          grade: "10-sinf",
        }),
      ],
      u,
      2,
    );

    assert.equal(ranked[0].scoreBreakdown.exactMatch, 1, "1-o'rin to'liq moslik bo'lishi kerak");
    assert.equal(ranked[0].sourceId, "far-exact");
    assert.equal(ranked[0].isCrossGrade, true, "sinf tafovuti bayrog'i saqlanadi");
  });

  it("so'ralgan sinfdagi TO'LIQ moslik baribir eng yuqori qoladi", async () => {
    // Jazo yumshatilishi so'ralgan sinfdagi nomzodni pastga tushirmasligi shart.
    const u = understandQuery("7-sinf matematika parallel to'g'ri chiziqlar");
    const ranked = await rerankCandidates(
      [
        candidate({
          id: "in-grade",
          topicName: "PARALLEL TO‘G‘RI CHIZIQLAR",
          description: "Parallel to‘g‘ri chiziqlar va ularning xossalari.",
          grade: "7-sinf",
        }),
        candidate({
          id: "cross",
          topicName: "FAZODA TOʻGʻRI CHIZIQLAR VA TEKISLIKLARNING PARALLELLIGI",
          description: "Fazoda to‘g‘ri chiziqlar.",
          grade: "10-sinf",
        }),
      ],
      u,
      2,
    );

    assert.equal(ranked[0].sourceId, "in-grade");
    assert.equal(ranked[0].isCrossGrade, false);
  });
});
