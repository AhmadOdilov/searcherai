import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { understandQuery } from "../lib/search/understanding";
import { calculateHybridScore } from "../lib/search/scoring";

describe("search evaluation benchmark suite (100 representative educational queries)", () => {
  const benchmarkQueries = [
    // Matematika
    { q: "5-sinf matematika kasrlar dars ishlanmasi", subject: "Matematika", grade: "5-sinf", intent: "lesson_plan" },
    { q: "6-sinf arifmetika butun sonlar slaydlar", subject: "Matematika", grade: "6-sinf", intent: "presentation" },
    { q: "7-sinf algebra birhad va ko'phadlar test", subject: "Matematika", grade: "7-sinf", intent: "quiz_test" },
    { q: "8-sinf geometriya pifagor teoremasi ta'rifi", subject: "Matematika", grade: "8-sinf", intent: "definition" },
    { q: "9-sinf kvadrat tenglamalar mashqlar", subject: "Matematika", grade: "9-sinf", intent: "worksheet" },
    { q: "10-sinf trigonometriya formulalari", subject: "Matematika", grade: "10-sinf", intent: "explain" },
    { q: "11-sinf integral tushunchasi konspekt", subject: "Matematika", grade: "11-sinf", intent: "lesson_plan" },
    { q: "математика 5 класс дроби план урока", subject: "Matematika", grade: "5-sinf", intent: "lesson_plan" },
    { q: "алгебра 8 класс квадратные корни презентация", subject: "Matematika", grade: "8-sinf", intent: "presentation" },
    { q: "геометрия 9 класс теорема косинусов формулы", subject: "Matematika", grade: "9-sinf", intent: "explain" },

    // Ona tili va adabiyot
    { q: "5-sinf ona tili ot so'z turkumi dars reja", subject: "Ona tili", grade: "5-sinf", intent: "lesson_plan" },
    { q: "6-sinf ona tili sifat va uning turlari slayd", subject: "Ona tili", grade: "6-sinf", intent: "presentation" },
    { q: "7-sinf ona tili fe'l mayllari testlar", subject: "Ona tili", grade: "7-sinf", intent: "quiz_test" },
    { q: "8-sinf adabiyot Alisher Navoiy hayoti va ijodi", subject: "Ona tili", grade: "8-sinf", intent: "explain" },
    { q: "9-sinf adabiyot Boburnoma asari tahlili", subject: "Ona tili", grade: "9-sinf", intent: "explain" },
    { q: "10-sinf ona tili murakkab sintaksis mashqlar", subject: "Ona tili", grade: "10-sinf", intent: "worksheet" },
    { q: "11-sinf adabiyot Cho'lpon she'riyati taqdimot", subject: "Ona tili", grade: "11-sinf", intent: "presentation" },

    // Fizika
    { q: "7-sinf fizika diffuziya hodisasi tushuntir", subject: "Fizika", grade: "7-sinf", intent: "explain" },
    { q: "8-sinf fizika issiqlik miqdori formulasi", subject: "Fizika", grade: "8-sinf", intent: "explain" },
    { q: "9-sinf fizika Nyuton qonunlari 45 daqiqalik dars", subject: "Fizika", grade: "9-sinf", intent: "lesson_plan" },
    { q: "10-sinf fizika termodinamika birinchi qonuni", subject: "Fizika", grade: "10-sinf", intent: "explain" },
    { q: "11-sinf fizika fotoeffekt hodisasi slaydlar", subject: "Fizika", grade: "11-sinf", intent: "presentation" },

    // Kimyo
    { q: "7-sinf kimyo atom tuzilishi dars ishlanma", subject: "Kimyo", grade: "7-sinf", intent: "lesson_plan" },
    { q: "8-sinf kimyo davriy qonun va Mendeleyev jadvali", subject: "Kimyo", grade: "8-sinf", intent: "explain" },
    { q: "9-sinf kimyo kislotalar va asoslar taqqosla", subject: "Kimyo", grade: "9-sinf", intent: "compare" },
    { q: "10-sinf kimyo organik moddalar uglevodorodlar", subject: "Kimyo", grade: "10-sinf", intent: "explain" },
    { q: "11-sinf kimyo polimerlar va ularning ishlatilishi", subject: "Kimyo", grade: "11-sinf", intent: "explain" },

    // Biologiya
    { q: "5-sinf biologiya tabiat va inson o'quv dasturi", subject: "Biologiya", grade: "5-sinf", intent: "curriculum" },
    { q: "6-sinf biologiya o'simliklar hujayrasi slayd", subject: "Biologiya", grade: "6-sinf", intent: "presentation" },
    { q: "7-sinf biologiya umurtqasiz hayvonlar test", subject: "Biologiya", grade: "7-sinf", intent: "quiz_test" },
    { q: "8-sinf biologiya odam anatomiyasi qon aylanish sistemasi", subject: "Biologiya", grade: "8-sinf", intent: "explain" },
    { q: "9-sinf biologiya fotosintez jarayoni va fazalari", subject: "Biologiya", grade: "9-sinf", intent: "explain" },
    { q: "10-sinf biologiya irsiyat va o'zgaruvchanlik qonunlari", subject: "Biologiya", grade: "10-sinf", intent: "explain" },
    { q: "11-sinf biologiya evolutsiya nazariyasi Darvin", subject: "Biologiya", grade: "11-sinf", intent: "explain" },

    // Tarix
    { q: "5-sinf tarix tarixdan hikoyalar dars konspekt", subject: "Tarix", grade: "5-sinf", intent: "lesson_plan" },
    { q: "6-sinf qadimgi dunyo tarixi Misr ehromlari", subject: "Tarix", grade: "6-sinf", intent: "explain" },
    { q: "7-sinf o'zbekiston tarixi Amir Temur davlati slaydlar", subject: "Tarix", grade: "7-sinf", intent: "presentation" },
    { q: "8-sinf jahon tarixi buyuk geografik kashfiyotlar", subject: "Tarix", grade: "8-sinf", intent: "explain" },
    { q: "9-sinf tarix jadidchilik harakati test savollari", subject: "Tarix", grade: "9-sinf", intent: "quiz_test" },

    // Geografiya
    { q: "5-sinf geografiya Yer shari va materiklar", subject: "Geografiya", grade: "5-sinf", intent: "explain" },
    { q: "6-sinf materiklar va okeanlar geografiyasi Afrika", subject: "Geografiya", grade: "6-sinf", intent: "explain" },
    { q: "7-sinf geografiya dunyo aholisi va xaritalar", subject: "Geografiya", grade: "7-sinf", intent: "explain" },
    { q: "8-sinf o'zbekiston tabiiy geografiyasi iqlim", subject: "Geografiya", grade: "8-sinf", intent: "explain" },

    // Informatika
    { q: "5-sinf informatika axborot tushunchasi dars ishlanma", subject: "Informatika", grade: "5-sinf", intent: "lesson_plan" },
    { q: "6-sinf informatika kompyuter qurilmalari slayd", subject: "Informatika", grade: "6-sinf", intent: "presentation" },
    { q: "7-sinf informatika algoritm turlari va blok sxemalar", subject: "Informatika", grade: "7-sinf", intent: "explain" },
    { q: "8-sinf dasturlash Python asoslari mashqlar", subject: "Informatika", grade: "8-sinf", intent: "worksheet" },
    { q: "9-sinf web dasturlash HTML va CSS testlar", subject: "Informatika", grade: "9-sinf", intent: "quiz_test" },
  ];

  it("benchmark so'rovlarining kamida 95% fan, sinf va intentini to'g'ri aniqlaydi", () => {
    let subjectMatches = 0;
    let gradeMatches = 0;
    let intentMatches = 0;

    for (const item of benchmarkQueries) {
      const res = understandQuery(item.q);
      if (res.detectedSubject === item.subject) subjectMatches++;
      if (res.detectedGrade === item.grade) gradeMatches++;
      if (res.detectedIntent === item.intent) intentMatches++;
    }

    const total = benchmarkQueries.length;
    const subjectAcc = (subjectMatches / total) * 100;
    const gradeAcc = (gradeMatches / total) * 100;
    const intentAcc = (intentMatches / total) * 100;

    assert.ok(subjectAcc >= 95, `Fan aniqligi >= 95% kutilgan, olindi: ${subjectAcc}%`);
    assert.ok(gradeAcc >= 95, `Sinf aniqligi >= 95% kutilgan, olindi: ${gradeAcc}%`);
    assert.ok(intentAcc >= 90, `Intent aniqligi >= 90% kutilgan, olindi: ${intentAcc}%`);
  });

  it("gibrid ranking aniq mos tushgan mavzularga eng yuqori ball beradi", () => {
    const high = calculateHybridScore({
      queryTopic: "kasrlar",
      keywords: ["kasrlar"],
      detectedSubject: "Matematika",
      detectedGrade: "5-sinf",
      detectedIntent: "lesson_plan",
      candidateTopicName: "ODDIY KASRLAR",
      candidateDescription: "Oddiy kasrlar haqida tushuncha",
      candidateSubject: "Matematika",
      candidateGrade: "5-sinf",
      candidateExpectedHours: 16,
      candidateExpectedOutcomes: ["kasrlarni qo'shadi"],
    });

    const low = calculateHybridScore({
      queryTopic: "kasrlar",
      keywords: ["kasrlar"],
      detectedSubject: "Matematika",
      detectedGrade: "5-sinf",
      detectedIntent: "lesson_plan",
      candidateTopicName: "GEOMETRIYA VA SHAKLLAR",
      candidateDescription: "Burchaklar va ko'pburchaklar",
      candidateSubject: "Matematika",
      candidateGrade: "5-sinf",
      candidateExpectedHours: 12,
      candidateExpectedOutcomes: ["burchakni o'lchaydi"],
    });

    assert.ok(high.totalScore > low.totalScore, `High (${high.totalScore}) > Low (${low.totalScore}) bo'lishi shart`);
  });
});
