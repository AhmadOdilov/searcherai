/**
 * Searcher AI — Intelligence V5 to'liq baholash to'plami.
 *
 * ── Nega V4 skripti o'rniga yangisi kerak bo'ldi ──────────────────────────
 * `scripts/evaluate-v4-full.ts` da uchta o'lchov STRUKTURAVIY buzuq edi:
 *
 *  1. Abstention Precision har doim 100% chiqardi:
 *       const seededAbstained = 0;   // hech qachon o'zgarmaydi
 *       precision = unseededAbstained / (unseededAbstained + seededAbstained)
 *     Ya'ni bu o'lchov hech qachon yiqila olmasdi — qattiq kodlangan natija.
 *
 *  2. Cross-grade tekshiruvi `if (item.goldEvidenceTopicId)` bloki ICHIDA edi,
 *     datasetdagi yagona cross-grade so'rovning esa gold id'si `null`.
 *     Natijada tekshiruv umuman bajarilmagan (0/1), hisobotda esa
 *     `crossGradeTotal > 0 ? ... : 100` sababli 100% ko'rinishi mumkin edi.
 *
 *  3. "Unseeded" populyatsiyasi = gold id'siz HAR QANDAY so'rov (434 ta),
 *     holbuki ularning ko'pi rasmiy dasturi MAVJUD fanlarga tegishli.
 *
 * V5 da har bir o'lchov yiqila oladigan qilib qayta yozildi va populyatsiyalar
 * aniq ajratildi. Hech bir ko'rsatkich konstantaga bog'lanmagan.
 *
 * ── Bu skript NIMANI o'lchamaydi ──────────────────────────────────────────
 * Tashqi LLM generatsiyasi bu yerda chaqirilmaydi. Shuning uchun latency
 * raqamlari FAQAT mahalliy quvurga (understanding → retrieval → rerank →
 * validation) tegishli va E2E javob vaqti EMAS.
 */

import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { understandQuery, type SearchIntent, type AudienceMode } from "../lib/search/understanding";
import { retrieveCurriculumCandidates } from "../lib/search/curriculum-matcher";
import { rerankCandidates } from "../lib/search/reranker";
import { validateAndGroundAnswer } from "../lib/search/validator";
import { getSubjectCurriculumStatus } from "../lib/curriculum/ingestion/registry";
import { prisma } from "../lib/db";
import type { LanguageCode } from "../lib/validations/common";
import { searchInputSchema, type SearchAnswer } from "../lib/validations/search";

interface EvalItem {
  id: string;
  suite: string;
  q: string;
  expectedLanguage: LanguageCode;
  expectedSubject?: string;
  expectedGrade?: string;
  expectedIntent?: SearchIntent;
  expectedAudience?: AudienceMode;
  goldEvidenceTopicId?: string | null;
  goldEvidenceTopicTitle?: string | null;
  expectAbstention?: boolean;
  isUnsupportedSubject?: boolean;
  isCrossGrade?: boolean;
  expectedAvailableGrade?: string;
  forbiddenPatterns?: string[];
  difficulty?: string;
  category?: string;
}

/** §21 — 30 ta nosozlik toifasi. */
const FAILURE_BUCKETS = [
  "typo", "synonym_gap", "grade_mismatch", "subject_mismatch",
  "intent_misclassification", "polysemy", "cross_lingual_mismatch",
  "complex_multi_concept", "ocr_phonetic_noise", "conversational_vague_query",
  "over_filtering", "curriculum_out_of_scope", "reranker_demotion",
  "truncation_embedding_dimension_limit",
  "false_grounding", "false_abstention", "unsupported_claim", "contradiction",
  "subject_boundary", "audience_boundary", "intent_boundary",
  "cache_collision", "cache_staleness", "prompt_injection",
  "evidence_mismatch", "cross_grade_false_positive", "cross_grade_false_negative",
  "UI_grounding_mismatch", "malformed_llm_output", "stale_curriculum",
] as const;

type FailureBucket = (typeof FAILURE_BUCKETS)[number];

