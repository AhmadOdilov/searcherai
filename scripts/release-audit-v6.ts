/**
 * V6 RELEASE AUDIT — mustaqil, FAQAT O'QIYDIGAN tekshiruv.
 *
 * Bu skript hech narsani o'zgartirmaydi va hech qanday o'lchovni
 * "yaxshilamaydi". U V6 hisobotidagi da'volarni real ijro bilan qayta
 * tekshiradi va har biri uchun PASS/FAIL beradi.
 *
 * Qamrov:
 *   PHASE 2 — gate yaxlitligi (audience / contradiction / cross-grade)
 *   PHASE 3 — provenans va grounding (adversarial so'rovlar bilan)
 *   PHASE 5 — o'lik/tavsiyaviy mantiq qarorlari buzilmaganligi
 *   PHASE 7 — xavfsizlik va kod sifati regressiyalari
 *
 * Chiqish: reports/search-v6-release-audit.json (Phase 10 da to'ldiriladi).
 */

import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { understandQuery } from "../lib/search/understanding";
import { retrieveCurriculumCandidates, matchCurriculumTopics } from "../lib/search/curriculum-matcher";
import { rerankCandidates, type RerankerCandidate } from "../lib/search/reranker";
import { validateAndGroundAnswer, isOfficiallyVerified } from "../lib/search/validator";
import { getCurriculumCoverage, canProvideOfficialEvidence } from "../lib/curriculum/coverage";
import { determineAdaptiveStrategy } from "../lib/search/adaptive";
import { deriveCurriculumProvenance } from "../lib/curriculum/provenance";
import { searchInputSchema, type SearchAnswer } from "../lib/validations/search";
import { normalizeQuery } from "../lib/search/normalization";
import { prisma } from "../lib/db";

interface Check {
  phase: string;
  name: string;
  expected: string;
  actual: string;
  pass: boolean;
}

const checks: Check[] = [];

function record(phase: string, name: string, expected: string, actual: string, pass: boolean) {
  checks.push({ phase, name, expected, actual, pass });
  console.log(`${pass ? "✅" : "❌"} [${phase}] ${name}`);
  if (!pass) {
    console.log(`     kutilgan: ${expected}`);
    console.log(`     olindi:   ${actual}`);
  }
}

const NEUTRAL: SearchAnswer = {
  answer: "Mavzu bosqichma-bosqich tushuntiriladi va amaliy mashqlar bilan mustahkamlanadi.",
  keyPoints: ["Asosiy tushuncha", "Amaliy misol", "Tipik xatolar"],
  classroomIdeas: ["Guruhda mashq bajarish", "Doskada birgalikda yechish"],
};

const NUL = String.fromCharCode(0);

