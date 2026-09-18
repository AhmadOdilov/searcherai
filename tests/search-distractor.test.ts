import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rerankCandidates, type RerankerCandidate } from "@/lib/search/reranker";
import { understandQuery } from "@/lib/search/understanding";

describe("PHASE 13 — Distractor Testing (1 correct + 9 distractors)", () => {
  it("5-sinf vs 10-sinf: to'g'ri sinf (5-sinf) doimo Top 1 o'rinda chiqadi", async () => {
    const understanding = understandQuery("5-sinf oddiy kasrlar dars ishlanmasi");

    // 1 ta to'g'ri (5-sinf) va 9 ta chalg'ituvchi boshqa sinflar (6..11)
    const candidates: RerankerCandidate[] = [
      {
        id: "cand-wrong-1",
        topicName: "ALGEBRAIK KASRLAR VA TENGSIZLIKLAR",
        description: "Algebraik kasrlar ustida amallar, surat va maxrajni qisqartirish",
        expectedHours: 6,
        expectedOutcomes: ["Algebraik kasrlarni soddalashtirish"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "8-sinf",
      },
      {
        id: "cand-wrong-2",
        topicName: "RATSIONAL KASRLAR VA INTEGRALLAR",
        description: "Ratsional kasrlarni integrallash metodlari",
        expectedHours: 8,
        expectedOutcomes: ["Kasrli funksiyalarni integrallash"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "11-sinf",
      },
      {
        id: "cand-wrong-3",
        topicName: "KO'RSATKICHLI KASRLAR",
        description: "Ko'rsatkichli ifodalar va logarifmlar",
        expectedHours: 4,
        expectedOutcomes: ["Ko'rsatkichli kasrlar"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "10-sinf",
      },
      {
        id: "cand-wrong-4",
        topicName: "O'NLI KASRLARNI KO'PAYTIRISH",
        description: "O'nli kasrlar ustida amallar va proporsiya",
        expectedHours: 5,
        expectedOutcomes: ["O'nli kasrlar"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "6-sinf",
      },
      {
        id: "cand-wrong-5",
        topicName: "CHIZIQLI TENGLAMALAR",
        description: "Bir noma'lumli tenglamalar",
        expectedHours: 6,
        expectedOutcomes: ["Tenglamalarni yechish"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "7-sinf",
      },
      {
        id: "cand-wrong-6",
        topicName: "UCHBURCHAKLAR GEOMETRIYASI",
        description: "Uchburchaklar tengligi alomatlari",
        expectedHours: 8,
        expectedOutcomes: ["Uchburchak burchaklari"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "7-sinf",
      },
      {
        id: "cand-wrong-7",
        topicName: "PROGRESSIYALAR",
        description: "Arifmetik va geometrik progressiya",
        expectedHours: 6,
        expectedOutcomes: ["Progressiya formulalari"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "9-sinf",
      },
      {
        id: "cand-wrong-8",
        topicName: "FAZODA TO'G'RI CHIZIQLAR",
        description: "Fazoviy shakllar va tekisliklar",
        expectedHours: 5,
        expectedOutcomes: ["Fazoviy geometriya"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "10-sinf",
      },
      {
        id: "cand-wrong-9",
        topicName: "HOSILA VA UNING QO'LLANILISHI",
        description: "Funksiya hosilasi va grafigi",
        expectedHours: 10,
        expectedOutcomes: ["Hosilani hisoblash"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "10-sinf",
      },
      // Aynan to'g'ri hujjat:
      {
        id: "cand-correct-target",
        topicName: "ODDIY KASRLAR",
        description: "Oddiy kasr tushunchasi, to'g'ri va noto'g'ri kasrlar, aralash sonlar",
        expectedHours: 8,
        expectedOutcomes: ["Oddiy kasrlarni o'qish va yozish", "Kasrlarni taqqoslash"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "5-sinf",
      },
    ];

    const results = await rerankCandidates(candidates, understanding, 5);

    assert.equal(results.length > 0, true);
    assert.equal(results[0].sourceId, "cand-correct-target", "5-sinf to'g'ri hujjati Top 1 ga chiqishi shart");
    assert.equal(results[0].grade, "5-sinf");
    assert.equal(results[0].exactMatch, true);
  });

  it("Physics vs Chemistry: massa konteksti to'g'ri fanni (Fizika) Top 1 ga chiqaradi", async () => {
    const understanding = understandQuery("massa va tezlik nisbati formulasi");

    // 1 ta to'g'ri Fizika va 9 ta Kimyo/Biologiya/Matematika chalg'ituvchi hujjatlari
    const candidates: RerankerCandidate[] = [
      {
        id: "cand-chem-1",
        topicName: "MOLYAR MASSA VA ATOM MASSA",
        description: "Moddaning molyar massasi, atom tuzilishi va Mendeleyev jadvali",
        expectedHours: 4,
        expectedOutcomes: ["Molyar massani hisoblash"],
        source: "https://uzbmb.uz/kimyo",
        subject: "Kimyo",
        grade: "8-sinf",
      },
      {
        id: "cand-chem-2",
        topicName: "ERITMALARNING FOIZ VA MOLYAR KONSENTRATSIYASI",
        description: "Molyar konsentratsiya va massa ulushi",
        expectedHours: 6,
        expectedOutcomes: ["Eritma tayyorlash"],
        source: "https://uzbmb.uz/kimyo",
        subject: "Kimyo",
        grade: "8-sinf",
      },
      {
        id: "cand-chem-3",
        topicName: "KIMYOVIY REAKSIYALAR TENGSIZLIGI",
        description: "Moddalar massasining saqlanish qonuni",
        expectedHours: 4,
        expectedOutcomes: ["Reaksiya tenglamalari"],
        source: "https://uzbmb.uz/kimyo",
        subject: "Kimyo",
        grade: "7-sinf",
      },
      {
        id: "cand-bio-1",
        topicName: "ORGANIZMNING BIOMASSA OZIQ ZANJIRI",
        description: "Ekologiyada biomassa piramidasi va oziq to'rlari",
        expectedHours: 3,
        expectedOutcomes: ["Biomassani hisoblash"],
        source: "https://uzbmb.uz/biologiya",
        subject: "Biologiya",
        grade: "11-sinf",
      },
      {
        id: "cand-bio-2",
        topicName: "O'SIMLIK ORGANLARI MASSASI",
        description: "Ildiz va poya massasining o'sishi",
        expectedHours: 4,
        expectedOutcomes: ["O'simlik biomassasi"],
        source: "https://uzbmb.uz/biologiya",
        subject: "Biologiya",
        grade: "6-sinf",
      },
      {
        id: "cand-math-1",
        topicName: "OG'IRLIK VA MASSA O'LCHOV BIRLIKLARI",
        description: "Gramm, kilogramm, tonna hisoblash",
        expectedHours: 4,
        expectedOutcomes: ["O'lchov birliklari"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "5-sinf",
      },
      {
        id: "cand-math-2",
        topicName: "TENGLAMALAR VA MASALALAR",
        description: "Harakat va tezlik masalalari",
        expectedHours: 6,
        expectedOutcomes: ["Matnli masalalar"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "6-sinf",
      },
      {
        id: "cand-geo-1",
        topicName: "HAVO MASSALARI VA ATMOSFERA",
        description: "Havo massalari harakati va shamol",
        expectedHours: 4,
        expectedOutcomes: ["Iqlim xaritasi"],
        source: "https://uzbmb.uz/geografiya",
        subject: "Geografiya",
        grade: "7-sinf",
      },
      {
        id: "cand-geo-2",
        topicName: "YERNING MASSASI VA GRAVITATSIYA",
        description: "Litosfera plitalari harakati",
        expectedHours: 4,
        expectedOutcomes: ["Yer tuzilishi"],
        source: "https://uzbmb.uz/geografiya",
        subject: "Geografiya",
        grade: "6-sinf",
      },
      // Aynan to'g'ri Fizika hujjati:
      {
        id: "cand-phys-target",
        topicName: "JISMNING MASSASI, TEZLIGI VA INERSIYA",
        description: "Mexanikada jismning massasi, zichlik, tezlik va Nyuton dinamikasi",
        expectedHours: 6,
        expectedOutcomes: ["Massa va tezlik formulasini qo'llash"],
        source: "https://uzbmb.uz/fizika",
        subject: "Fizika",
        grade: "7-sinf",
      },
    ];

    const results = await rerankCandidates(candidates, understanding, 5);

    assert.equal(results.length > 0, true);
    assert.equal(results[0].sourceId, "cand-phys-target", "Fizika hujjati Kimyo/Geografiya chalg'ituvchilaridan ustun chiqishi shart");
    assert.equal(results[0].subject, "Fizika");
  });

  it("Biology vs Geography: 'o'simlik ildizi' so'rovi Geografiyani emas, Biologiyani Top 1 ga chiqaradi", async () => {
    const understanding = understandQuery("o'simlik ildizi va uning vazifalari");

    const candidates: RerankerCandidate[] = [
      {
        id: "cand-geo-wrong",
        topicName: "YERNING TUPROQ QATLAMI VA RELYEF",
        description: "Tuproq eroziyasi va o'simlik qoplami geografiyasi",
        expectedHours: 4,
        expectedOutcomes: ["Tuproq xaritasi"],
        source: "https://uzbmb.uz/geografiya",
        subject: "Geografiya",
        grade: "7-sinf",
      },
      {
        id: "cand-math-wrong",
        topicName: "KVADRAT ILDIZLAR",
        description: "Sonning arifmetik kvadrat ildizi",
        expectedHours: 6,
        expectedOutcomes: ["Ildiz chiqarish"],
        source: "https://uzbmb.uz/matematika",
        subject: "Matematika",
        grade: "8-sinf",
      },
      {
        id: "cand-lang-wrong",
        topicName: "SO'ZNING O'ZAGI VA ILDIZI",
        description: "Morfologiyada o'zak va qo'shimchalar",
        expectedHours: 4,
        expectedOutcomes: ["So'z yasalishi"],
        source: "https://uzbmb.uz/onatili",
        subject: "Ona tili",
        grade: "5-sinf",
      },
      // Aynan to'g'ri Biologiya hujjati:
      {
        id: "cand-bio-target",
        topicName: "ILDIZ TIZIMI VA UNING TUZILISHI",
        description: "O'simlik ildizi, ildiz turlari, ildiz tukchalari va oziqlanish",
        expectedHours: 4,
        expectedOutcomes: ["Ildiz tuzilishini o'rganish"],
        source: "https://uzbmb.uz/biologiya",
        subject: "Biologiya",
        grade: "6-sinf",
      },
    ];

    const results = await rerankCandidates(candidates, understanding, 3);

    assert.equal(results.length > 0, true);
    assert.equal(results[0].sourceId, "cand-bio-target");
    assert.equal(results[0].subject, "Biologiya");
  });
});