function computeDCG(relevance: number[], k: number): number {
  let dcg = 0;
  for (let i = 0; i < Math.min(relevance.length, k); i++) {
    dcg += (Math.pow(2, relevance[i]) - 1) / Math.log2(i + 2);
  }
  return dcg;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;
}

/** Neytral javob — validator tomonidan berilgan da'volarni o'lchash uchun. */
const NEUTRAL_ANSWER: SearchAnswer = {
  answer:
    "Ushbu mavzu bo'yicha asosiy tushunchalar bosqichma-bosqich tushuntiriladi va sinfda qo'llash yo'llari ko'rsatiladi.",
  keyPoints: ["Asosiy tushuncha", "Amaliy misol", "Tipik xatolar"],
  classroomIdeas: ["Kichik guruhlarda amaliy mashq", "Doskada birgalikda yechish"],
};

/** Soatlar bo'yicha ATAYLAB zid javob — validator ziddiyatni topishi shart. */
function contradictoryAnswer(realHours: number): SearchAnswer {
  return {
    ...NEUTRAL_ANSWER,
    answer: `Ushbu bo'lim uchun rasmiy o'quv dasturida ${realHours + 40} soat ajratilgan.`,
  };
}

/** Soatlar bo'yicha TO'G'RI javob — validator uni ziddiyat deb belgilamasligi shart. */
function faithfulAnswer(realHours: number): SearchAnswer {
  return {
    ...NEUTRAL_ANSWER,
    answer: `Ushbu bo'lim uchun rasmiy o'quv dasturida ${realHours} soat ajratilgan.`,
  };
}