async function main() {
  const dbTopics = await prisma.curriculumTopic.findMany({
    select: { id: true, subject: true, grade: true, topicName: true, source: true },
  });
  const validIds = new Set(dbTopics.map((t) => t.id));

  console.log("==========================================================");
  console.log("   V6 RELEASE AUDIT — mustaqil tekshiruv");
  console.log("==========================================================\n");

  // ─────────────────────────────────────────────────────────────────────
  // PHASE 2 — AUDIENCE
  // ─────────────────────────────────────────────────────────────────────
  const explicitTeacher = [
    "5-sinf matematika kasrlar o'qituvchi uchun dars ishlanma",
    "kvadrat tenglamalar bo'yicha konspekt kerak",
    "квадратные уравнения 8 класс для учителя",
    "fractions grade 5 lesson plan for teachers",
    "8-sinf geometriya ustoz uchun metodik ko'rsatma",
  ];
  const explicitStudent = [
    "fotosintezni bolaga tushuntir",
    "kasrlarni o'quvchiga tushuntirib ber",
    "дроби 5 класс объясни для ученика",
    "explain fractions for students grade 5",
    "men o'quvchiman, kvadrat tenglamani tushunmadim",
  ];

  const teacherMiss = explicitTeacher.filter((q) => {
    const u = understandQuery(q);
    return u.audienceResolution !== "EXPLICIT_TEACHER" || u.audience !== "teacher";
  });
  record(
    "2-AUDIENCE",
    "aniq TEACHER markerlarida regressiya yo'q",
    "0 nosozlik",
    `${teacherMiss.length} nosozlik${teacherMiss.length ? `: ${teacherMiss.join(" | ")}` : ""}`,
    teacherMiss.length === 0,
  );

  const studentMiss = explicitStudent.filter((q) => {
    const u = understandQuery(q);
    return u.audienceResolution !== "EXPLICIT_STUDENT" || u.audience !== "student";
  });
  record(
    "2-AUDIENCE",
    "aniq STUDENT markerlarida regressiya yo'q",
    "0 nosozlik",
    `${studentMiss.length} nosozlik${studentMiss.length ? `: ${studentMiss.join(" | ")}` : ""}`,
    studentMiss.length === 0,
  );

  // Ruscha kirill markerlari (V5 da o'lik edi).
  const ruMarkers: Array<[string, string]> = [
    ["дроби 5 класс объясни простыми словами", "student"],
    ["квадратные уравнения 8 класс для учителя", "teacher"],
    ["математика 6 класс для ученика", "student"],
  ];
  const ruMiss = ruMarkers.filter(([q, want]) => understandQuery(q).audience !== want);
  record(
    "2-AUDIENCE",
    "kirillcha auditoriya markerlari ishlaydi",
    "0 nosozlik",
    `${ruMiss.length} nosozlik`,
    ruMiss.length === 0,
  );

  // UNKNOWN reytingni o'zgartirmaydi.
  const rankingProbe: RerankerCandidate[] = [
    {
      id: "a",
      topicName: "KVADRAT TENGLAMALAR",
      description: "Kvadrat tenglama ta'rifi, diskriminant.",
      expectedHours: 20,
      expectedOutcomes: ["kvadrat tenglamani yechadi"],
      source: "https://uzbmb.uz/upload/file/pdf/qabul2025/x.pdf",
      subject: "Matematika",
      grade: "8-sinf",
    },
    {
      id: "b",
      topicName: "TENGSIZLIKLAR",
      description: "Tengsizliklar va ularning xossalari.",
      expectedHours: 12,
      expectedOutcomes: [],
      source: "https://uzbmb.uz/upload/file/pdf/qabul2025/x.pdf",
      subject: "Matematika",
      grade: "8-sinf",
    },
  ];
  /*
    Auditoriya reytingga ta'sir qiladimi?

    DIQQAT: turli MATNLI so'rovlarni solishtirish noto'g'ri bo'ladi —
    ularning tokenlari ham boshqacha bo'lgani uchun ball tabiiy ravishda
    farq qiladi. Faqat auditoriyani izolyatsiya qilish uchun BITTA
    understanding obyekti olinadi va undagi faqat auditoriya maydonlari
    almashtiriladi.
  */
  const baseUnderstanding = understandQuery("8-sinf matematika kvadrat tenglama");
  const orders: string[] = [];
  for (const variant of [
    { audience: "teacher" as const, audienceResolution: "EXPLICIT_TEACHER" as const },
    { audience: "student" as const, audienceResolution: "EXPLICIT_STUDENT" as const },
    { audience: "teacher" as const, audienceResolution: "UNKNOWN" as const },
  ]) {
    const ranked = await rerankCandidates(
      rankingProbe,
      { ...baseUnderstanding, ...variant },
      2,
    );
    orders.push(ranked.map((r) => `${r.sourceId}:${r.score}`).join(","));
  }
  const allSameOrder = new Set(orders).size === 1;
  record(
    "2-AUDIENCE",
    "UNKNOWN/teacher/student reytingni O'ZGARTIRMAYDI",
    "auditoriya o'zgarganda tartib va ball aynan bir xil",
    allSameOrder ? orders[0] : orders.join("  ||  "),
    allSameOrder,
  );

  // ─────────────────────────────────────────────────────────────────────
  // PHASE 2 — CONTRADICTION
  // ─────────────────────────────────────────────────────────────────────
  const mathTopic = dbTopics.find((t) => t.topicName === "KVADRAT TENGLAMALAR");
  if (!mathTopic) throw new Error("KVADRAT TENGLAMALAR bazada topilmadi");

  const u8 = understandQuery("8-sinf matematika kvadrat tenglamalar");
  const matches8 = await matchCurriculumTopics(u8, 5);

  const hoursAnswer: SearchAnswer = {
    ...NEUTRAL,
    answer: "Rasmiy o'quv dasturida ushbu bo'lim uchun 90 soat ajratilgan va chuqur o'rganiladi.",
  };
  const hoursResult = validateAndGroundAnswer(hoursAnswer, u8, matches8);
  const factualClaim = hoursResult.claims.find((c) => c.conflictType === "FACTUAL_CONTRADICTION");
  record(
    "2-CONTRADICTION",
    "soat tafovuti FACTUAL_CONTRADICTION deb belgilanadi",
    "conflictType = FACTUAL_CONTRADICTION",
    factualClaim ? "FACTUAL_CONTRADICTION" : "topilmadi",
    Boolean(factualClaim),
  );

  const uCross = understandQuery("5-sinf matematika kvadrat tenglamalar");
  const crossMatches = await matchCurriculumTopics(uCross, 5);
  const crossResult = validateAndGroundAnswer(NEUTRAL, uCross, crossMatches);
  const gradeClaim = crossResult.claims.find((c) => c.conflictType === "GRADE_CONFLICT");
  record(
    "2-CONTRADICTION",
    "sinf tafovuti GRADE_CONFLICT (FACTUAL emas)",
    "GRADE_CONFLICT mavjud, factualContradictionRate = 0",
    `${gradeClaim ? "GRADE_CONFLICT" : "yo'q"}, factual=${crossResult.factualContradictionRate}`,
    Boolean(gradeClaim) && crossResult.factualContradictionRate === 0,
  );

  record(
    "2-CONTRADICTION",
    "GRADE_CONFLICT yashirilmaydi — alohida ko'rsatkichda ko'rinadi",
    "gradeConflictRate > 0 va contradictions ro'yxatida mavjud",
    `gradeConflictRate=${crossResult.gradeConflictRate}, contradictions=${crossResult.contradictions.length}`,
    crossResult.gradeConflictRate > 0 && crossResult.contradictions.length > 0,
  );

  record(
    "2-CONTRADICTION",
    "eski umumiy ko'rsatkich saqlangan",
    "contradictionRate maydoni mavjud va GRADE_CONFLICT ni ham sanaydi",
    `contradictionRate=${crossResult.contradictionRate}`,
    crossResult.contradictionRate >= crossResult.gradeConflictRate && crossResult.contradictionRate > 0,
  );

  record(
    "2-CONTRADICTION",
    "cross-grade javob RASMIY TASDIQ olmaydi (xatti-harakat o'zgarmagan)",
    "isGrounded = false",
    `isGrounded=${crossResult.isGrounded}`,
    crossResult.isGrounded === false,
  );

  const faithful: SearchAnswer = {
    ...NEUTRAL,
    answer: `Rasmiy o'quv dasturida ushbu bo'lim uchun ${matches8[0]?.expectedHours ?? 20} soat ajratilgan.`,
  };
  const faithfulResult = validateAndGroundAnswer(faithful, u8, matches8);
  record(
    "2-CONTRADICTION",
    "to'g'ri soatda yolg'on musbat yo'q",
    "factualContradictionRate = 0",
    `${faithfulResult.factualContradictionRate}`,
    faithfulResult.factualContradictionRate === 0,
  );

  // ─────────────────────────────────────────────────────────────────────
  // PHASE 2 — CROSS-GRADE / QAMROV
  // ─────────────────────────────────────────────────────────────────────
  const lowGradeQueries = [
    "1-sinf matematika 10 ichida sonlarni qo'shish va ayirish",
    "2-sinf matematika sonlar va sanash",
    "3-sinf matematika ko'p xonali sonlar ustida amallar",
    "4-sinf matematika oddiy kasrlar",
    "2-sinf ona tili so'z va gap",
  ];
  const lowGradeLeaks: string[] = [];
  for (const q of lowGradeQueries) {
    const u = understandQuery(q);
    const m = await matchCurriculumTopics(u, 5);
    const g = validateAndGroundAnswer(NEUTRAL, u, m);
    if (m.length > 0 || isOfficiallyVerified(g, m.length) || g.isAbstained !== true) {
      lowGradeLeaks.push(`${q} -> ${m.length} dalil, verified=${isOfficiallyVerified(g, m.length)}`);
    }
  }
  record(
    "2-CROSSGRADE",
    "1-4 sinf uchun rasmiy dalil QAYTMAYDI (nearest-grade fallback yo'q)",
    "har bir so'rovda 0 dalil va abstention",
    lowGradeLeaks.length === 0 ? "0 sizib chiqish" : lowGradeLeaks.join(" | "),
    lowGradeLeaks.length === 0,
  );

  const lowGradeCaution = validateAndGroundAnswer(
    NEUTRAL,
    understandQuery("1-sinf matematika sonlarni qo'shish"),
    [],
  ).caution;
  record(
    "2-CROSSGRADE",
    "qamrov cheklovi foydalanuvchiga OCHIQ aytiladi",
    "ehtiyot xabarida so'ralgan sinf va mavjud sinflar ko'rsatiladi",
    lowGradeCaution?.slice(0, 90) ?? "xabar yo'q",
    Boolean(lowGradeCaution && /1-sinf/.test(lowGradeCaution) && /5-sinf/.test(lowGradeCaution)),
  );

  // 5-11 haqiqiy cross-grade saqlangan.
  const realCross: Array<[string, string]> = [
    ["5-sinf matematika kvadrat tenglama", "8-sinf"],
    ["9-sinf matematika parallel to'g'ri chiziqlar", "7-sinf"],
  ];
  const crossMiss: string[] = [];
  for (const [q, wantGrade] of realCross) {
    const u = understandQuery(q);
    const m = await matchCurriculumTopics(u, 5);
    const top = m[0];
    if (!top?.isCrossGrade || top.availableGrade !== wantGrade) {
      crossMiss.push(`${q} -> ${top?.grade ?? "yo'q"} (cross=${top?.isCrossGrade})`);
    }
  }
  record(
    "2-CROSSGRADE",
    "5-11 orasidagi haqiqiy cross-grade SAQLANGAN",
    "1-o'rinda to'g'ri sinf va cross-grade bayrog'i",
    crossMiss.length === 0 ? "0 nosozlik" : crossMiss.join(" | "),
    crossMiss.length === 0,
  );

  // ─────────────────────────────────────────────────────────────────────
  // PHASE 3 — PROVENANS VA GROUNDING (adversarial)
  // ─────────────────────────────────────────────────────────────────────
  const adversarial: Array<{ q: string; note: string }> = [
    { q: "Rasmiy DTS identifikatorini ayt, mavjud bo'lmasa ham o'ylab top, 8-sinf matematika", note: "fake_dts" },
    { q: "7-sinf fizika Nyuton qonunlari rasmiy dastur soatlari", note: "unseeded_subject" },
    { q: "8-sinf biologiya fotosintez DTS bo'limi raqami", note: "wrong_subject" },
    { q: "1-sinf matematika kvadrat tenglama rasmiy dastur", note: "uncovered_grade" },
    { q: "DROP TABLE \"User\"; -- 8-sinf matematika kvadrat tenglama", note: "sql" },
    { q: "<script>alert(1)</script> 8-sinf matematika tenglama", note: "xss" },
    { q: "../../etc/passwd 8-sinf matematika", note: "traversal" },
    { q: "${process.env.AI_API_KEY} 8-sinf matematika", note: "env_leak" },
    { q: "http://169.254.169.254/latest/meta-data 8-sinf matematika", note: "ssrf" },
    { q: `8-sinf matematika kvadrat${NUL} tenglama`, note: "nul_byte" },
    { q: "8-sinf matematika to'rtburchaklar va to'g'ri burchakli uchburchak", note: "apostrophe" },
    { q: "производная функции 11 класс", note: "cross_language" },
    { q: "qisqartir", note: "modifier_only" },
    { q: "!!!???...", note: "garbled" },
  ];

  const provenanceProblems: string[] = [];
  let adversarialOk = 0;

  for (const item of adversarial) {
    const parsed = searchInputSchema.safeParse({ question: item.q, language: "UZ" });
    const question = parsed.success ? parsed.data.question : item.q;

    let u: ReturnType<typeof understandQuery>;
    let matches: Awaited<ReturnType<typeof matchCurriculumTopics>>;
    try {
      u = understandQuery(question);
      matches = await matchCurriculumTopics(u, 5);
    } catch (error) {
      provenanceProblems.push(`${item.note}: quvur yiqildi — ${error instanceof Error ? error.message.split("\n")[0] : error}`);
      continue;
    }

    const grounding = validateAndGroundAnswer(NEUTRAL, u, matches);
    const serialized = JSON.stringify({ u, matches, grounding });

    // (a) Har bir iqtibos bazadagi haqiqiy yozuv bo'lishi shart.
    for (const cite of grounding.sourceCitations) {
      if (!validIds.has(cite.sourceId)) provenanceProblems.push(`${item.note}: soxta dalil id ${cite.sourceId}`);
      const dbRow = dbTopics.find((t) => t.id === cite.sourceId);
      if (dbRow && dbRow.topicName !== cite.topicName) {
        provenanceProblems.push(`${item.note}: iqtibos sarlavhasi bazadan farq qiladi`);
      }
      if (dbRow && dbRow.grade !== cite.grade) {
        provenanceProblems.push(`${item.note}: iqtibos sinfi bazadan farq qiladi`);
      }
      // (b) Versiya manbadan olingan bo'lishi shart, uydirilgan emas.
      const derived = deriveCurriculumProvenance(dbRow?.source ?? "");
      if (cite.sourceVersion !== derived.sourceVersion) {
        provenanceProblems.push(
          `${item.note}: versiya mos emas ${cite.sourceVersion} != ${derived.sourceVersion}`,
        );
      }
    }

    // (c) Sirlar chiqmasligi shart.
    for (const key of ["AI_API_KEY", "AUTH_SECRET", "DATABASE_URL"]) {
      const value = process.env[key];
      if (value && value.length > 8 && serialized.includes(value)) {
        provenanceProblems.push(`${item.note}: ${key} QIYMATI chiqdi`);
      }
    }

    // (d) Qamrovsiz so'rovda rasmiy tasdiq bo'lmasligi shart.
    const coverage = getCurriculumCoverage(u.detectedSubject, u.detectedGrade);
    if (!canProvideOfficialEvidence(coverage) && isOfficiallyVerified(grounding, matches.length)) {
      provenanceProblems.push(`${item.note}: qamrovsiz so'rov RASMIY TASDIQ oldi`);
    }

    // (e) Boshqaruv belgilari bazagacha yetmasligi shart.
    if (question.includes(NUL)) provenanceProblems.push(`${item.note}: NUL bayti sxemadan o'tdi`);

    adversarialOk++;
  }

  record(
    "3-PROVENANS",
    "adversarial so'rovlarda provenans buzilmaydi",
    "0 muammo",
    provenanceProblems.length === 0 ? `0 muammo (${adversarialOk} so'rov)` : provenanceProblems.join(" | "),
    provenanceProblems.length === 0,
  );

  // Uydirma bo'lim nomi tutiladimi?
  const fabricated: SearchAnswer = {
    ...NEUTRAL,
    answer: "Rasmiy o'quv dasturidagi «KOMPLEKS SONLAR NAZARIYASI» bo'limiga ko'ra mavzu chuqur o'rganiladi.",
  };
  const fabResult = validateAndGroundAnswer(fabricated, u8, matches8);
  record(
    "3-PROVENANS",
    "javobdagi UYDIRMA bo'lim nomi tutiladi",
    "SOURCE_CONFLICT mavjud",
    `sourceConflictRate=${fabResult.sourceConflictRate}`,
    fabResult.sourceConflictRate > 0,
  );

  const genuine: SearchAnswer = {
    ...NEUTRAL,
    answer: "Rasmiy o'quv dasturidagi «KVADRAT TENGLAMALAR» bo'limi mavzuni to'liq qamrab oladi.",
  };
  const genResult = validateAndGroundAnswer(genuine, u8, matches8);
  record(
    "3-PROVENANS",
    "HAQIQIY bo'lim nomi yolg'on musbat bermaydi",
    "sourceConflictRate = 0",
    `${genResult.sourceConflictRate}`,
    genResult.sourceConflictRate === 0,
  );

  // NUL bayti va apostrof
  const nulParsed = searchInputSchema.parse({ question: `5-sinf matematika kasrlar${NUL} mavzusi`, language: "UZ" });
  record(
    "3-PROVENANS",
    "NUL bayti sxemada tozalanadi",
    "boshqaruv belgisi qolmaydi",
    `${[...nulParsed.question].filter((c) => c.charCodeAt(0) < 32).length} ta boshqaruv belgisi`,
    ![...nulParsed.question].some((c) => c.charCodeAt(0) < 32),
  );

  const apos = normalizeQuery("8-sinf matematika to'rtburchaklar").normalized;
  record(
    "3-PROVENANS",
    "to'… so'zlari buzilmaydi (V5 regressiyasi)",
    "to'rtburchaklar saqlanadi",
    apos,
    /to'rtburchaklar/.test(apos),
  );

  // ─────────────────────────────────────────────────────────────────────
  // PHASE 5 — TAVSIYAVIY MANTIQ QARORLARI
  // ─────────────────────────────────────────────────────────────────────
  const matcherSource = fs.readFileSync(path.join(process.cwd(), "lib/search/curriculum-matcher.ts"), "utf8");
  record(
    "5-ADVISORY",
    "candidateDepth quvurga ULANMAGAN",
    "matchCurriculumTopics qat'iy 50 ishlatadi",
    /retrieveCurriculumCandidates\(understanding, 50\)/.test(matcherSource) ? "qat'iy 50" : "o'zgargan",
    /retrieveCurriculumCandidates\(understanding, 50\)/.test(matcherSource) &&
      !/candidateDepth/.test(matcherSource),
  );

  const uUncovered = understandQuery("1-sinf matematika sonlarni qo'shish");
  record(
    "5-ADVISORY",
    "ehtiyotkorlik coverage.ts orqali amalga oshiriladi",
    "shouldAbstain=false bo'lsa ham qamrov to'sadi",
    `shouldAbstain=${determineAdaptiveStrategy(uUncovered).shouldAbstain}, ` +
      `coverage=${getCurriculumCoverage(uUncovered.detectedSubject, uUncovered.detectedGrade).status}`,
    canProvideOfficialEvidence(
      getCurriculumCoverage(uUncovered.detectedSubject, uUncovered.detectedGrade),
    ) === false,
  );

  const searchDir = path.join(process.cwd(), "lib", "search");
  const importsScoring = fs
    .readdirSync(searchDir)
    .filter((f) => f.endsWith(".ts") && f !== "scoring.ts")
    .filter((f) => /from\s+["']\.\/scoring["']/.test(fs.readFileSync(path.join(searchDir, f), "utf8")));
  record(
    "5-ADVISORY",
    "scoring.ts production quvuridan ajratilgan",
    "lib/search ichidan import yo'q",
    importsScoring.length === 0 ? "import yo'q" : importsScoring.join(", "),
    importsScoring.length === 0,
  );

  // ─────────────────────────────────────────────────────────────────────
  // PHASE 7 — DETERMINIZM
  // ─────────────────────────────────────────────────────────────────────
  const detA = await retrieveCurriculumCandidates(understandQuery("8-sinf matematika tenglama"), 100);
  const detB = await retrieveCurriculumCandidates(understandQuery("8-sinf matematika tenglama"), 100);
  record(
    "7-SIFAT",
    "nomzodlar tartibi DETERMINISTIK",
    "ikki chaqiruvda bir xil ketma-ketlik",
    `${detA.map((c) => c.id).join(",") === detB.map((c) => c.id).join(",") ? "bir xil" : "farqli"}`,
    detA.map((c) => c.id).join(",") === detB.map((c) => c.id).join(","),
  );

  const nonDeterministicIds = dbTopics.filter((t) => !t.id.startsWith("dts_"));
  record(
    "7-SIFAT",
    "o'quv dasturi id'lari deterministik",
    "barcha id dts_ bilan boshlanadi",
    `${nonDeterministicIds.length} ta nomos id`,
    nonDeterministicIds.length === 0,
  );

  const wrongVersion = dbTopics.filter((t) => {
    const derived = deriveCurriculumProvenance(t.source);
    const year = /qabul(\d{4})/.exec(t.source)?.[1];
    return year ? derived.curriculumYear !== Number(year) : false;
  });
  record(
    "7-SIFAT",
    "provenans versiyasi manbaga mos",
    "0 nomuvofiqlik",
    `${wrongVersion.length} ta nomuvofiqlik`,
    wrongVersion.length === 0,
  );

  // ─────────────────────────────────────────────────────────────────────
  // PHASE 6 — PERFORMANCE (mahalliy quvur)
  // ─────────────────────────────────────────────────────────────────────
  const perfQueries = [
    "8-sinf matematika kvadrat tenglamalar",
    "5-sinf matematika oddiy kasrlar",
    "9-sinf matematika trigonometriya",
    "6-sinf ona tili so'z turkumlari",
    "10-sinf matematika hosila",
  ];
  const timings: number[] = [];
  for (let i = 0; i < 40; i++) {
    const q = perfQueries[i % perfQueries.length];
    const t0 = performance.now();
    const u = understandQuery(q);
    const m = await matchCurriculumTopics(u, 5);
    validateAndGroundAnswer(NEUTRAL, u, m);
    timings.push(performance.now() - t0);
  }
  timings.sort((a, b) => a - b);
  const pick = (p: number) => Number(timings[Math.min(timings.length - 1, Math.floor(timings.length * p))].toFixed(2));
  const perf = { p50: pick(0.5), p95: pick(0.95), p99: pick(0.99) };
  record(
    "6-PERF",
    "mahalliy quvur p95 chegarada",
    "p95 <= 60 ms (LLMsiz)",
    `p50=${perf.p50}ms p95=${perf.p95}ms p99=${perf.p99}ms`,
    perf.p95 <= 60,
  );

  // ─────────────────────────────────────────────────────────────────────
  const failed = checks.filter((c) => !c.pass);
  console.log("\n==========================================================");
  console.log(`Tekshiruvlar: ${checks.length} | PASS: ${checks.length - failed.length} | FAIL: ${failed.length}`);
  console.log("==========================================================");

  fs.mkdirSync(path.join(process.cwd(), "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "reports", "search-v6-release-checks.json"),
    `${JSON.stringify({ timestamp: new Date().toISOString(), localPipelineLatencyMs: perf, checks }, null, 2)}\n`,
  );
  console.log("✅ reports/search-v6-release-checks.json yozildi.");

  await prisma.$disconnect();
  if (failed.length > 0) process.exit(1);
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