async function main() {
  const root = process.cwd();
  const core: EvalItem[] = JSON.parse(
    fs.readFileSync(path.join(root, "benchmark", "golden-dataset-500.json"), "utf8"),
  ).map((x: EvalItem) => ({ ...x, suite: "golden_core" }));

  const v5Dir = path.join(root, "benchmark", "v5");
  const suiteFiles = fs.existsSync(v5Dir)
    ? fs.readdirSync(v5Dir).filter((f) => f.endsWith(".json") && f !== "multi_turn.json").sort()
    : [];

  const extra: EvalItem[] = suiteFiles.flatMap(
    (f) => JSON.parse(fs.readFileSync(path.join(v5Dir, f), "utf8")) as EvalItem[],
  );

  const dataset = [...core, ...extra];

  // Bazadagi haqiqiy id'lar — soxta iqtibos (fake DTS citation) tekshiruvi uchun.
  const dbTopics = await prisma.curriculumTopic.findMany({
    select: { id: true, subject: true, grade: true, expectedHours: true },
  });
  const validTopicIds = new Set(dbTopics.map((t) => t.id));
  const hoursById = new Map(dbTopics.map((t) => [t.id, t.expectedHours]));
  const seededGrades = new Map<string, Set<string>>();
  for (const t of dbTopics) {
    const key = t.subject.toLowerCase();
    if (!seededGrades.has(key)) seededGrades.set(key, new Set());
    seededGrades.get(key)!.add(t.grade.toLowerCase());
  }

  console.log("==========================================================");
  console.log(`   SEARCHER AI — V5 EVALUATION (${dataset.length} QUERIES)`);
  console.log("==========================================================\n");

  // ── Hisoblagichlar ─────────────────────────────────────────────────────
  let langCorrect = 0, langTotal = 0;
  let subjCorrect = 0, subjTotal = 0;
  let gradeCorrect = 0, gradeTotal = 0;
  let intentCorrect = 0, intentTotal = 0;
  let audCorrect = 0, audTotal = 0;
  // Auditoriya: aniq marker bo'lgan va bo'lmagan holatlar ALOHIDA o'lchanadi.
  let audExplicitCorrect = 0, audExplicitTotal = 0;
  let audDefaultAgree = 0, audDefaultTotal = 0;
  // V6: auditoriya QANDAY aniqlanganini holat bo'yicha kesish.
  const audienceByResolution: Record<string, { total: number; correct: number }> = {};

  let retrievalEvaluated = 0;
  let candHit20 = 0, candHit50 = 0, candHit100 = 0;
  let rerankHit1 = 0, rerankHit3 = 0, rerankHit5 = 0;
  let rrSum = 0, ndcg5Sum = 0, ndcg10Sum = 0, precision5Sum = 0;

  // Abstention — ikkala populyatsiya ham haqiqiy va yiqila oladi.
  let shouldAbstainTotal = 0, correctlyAbstained = 0;
  let shouldGroundTotal = 0, wronglyAbstained = 0;
  let falseGrounding = 0;

  let crossGradeTotal = 0, crossGradeCorrect = 0, crossGradeWrongGrade = 0;
  let nonCrossGradeTotal = 0, crossGradeFalsePositive = 0;

  let fakeCitations = 0, totalCitations = 0;

  let securityTotal = 0, securityLeaks = 0;
  const securityFindings: string[] = [];

  let claimTotal = 0, claimSupported = 0, claimContradicted = 0, claimUnsupported = 0;
  /*
    Ziddiyatlar TURI bo'yicha ajratiladi.

    Sabab: validator cross-grade holatini ham "contradicted" deb belgilaydi.
    Lekin sinf tafovuti — bu javobning dalilga ZID kelishi emas, balki
    tizim OCHIQ aytayotgan ogohlantirish (so'ralgan sinf boshqa). Ikkalasini
    bitta foizga qo'shish "ziddiyat darajasi" o'lchovini chalg'ituvchi
    qiladi, chunki benchmarkka cross-grade so'rovlari qancha ko'p qo'shilsa,
    "ziddiyat" shuncha o'sadi.

    Shuning uchun ikkala raqam ham chiqariladi va HECH BIRI yashirilmaydi.
  */
  const contradictionsByType: Record<string, number> = {};
  let hoursProbeTotal = 0, hoursContradictionDetected = 0, hoursFalsePositive = 0;

  const buckets: Record<FailureBucket, number> = Object.fromEntries(
    FAILURE_BUCKETS.map((b) => [b, 0]),
  ) as Record<FailureBucket, number>;

  const failures: Array<{ id: string; suite: string; q: string; bucket: FailureBucket; detail: string }> = [];
  const latTotal: number[] = [];
  const latUnderstanding: number[] = [];
  const latRetrieval: number[] = [];
  const latRerank: number[] = [];
  const latValidation: number[] = [];

  const addFailure = (item: EvalItem, bucket: FailureBucket, detail: string) => {
    buckets[bucket]++;
    if (failures.length < 500) {
      failures.push({ id: item.id, suite: item.suite, q: item.q, bucket, detail });
    }
  };

  for (const item of dataset) {
    const t0 = performance.now();
    const u = understandQuery(item.q);
    const t1 = performance.now();
    latUnderstanding.push(t1 - t0);

    // ── 1. Query understanding ───────────────────────────────────────────
    if (item.suite !== "adversarial") {
      langTotal++;
      if (u.detectedLanguage === item.expectedLanguage) langCorrect++;
      else addFailure(item, "cross_lingual_mismatch", `til: ${u.detectedLanguage} != ${item.expectedLanguage}`);

      if (item.expectedSubject) {
        subjTotal++;
        if (u.detectedSubject?.toLowerCase() === item.expectedSubject.toLowerCase()) subjCorrect++;
        else addFailure(item, "subject_boundary", `fan: ${u.detectedSubject ?? "yo'q"} != ${item.expectedSubject}`);
      }
      if (item.expectedGrade) {
        gradeTotal++;
        if (u.detectedGrade?.toLowerCase() === item.expectedGrade.toLowerCase()) gradeCorrect++;
        else addFailure(item, "grade_mismatch", `sinf: ${u.detectedGrade ?? "yo'q"} != ${item.expectedGrade}`);
      }
      if (item.expectedIntent) {
        intentTotal++;
        if (u.detectedIntent === item.expectedIntent) intentCorrect++;
        else addFailure(item, "intent_boundary", `intent: ${u.detectedIntent} != ${item.expectedIntent}`);
      }
      if (item.expectedAudience) {
        audTotal++;
        const audienceOk = u.audience === item.expectedAudience;
        if (audienceOk) audCorrect++;
        else addFailure(item, "audience_boundary", `auditoriya: ${u.audience} != ${item.expectedAudience}`);

        /*
          So'rovda auditoriya markeri bo'lmasa, tizim standart qiymat
          ("teacher" — mahsulotning asosiy foydalanuvchisi) qo'llaydi.
          Bu TAXMIN, aniqlangan fakt emas, shuning uchun u aniq markerli
          holatlar bilan bitta foizga qo'shilmaydi.
        */
        if (u.audienceIsExplicit) {
          audExplicitTotal++;
          if (audienceOk) audExplicitCorrect++;
        } else {
          audDefaultTotal++;
          if (audienceOk) audDefaultAgree++;
        }

        audienceByResolution[u.audienceResolution] ??= { total: 0, correct: 0 };
        audienceByResolution[u.audienceResolution].total++;
        if (audienceOk) audienceByResolution[u.audienceResolution].correct++;
      }
    }

    // ── 2. Retrieval + rerank ────────────────────────────────────────────
    const t2 = performance.now();
    const candidates = await retrieveCurriculumCandidates(u, 100);
    const t3 = performance.now();
    latRetrieval.push(t3 - t2);

    const top10 = await rerankCandidates(candidates, u, 10);
    const t4 = performance.now();
    latRerank.push(t4 - t3);

    const grounding = validateAndGroundAnswer(NEUTRAL_ANSWER, u, top10.slice(0, 5));
    const t5 = performance.now();
    latValidation.push(t5 - t4);
    latTotal.push(t5 - t0);

    claimTotal += grounding.claims.length;
    claimSupported += grounding.claims.filter((c) => c.status === "supported").length;
    for (const claim of grounding.claims.filter((c) => c.status === "contradicted")) {
      claimContradicted++;
      contradictionsByType[claim.type] = (contradictionsByType[claim.type] ?? 0) + 1;
    }
    claimUnsupported += grounding.claims.filter((c) => c.status === "unsupported").length;

    // Soxta iqtibos: bazada mavjud bo'lmagan id'ga havola.
    for (const cite of grounding.sourceCitations) {
      totalCitations++;
      if (!validTopicIds.has(cite.sourceId)) {
        fakeCitations++;
        addFailure(item, "evidence_mismatch", `bazada yo'q dalil id: ${cite.sourceId}`);
      }
    }

    const abstained = top10.length === 0 || grounding.isAbstained === true;

    // ── 3. Gold dalil bo'lgan so'rovlar ──────────────────────────────────
    if (item.goldEvidenceTopicId) {
      retrievalEvaluated++;
      shouldGroundTotal++;

      const target = item.goldEvidenceTopicId;
      const candRank = candidates.findIndex((c) => c.id === target);
      if (candRank !== -1) {
        if (candRank < 20) candHit20++;
        if (candRank < 50) candHit50++;
        if (candRank < 100) candHit100++;
      } else {
        addFailure(item, "synonym_gap", `nomzodlar orasida yo'q (${candidates.length} ta nomzod)`);
      }

      const rank = top10.findIndex((m) => m.sourceId === target) + 1;
      if (rank > 0) {
        if (rank === 1) rerankHit1++;
        if (rank <= 3) rerankHit3++;
        if (rank <= 5) rerankHit5++;
        rrSum += 1 / rank;
        precision5Sum += rank <= 5 ? 1 / 5 : 0;

        const rel5 = Array(5).fill(0);
        if (rank <= 5) rel5[rank - 1] = 1;
        ndcg5Sum += computeDCG(rel5, 5) / computeDCG([1], 5);

        const rel10 = Array(10).fill(0);
        rel10[rank - 1] = 1;
        ndcg10Sum += computeDCG(rel10, 10) / computeDCG([1], 10);
      } else if (candRank !== -1) {
        addFailure(item, "reranker_demotion", `nomzodlarda ${candRank}-o'rin, top10'da yo'q`);
      }

      if (abstained) {
        wronglyAbstained++;
        addFailure(item, "false_abstention", "rasmiy dalil mavjud, lekin tizim ehtiyot rejimiga o'tdi");
      }

      // Soatlar ziddiyati zondlari — validator haqiqatan ziddiyatni topadimi?
      const realHours = hoursById.get(target) ?? null;
      if (realHours && realHours > 0 && top10[0]?.sourceId === target) {
        hoursProbeTotal++;
        const bad = validateAndGroundAnswer(contradictoryAnswer(realHours), u, top10.slice(0, 5));
        if (bad.claims.some((c) => c.type === "hours" && c.status === "contradicted")) {
          hoursContradictionDetected++;
        } else {
          addFailure(item, "contradiction", `soatlar ziddiyati aniqlanmadi (rasmiy: ${realHours})`);
        }
        const good = validateAndGroundAnswer(faithfulAnswer(realHours), u, top10.slice(0, 5));
        if (good.claims.some((c) => c.type === "hours" && c.status === "contradicted")) {
          hoursFalsePositive++;
          addFailure(item, "unsupported_claim", `to'g'ri soat (${realHours}) noto'g'ri ziddiyat deb belgilandi`);
        }
      }
    }

    // ── 4. Abstention kutilgan so'rovlar ─────────────────────────────────
    const registry = item.expectedSubject ? getSubjectCurriculumStatus(item.expectedSubject) : null;
    const subjectUnavailable = registry?.status === "NOT_AVAILABLE";
    const gradeUnavailable = Boolean(
      item.expectedSubject &&
        item.expectedGrade &&
        !subjectUnavailable &&
        !seededGrades.get(item.expectedSubject.toLowerCase())?.has(item.expectedGrade.toLowerCase()),
    );
    const mustAbstain =
      item.expectAbstention === true ||
      item.isUnsupportedSubject === true ||
      subjectUnavailable ||
      gradeUnavailable;

    if (mustAbstain && !item.goldEvidenceTopicId) {
      shouldAbstainTotal++;
      if (abstained) {
        correctlyAbstained++;
      } else {
        addFailure(item, "curriculum_out_of_scope", "rasmiy dalil yo'q, lekin tizim ehtiyot rejimiga o'tmadi");
      }
      if (grounding.isGrounded) {
        falseGrounding++;
        addFailure(item, "false_grounding", `rasmiy dalilsiz grounded=true (ball ${top10[0]?.score ?? 0})`);
      }
    }

    // ── 5. Cross-grade ───────────────────────────────────────────────────
    if (item.isCrossGrade && item.expectedAvailableGrade) {
      crossGradeTotal++;
      const warned = top10
        .slice(0, 5)
        .find((m) => m.isCrossGrade === true || m.crossGradeMatch === true);
      if (!warned) {
        addFailure(item, "cross_grade_false_negative", "sinf tafovuti ogohlantirishi chiqmadi");
      } else if (
        warned.availableGrade?.toLowerCase() !== item.expectedAvailableGrade.toLowerCase()
      ) {
        crossGradeWrongGrade++;
        addFailure(
          item,
          "cross_grade_false_negative",
          `noto'g'ri sinf ko'rsatildi: ${warned.availableGrade} != ${item.expectedAvailableGrade}`,
        );
      } else {
        crossGradeCorrect++;
      }
    } else if (item.goldEvidenceTopicId && !item.isCrossGrade) {
      nonCrossGradeTotal++;
      if (top10[0]?.isCrossGrade === true) {
        crossGradeFalsePositive++;
        addFailure(item, "cross_grade_false_positive", `1-o'rinda boshqa sinf: ${top10[0].grade}`);
      }
    }

    // ── 6. Xavfsizlik ────────────────────────────────────────────────────
    if (item.suite === "adversarial") {
      securityTotal++;

      /*
        DIQQAT — bu tekshiruv ATAYLAB tor.

        Hujum matnining javobda QAYTA UCHRASHI o'z-o'zidan zaiflik emas:
        foydalanuvchi savolining o'zi tabiiy ravishda `originalQuery` da
        qaytariladi va React uni escape qilib chiqaradi. Shuning uchun
        "so'rovda `<script>` bor edi, javobda ham bor" degan signal
        YOLG'ON POZITIV bo'ladi.

        Haqiqiy buzilish deb faqat quyidagilar hisoblanadi:
          a) muhit sirining QIYMATI chiqib ketishi;
          b) tozalangichdan keyin ham bajariladigan teg qolishi;
          c) bazada mavjud bo'lmagan DTS dalili to'qib chiqarilishi;
          d) so'rovning DB xatosiga olib kelishi (ishlov berilmagan 500).
      */
      const sanitized = searchInputSchema.safeParse({ question: item.q, language: "UZ" });
      const sanitizedQuestion = sanitized.success ? sanitized.data.question : "";

      const emitted = [
        JSON.stringify(u),
        grounding.caution ?? "",
        grounding.claims.map((c) => `${c.claim} ${c.evidence ?? ""}`).join(" "),
        grounding.sourceCitations.map((c) => c.source).join(" "),
      ].join(" ");

      const leaked: string[] = [];

      // (a) Sirlarning QIYMATI — nomi emas.
      for (const envKey of ["AI_API_KEY", "AUTH_SECRET", "DATABASE_URL"]) {
        const value = process.env[envKey];
        if (value && value.length > 8 && emitted.includes(value)) {
          leaked.push(`${envKey}_value_leaked`);
        }
      }

      // (b) Tozalangichdan keyin bajariladigan teg qolmasligi kerak.
      if (sanitized.success && /<\s*\/?\s*(script|img|iframe|svg)\b/i.test(sanitizedQuestion)) {
        leaked.push("tag_survived_sanitizer");
      }

      // (c) Soxta dalil — bazada bo'lmagan id.
      for (const cite of grounding.sourceCitations) {
        if (!validTopicIds.has(cite.sourceId)) leaked.push("fabricated_dts_evidence");
      }

      if (leaked.length > 0) {
        securityLeaks++;
        securityFindings.push(`${item.id}: ${leaked.join(", ")}`);
        addFailure(item, "prompt_injection", leaked.join(", "));
      }
    }
  }

  // ── Yakuniy hisob ────────────────────────────────────────────────────
  latTotal.sort((a, b) => a - b);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const abstentionPrecision = pct(correctlyAbstained, correctlyAbstained + wronglyAbstained);
  const abstentionRecall = pct(correctlyAbstained, shouldAbstainTotal);

  const report = {
    timestamp: new Date().toISOString(),
    datasetComposition: {
      total: dataset.length,
      bySuite: dataset.reduce<Record<string, number>>((acc, i) => {
        acc[i.suite] = (acc[i.suite] ?? 0) + 1;
        return acc;
      }, {}),
      withGoldEvidence: dataset.filter((i) => i.goldEvidenceTopicId).length,
    },
    understanding: {
      languageAccuracy: pct(langCorrect, langTotal),
      subjectAccuracy: pct(subjCorrect, subjTotal),
      gradeAccuracy: pct(gradeCorrect, gradeTotal),
      intentAccuracy: pct(intentCorrect, intentTotal),
      audienceAccuracy: pct(audCorrect, audTotal),
      audienceExplicitAccuracy: pct(audExplicitCorrect, audExplicitTotal),
      audienceDefaultAgreement: pct(audDefaultAgree, audDefaultTotal),
      audienceByResolution: Object.fromEntries(
        Object.entries(audienceByResolution).map(([k, v]) => [
          k,
          { ...v, accuracy: pct(v.correct, v.total) },
        ]),
      ),
      evaluated: {
        langTotal, subjTotal, gradeTotal, intentTotal, audTotal,
        audExplicitTotal, audDefaultTotal,
      },
    },
    candidateRetrieval: {
      evaluatedQueries: retrievalEvaluated,
      recall20: pct(candHit20, retrievalEvaluated),
      recall50: pct(candHit50, retrievalEvaluated),
      recall100: pct(candHit100, retrievalEvaluated),
      avgLatencyMs: Number(avg(latRetrieval).toFixed(2)),
    },
    reranker: {
      evaluatedQueries: retrievalEvaluated,
      recall1: pct(rerankHit1, retrievalEvaluated),
      recall3: pct(rerankHit3, retrievalEvaluated),
      recall5: pct(rerankHit5, retrievalEvaluated),
      precision5: pct(precision5Sum, retrievalEvaluated),
      mrr: Number((rrSum / Math.max(1, retrievalEvaluated)).toFixed(4)),
      ndcg5: Number((ndcg5Sum / Math.max(1, retrievalEvaluated)).toFixed(4)),
      ndcg10: Number((ndcg10Sum / Math.max(1, retrievalEvaluated)).toFixed(4)),
      avgLatencyMs: Number(avg(latRerank).toFixed(2)),
    },
    abstention: {
      shouldAbstainTotal,
      correctlyAbstained,
      shouldGroundTotal,
      wronglyAbstained,
      precision: abstentionPrecision,
      recall: abstentionRecall,
      falseGrounding,
    },
    crossGrade: {
      total: crossGradeTotal,
      correct: crossGradeCorrect,
      wrongGradeReported: crossGradeWrongGrade,
      accuracy: pct(crossGradeCorrect, crossGradeTotal),
      nonCrossGradeTotal,
      falsePositives: crossGradeFalsePositive,
      falsePositiveRate: pct(crossGradeFalsePositive, nonCrossGradeTotal),
    },
    grounding: {
      totalClaims: claimTotal,
      supportedClaimRate: pct(claimSupported, claimTotal),
      contradictionRate: pct(claimContradicted, claimTotal),
      contradictionsByType,
      // Sinf tafovuti ogohlantirishlarisiz — ya'ni javob dalilga zid kelgan holatlar.
      factualContradictionRate: pct(
        claimContradicted - (contradictionsByType.grade ?? 0),
        claimTotal,
      ),
      unsupportedClaimRate: pct(claimUnsupported, claimTotal),
      totalCitations,
      fakeDtsCitations: fakeCitations,
      hoursProbe: {
        probed: hoursProbeTotal,
        contradictionsDetected: hoursContradictionDetected,
        detectionRate: pct(hoursContradictionDetected, hoursProbeTotal),
        falsePositives: hoursFalsePositive,
      },
    },
    security: {
      adversarialQueries: securityTotal,
      leaks: securityLeaks,
      passRate: pct(securityTotal - securityLeaks, securityTotal),
      findings: securityFindings.slice(0, 50),
    },
    latencyLocalPipelineMs: {
      note: "Tashqi LLM generatsiyasi KIRMAGAN — faqat mahalliy quvur.",
      understandingAvg: Number(avg(latUnderstanding).toFixed(3)),
      retrievalAvg: Number(avg(latRetrieval).toFixed(2)),
      rerankAvg: Number(avg(latRerank).toFixed(2)),
      validationAvg: Number(avg(latValidation).toFixed(3)),
      p50: Number(percentile(latTotal, 0.5).toFixed(2)),
      p95: Number(percentile(latTotal, 0.95).toFixed(2)),
      p99: Number(percentile(latTotal, 0.99).toFixed(2)),
    },
    failureBuckets: buckets,
  };

  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "reports", "search-v5-evaluation.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(root, "reports", "search-v5-failures.json"),
    `${JSON.stringify({ timestamp: report.timestamp, total: failures.length, failures }, null, 2)}\n`,
  );

  console.log("## 1. QUERY UNDERSTANDING");
  console.log(`- Language:  ${report.understanding.languageAccuracy}% (${langCorrect}/${langTotal})`);
  console.log(`- Subject:   ${report.understanding.subjectAccuracy}% (${subjCorrect}/${subjTotal})`);
  console.log(`- Grade:     ${report.understanding.gradeAccuracy}% (${gradeCorrect}/${gradeTotal})`);
  console.log(`- Intent:    ${report.understanding.intentAccuracy}% (${intentCorrect}/${intentTotal})`);
  console.log(`- Audience:  ${report.understanding.audienceAccuracy}% (${audCorrect}/${audTotal})`);
  console.log(`    · aniq markerli:  ${report.understanding.audienceExplicitAccuracy}% (${audExplicitCorrect}/${audExplicitTotal})`);
  console.log(`    · markersiz (xulosa/standart):     ${report.understanding.audienceDefaultAgreement}% (${audDefaultAgree}/${audDefaultTotal})`);
  for (const [res, stat] of Object.entries(report.understanding.audienceByResolution)) {
    const s2 = stat as { total: number; correct: number; accuracy: number };
    console.log(`    · ${res.padEnd(18)} ${String(s2.accuracy).padStart(6)}% (${s2.correct}/${s2.total})`);
  }

  console.log("\n## 2. CANDIDATE RETRIEVAL");
  console.log(`- Recall@20:  ${report.candidateRetrieval.recall20}%`);
  console.log(`- Recall@50:  ${report.candidateRetrieval.recall50}%`);
  console.log(`- Recall@100: ${report.candidateRetrieval.recall100}%`);

  console.log("\n## 3. RERANKER");
  console.log(`- Recall@1: ${report.reranker.recall1}%`);
  console.log(`- Recall@3: ${report.reranker.recall3}%`);
  console.log(`- Recall@5: ${report.reranker.recall5}%`);
  console.log(`- MRR:      ${report.reranker.mrr}`);
  console.log(`- nDCG@5:   ${report.reranker.ndcg5}`);

  console.log("\n## 4. ABSTENTION (ikkala populyatsiya ham haqiqiy)");
  console.log(`- Precision: ${abstentionPrecision}% (${correctlyAbstained}/${correctlyAbstained + wronglyAbstained})`);
  console.log(`- Recall:    ${abstentionRecall}% (${correctlyAbstained}/${shouldAbstainTotal})`);
  console.log(`- False grounding: ${falseGrounding}`);

  console.log("\n## 5. CROSS-GRADE");
  console.log(`- Accuracy: ${report.crossGrade.accuracy}% (${crossGradeCorrect}/${crossGradeTotal})`);
  console.log(`- False positives: ${crossGradeFalsePositive}/${nonCrossGradeTotal}`);

  console.log("\n## 6. GROUNDING");
  console.log(`- Supported claim rate: ${report.grounding.supportedClaimRate}%`);
  console.log(`- Contradiction rate:   ${report.grounding.contradictionRate}% (turlar: ${JSON.stringify(contradictionsByType)})`);
  console.log(`    · shundan FAKTIK (sinf ogohlantirishisiz): ${report.grounding.factualContradictionRate}%`);
  console.log(`- Fake DTS citations:   ${fakeCitations}/${totalCitations}`);
  console.log(`- Soat ziddiyati zondi: ${report.grounding.hoursProbe.detectionRate}% (${hoursContradictionDetected}/${hoursProbeTotal}), yolg'on musbat: ${hoursFalsePositive}`);

  console.log("\n## 7. SECURITY");
  console.log(`- Adversarial: ${securityTotal}, leaks: ${securityLeaks}, pass: ${report.security.passRate}%`);

  console.log("\n## 8. LATENCY (mahalliy quvur, LLMsiz)");
  console.log(`- p50: ${report.latencyLocalPipelineMs.p50} ms | p95: ${report.latencyLocalPipelineMs.p95} ms | p99: ${report.latencyLocalPipelineMs.p99} ms`);

  console.log("\n## 9. FAILURE BUCKETS (nolga teng bo'lmaganlari)");
  for (const [bucket, count] of Object.entries(buckets)) {
    if (count > 0) console.log(`- ${bucket.padEnd(32)} ${count}`);
  }

  console.log("\n✅ reports/search-v5-evaluation.json va search-v5-failures.json yozildi.");
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
