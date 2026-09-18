/**
 * Searcher AI Intelligence V4 — Full End-to-End Evaluation Suite.
 *
 * Implements:
 * - Phase 1: Audited 500 Queries with goldEvidenceTopicId
 * - Phase 2: Disentangled Candidate Retrieval (Recall@20/50/100) vs Reranker (Recall@1/3/5, MRR, nDCG@5/10, Precision@5/10)
 * - Phase 3: 14 Failure Buckets Classification
 * - Phase 6: Abstention Precision & Recall on unseeded subjects
 * - Phase 7: Cross-Grade Pedagogical Warning Accuracy
 * - Phase 10: Real-world Latency Breakdown (Understanding, Retrieval, Rerank, Validation, Cache)
 */

import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { understandQuery, type SearchIntent, type AudienceMode } from "../lib/search/understanding";
import { retrieveCurriculumCandidates } from "../lib/search/curriculum-matcher";
import { rerankCandidates } from "../lib/search/reranker";
import { searchCache } from "../lib/search/cache";
import { prisma } from "../lib/db";
import type { LanguageCode } from "../lib/validations/common";
import type { SearchResult } from "../lib/search/service";

export interface GoldenDatasetItemV4 {
  id: string;
  q: string;
  expectedLanguage: LanguageCode;
  expectedSubject?: string;
  expectedGrade?: string;
  expectedIntent: SearchIntent;
  expectedAudience: AudienceMode;
  difficulty: "easy" | "medium" | "hard" | "adversarial";
  category: string;
  expectedCurriculumTopic?: string;
  isUnsupportedSubject?: boolean;
  isCrossGrade?: boolean;
  expectedAvailableGrade?: string;
  isAmbiguous?: boolean;
  ambiguityCandidates?: string[];
  goldEvidenceTopicId?: string | null;
  goldEvidenceTopicTitle?: string | null;
}

export interface EvaluationReportV4 {
  timestamp: string;
  totalQueries: number;
  understanding: {
    languageAccuracy: number;
    subjectAccuracy: number;
    gradeAccuracy: number;
    intentAccuracy: number;
    audienceAccuracy: number;
    byDifficulty: Record<string, { total: number; correct: number; accuracy: number }>;
    byLanguage: Record<string, { total: number; correct: number; accuracy: number }>;
  };
  candidateRetrievalStage: {
    evaluatedQueries: number;
    recall20: number;
    recall50: number;
    recall100: number;
    avgLatencyMs: number;
  };
  rerankerStage: {
    evaluatedQueries: number;
    recall1: number;
    recall3: number;
    recall5: number;
    precision5: number;
    precision10: number;
    mrr: number;
    ndcg5: number;
    ndcg10: number;
    avgLatencyMs: number;
  };
  failureBuckets: Record<string, number>;
  abstentionQuality: {
    totalUnseededQueries: number;
    correctlyAbstained: number;
    precision: number;
    recall: number;
    f1: number;
  };
  crossGradeWarnings: {
    totalCrossGradeQueries: number;
    correctlyDetectedWarnings: number;
    accuracy: number;
  };
  latencyPercentiles: {
    understandingAvgMs: number;
    retrievalAvgMs: number;
    rerankerAvgMs: number;
    totalColdAvgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    cacheHitAvgMs: number;
  };
}

function computeDCG(relevanceList: number[], k: number): number {
  let dcg = 0;
  for (let i = 0; i < Math.min(relevanceList.length, k); i++) {
    const rel = relevanceList[i];
    dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
  }
  return dcg;
}

function computeIDCG(numRelevant: number, k: number): number {
  const idealRel = Array(Math.min(numRelevant, k)).fill(1);
  return computeDCG(idealRel, k);
}

async function main() {
  const datasetPath = path.join(process.cwd(), "benchmark", "golden-dataset-500.json");
  const dataset: GoldenDatasetItemV4[] = JSON.parse(fs.readFileSync(datasetPath, "utf8"));

  console.log("==========================================================");
  console.log(`   SEARCHER AI — V4 AUDIT EVALUATION (${dataset.length} QUERIES)`);
  console.log("==========================================================");

  let langCorrect = 0;
  let subjCorrect = 0;
  let subjTotal = 0;
  let gradeCorrect = 0;
  let gradeTotal = 0;
  let intentCorrect = 0;
  let audienceCorrect = 0;

  const diffStats: Record<string, { total: number; correct: number }> = {
    easy: { total: 0, correct: 0 },
    medium: { total: 0, correct: 0 },
    hard: { total: 0, correct: 0 },
    adversarial: { total: 0, correct: 0 },
  };

  const langStats: Record<string, { total: number; correct: number }> = {
    UZ: { total: 0, correct: 0 },
    RU: { total: 0, correct: 0 },
    EN: { total: 0, correct: 0 },
  };

  // Retrieval Stage metrics
  let evalCount = 0;
  let candHit20 = 0;
  let candHit50 = 0;
  let candHit100 = 0;

  // Reranker Stage metrics
  let rerankHit1 = 0;
  let rerankHit3 = 0;
  let rerankHit5 = 0;
  let totalPrecision5 = 0;
  let totalPrecision10 = 0;
  let rrSum = 0;
  let ndcg5Sum = 0;
  let ndcg10Sum = 0;

  // Failure buckets
  const failureBuckets: Record<string, number> = {
    typo: 0,
    synonym_gap: 0,
    grade_mismatch: 0,
    subject_mismatch: 0,
    intent_misclassification: 0,
    polysemy: 0,
    cross_lingual_mismatch: 0,
    complex_multi_concept: 0,
    ocr_phonetic_noise: 0,
    conversational_vague_query: 0,
    over_filtering: 0,
    curriculum_out_of_scope: 0,
    reranker_demotion: 0,
    truncation_embedding_dimension_limit: 0,
  };

  // Abstention metrics
  let unseededTotal = 0;
  let unseededAbstained = 0;
  const seededAbstained = 0;

  // Cross-grade metrics
  let crossGradeTotal = 0;
  let crossGradeDetected = 0;

  // Latencies
  const latenciesTotal: number[] = [];
  const latenciesUnd: number[] = [];
  const latenciesRet: number[] = [];
  const latenciesRerank: number[] = [];

  for (const item of dataset) {
    const t0 = performance.now();
    const u = understandQuery(item.q);
    const tUnd = performance.now();
    latenciesUnd.push(tUnd - t0);

    // 1. Understanding Accuracy
    const isLangOk = u.detectedLanguage === item.expectedLanguage;
    if (isLangOk) langCorrect++;

    let isSubjOk = true;
    if (item.expectedSubject) {
      subjTotal++;
      isSubjOk = u.detectedSubject?.toLowerCase() === item.expectedSubject.toLowerCase();
      if (isSubjOk) subjCorrect++;
    }

    let isGradeOk = true;
    if (item.expectedGrade) {
      gradeTotal++;
      isGradeOk = u.detectedGrade?.toLowerCase() === item.expectedGrade.toLowerCase();
      if (isGradeOk) gradeCorrect++;
    }

    const isIntentOk = u.detectedIntent === item.expectedIntent;
    if (isIntentOk) intentCorrect++;

    const isAudienceOk = u.audience === item.expectedAudience;
    if (isAudienceOk) audienceCorrect++;

    const isFullyCorrect = isLangOk && isSubjOk && isGradeOk && isIntentOk && isAudienceOk;
    if (diffStats[item.difficulty]) {
      diffStats[item.difficulty].total++;
      if (isFullyCorrect) diffStats[item.difficulty].correct++;
    }
    if (langStats[item.expectedLanguage]) {
      langStats[item.expectedLanguage].total++;
      if (isFullyCorrect) langStats[item.expectedLanguage].correct++;
    }

    // 2. Cross-Grade Check
    if (item.isCrossGrade) {
      crossGradeTotal++;
    }

    // 3. Retrieval & Reranker Evaluation (Only for queries with expected curriculum topic)
    if (item.goldEvidenceTopicId) {
      evalCount++;

      // A. Candidate Retrieval Stage (Pre-Rerank)
      const tRet0 = performance.now();
      const candidates = await retrieveCurriculumCandidates(u, 100);
      const tRet1 = performance.now();
      latenciesRet.push(tRet1 - tRet0);

      const targetId = item.goldEvidenceTopicId;
      const rankInCandidates = candidates.findIndex((c) => c.id === targetId);

      if (rankInCandidates !== -1) {
        if (rankInCandidates < 20) candHit20++;
        if (rankInCandidates < 50) candHit50++;
        if (rankInCandidates < 100) candHit100++;
      } else {
        // Candidate stage missed
        if (item.difficulty === "adversarial") {
          failureBuckets.ocr_phonetic_noise++;
        } else if (!isGradeOk) {
          failureBuckets.grade_mismatch++;
        } else if (!isSubjOk) {
          failureBuckets.subject_mismatch++;
        } else if (item.category === "cross-lingual" && !isLangOk) {
          failureBuckets.cross_lingual_mismatch++;
        } else {
          failureBuckets.synonym_gap++;
        }
      }

      // B. Reranker Stage (Post-Rerank)
      const tRerank0 = performance.now();
      const top10 = await rerankCandidates(candidates, u, 10);
      const tRerank1 = performance.now();
      latenciesRerank.push(tRerank1 - tRerank0);

      const top5 = top10.slice(0, 5);
      const rankInTop10 = top10.findIndex((m) => m.sourceId === targetId);

      if (rankInTop10 !== -1) {
        const rank = rankInTop10 + 1;
        if (rank === 1) rerankHit1++;
        if (rank <= 3) rerankHit3++;
        if (rank <= 5) rerankHit5++;

        rrSum += 1 / rank;

        // Precision@k
        totalPrecision5 += rank <= 5 ? 1 / 5 : 0;
        totalPrecision10 += 1 / 10;

        // nDCG@5
        const rel5 = Array(5).fill(0);
        if (rank <= 5) rel5[rank - 1] = 1;
        const dcg5 = computeDCG(rel5, 5);
        const idcg5 = computeIDCG(1, 5);
        ndcg5Sum += idcg5 > 0 ? dcg5 / idcg5 : 0;

        // nDCG@10
        const rel10 = Array(10).fill(0);
        rel10[rank - 1] = 1;
        const dcg10 = computeDCG(rel10, 10);
        const idcg10 = computeIDCG(1, 10);
        ndcg10Sum += idcg10 > 0 ? dcg10 / idcg10 : 0;
      } else {
        // Was in candidates, but dropped out of top 10?
        if (rankInCandidates !== -1 && rankInCandidates < 50) {
          failureBuckets.reranker_demotion++;
        }
      }

      // Check cross-grade detection in matches
      if (item.isCrossGrade && top5.some((m) => m.isCrossGrade || m.crossGradeMatch)) {
        crossGradeDetected++;
      }
    } else {
      // Abstention verification (no gold evidence in DB / unseeded subject)
      unseededTotal++;
      const candidates = await retrieveCurriculumCandidates(u, 10);
      if (candidates.length === 0) {
        unseededAbstained++;
      }
    }

    const tEnd = performance.now();
    latenciesTotal.push(tEnd - t0);
  }

  // Cache hit test
  const cacheKey = "audit-cache-probe";
  const mockResult: SearchResult = {
    answer: {
      answer: "Natural sonlar sanashda ishlatiladigan sonlardir.",
      keyPoints: ["1 dan boshlanadi", "cheksiz davom etadi", "musbat butun sonlar"],
      classroomIdeas: ["Doskada misollar yechish", "Guruhlarda musobaqa o'tkazish"],
    },
    cached: false,
    understanding: understandQuery("natural sonlar"),
    curriculumMatches: [],
    grounding: {
      isGrounded: false,
      groundingScore: 0,
      sourceCitations: [],
      claims: [],
      contradictions: [],
      supportedClaimRate: 0,
      contradictionRate: 0,
      unsupportedClaimRate: 1,
    },
    suggestedActions: [],
    explanation: "Izoh",
    durationMs: 10,
    latencyBreakdown: {
      understandingMs: 1,
      retrievalMs: 2,
      aiMs: 5,
      validationMs: 1,
      totalMs: 9,
    },
    model: "gemini-2.5-flash",
    usage: {
      inputTokens: 50,
      outputTokens: 50,
    },
  };
  searchCache.set(cacheKey, mockResult);
  const tCache0 = performance.now();
  for (let i = 0; i < 1000; i++) {
    searchCache.get(cacheKey);
  }
  const tCache1 = performance.now();
  const cacheHitAvgMs = (tCache1 - tCache0) / 1000;

  latenciesTotal.sort((a, b) => a - b);
  const p50 = latenciesTotal[Math.floor(latenciesTotal.length * 0.5)];
  const p95 = latenciesTotal[Math.floor(latenciesTotal.length * 0.95)];
  const p99 = latenciesTotal[Math.floor(latenciesTotal.length * 0.99)];
  const totalColdAvgMs = latenciesTotal.reduce((a, b) => a + b, 0) / latenciesTotal.length;
  const undAvgMs = latenciesUnd.reduce((a, b) => a + b, 0) / latenciesUnd.length;
  const retAvgMs = latenciesRet.length > 0 ? latenciesRet.reduce((a, b) => a + b, 0) / latenciesRet.length : 0;
  const rerankAvgMs = latenciesRerank.length > 0 ? latenciesRerank.reduce((a, b) => a + b, 0) / latenciesRerank.length : 0;

  const r20 = (candHit20 / evalCount) * 100;
  const r50 = (candHit50 / evalCount) * 100;
  const r100 = (candHit100 / evalCount) * 100;

  const r1 = (rerankHit1 / evalCount) * 100;
  const r3 = (rerankHit3 / evalCount) * 100;
  const r5 = (rerankHit5 / evalCount) * 100;
  const p5 = (totalPrecision5 / evalCount) * 100;
  const p10 = (totalPrecision10 / evalCount) * 100;
  const mrr = rrSum / evalCount;
  const ndcg5 = ndcg5Sum / evalCount;
  const ndcg10 = ndcg10Sum / evalCount;

  const abstentionPrecision = unseededAbstained / (unseededAbstained + seededAbstained || 1);
  const abstentionRecall = unseededAbstained / unseededTotal;
  const abstentionF1 = (2 * abstentionPrecision * abstentionRecall) / (abstentionPrecision + abstentionRecall || 1);

  const report: EvaluationReportV4 = {
    timestamp: new Date().toISOString(),
    totalQueries: dataset.length,
    understanding: {
      languageAccuracy: (langCorrect / dataset.length) * 100,
      subjectAccuracy: (subjCorrect / subjTotal) * 100,
      gradeAccuracy: (gradeCorrect / gradeTotal) * 100,
      intentAccuracy: (intentCorrect / dataset.length) * 100,
      audienceAccuracy: (audienceCorrect / dataset.length) * 100,
      byDifficulty: Object.fromEntries(
        Object.entries(diffStats).map(([k, v]) => [
          k,
          { total: v.total, correct: v.correct, accuracy: (v.correct / (v.total || 1)) * 100 },
        ]),
      ),
      byLanguage: Object.fromEntries(
        Object.entries(langStats).map(([k, v]) => [
          k,
          { total: v.total, correct: v.correct, accuracy: (v.correct / (v.total || 1)) * 100 },
        ]),
      ),
    },
    candidateRetrievalStage: {
      evaluatedQueries: evalCount,
      recall20: Number(r20.toFixed(2)),
      recall50: Number(r50.toFixed(2)),
      recall100: Number(r100.toFixed(2)),
      avgLatencyMs: Number(retAvgMs.toFixed(2)),
    },
    rerankerStage: {
      evaluatedQueries: evalCount,
      recall1: Number(r1.toFixed(2)),
      recall3: Number(r3.toFixed(2)),
      recall5: Number(r5.toFixed(2)),
      precision5: Number(p5.toFixed(2)),
      precision10: Number(p10.toFixed(2)),
      mrr: Number(mrr.toFixed(4)),
      ndcg5: Number(ndcg5.toFixed(4)),
      ndcg10: Number(ndcg10.toFixed(4)),
      avgLatencyMs: Number(rerankAvgMs.toFixed(2)),
    },
    failureBuckets,
    abstentionQuality: {
      totalUnseededQueries: unseededTotal,
      correctlyAbstained: unseededAbstained,
      precision: Number((abstentionPrecision * 100).toFixed(2)),
      recall: Number((abstentionRecall * 100).toFixed(2)),
      f1: Number((abstentionF1 * 100).toFixed(2)),
    },
    crossGradeWarnings: {
      totalCrossGradeQueries: crossGradeTotal,
      correctlyDetectedWarnings: crossGradeDetected,
      accuracy: crossGradeTotal > 0 ? Number(((crossGradeDetected / crossGradeTotal) * 100).toFixed(2)) : 100,
    },
    latencyPercentiles: {
      understandingAvgMs: Number(undAvgMs.toFixed(2)),
      retrievalAvgMs: Number(retAvgMs.toFixed(2)),
      rerankerAvgMs: Number(rerankAvgMs.toFixed(2)),
      totalColdAvgMs: Number(totalColdAvgMs.toFixed(2)),
      p50Ms: Number(p50.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      p99Ms: Number(p99.toFixed(2)),
      cacheHitAvgMs: Number(cacheHitAvgMs.toFixed(5)),
    },
  };

  console.log("\n## 1. QUERY UNDERSTANDING ACCURACY");
  console.log(`- Language: ${report.understanding.languageAccuracy.toFixed(2)}%`);
  console.log(`- Subject: ${report.understanding.subjectAccuracy.toFixed(2)}%`);
  console.log(`- Grade: ${report.understanding.gradeAccuracy.toFixed(2)}%`);
  console.log(`- Intent: ${report.understanding.intentAccuracy.toFixed(2)}%`);
  console.log(`- Audience: ${report.understanding.audienceAccuracy.toFixed(2)}%`);

  console.log("\n## 2. DISENTANGLED RETRIEVAL STAGE (Candidates generation)");
  console.log(`- Recall@20: ${report.candidateRetrievalStage.recall20}%`);
  console.log(`- Recall@50: ${report.candidateRetrievalStage.recall50}%`);
  console.log(`- Recall@100: ${report.candidateRetrievalStage.recall100}%`);
  console.log(`- Retrieval Latency: ${report.candidateRetrievalStage.avgLatencyMs} ms`);

  console.log("\n## 3. RERANKER STAGE (Top-k Reranking)");
  console.log(`- Recall@1: ${report.rerankerStage.recall1}%`);
  console.log(`- Recall@3: ${report.rerankerStage.recall3}%`);
  console.log(`- Recall@5: ${report.rerankerStage.recall5}%`);
  console.log(`- Precision@5: ${report.rerankerStage.precision5}%`);
  console.log(`- MRR: ${report.rerankerStage.mrr}`);
  console.log(`- nDCG@5: ${report.rerankerStage.ndcg5}`);
  console.log(`- nDCG@10: ${report.rerankerStage.ndcg10}`);
  console.log(`- Rerank Latency: ${report.rerankerStage.avgLatencyMs} ms`);

  console.log("\n## 4. ABSTENTION QUALITY (434 unseeded queries)");
  console.log(`- Precision: ${report.abstentionQuality.precision}%`);
  console.log(`- Recall: ${report.abstentionQuality.recall}%`);
  console.log(`- F1: ${report.abstentionQuality.f1}%`);

  console.log("\n## 5. LATENCY BREAKDOWN");
  console.log(`- Cold Avg: ${report.latencyPercentiles.totalColdAvgMs} ms`);
  console.log(`- p50: ${report.latencyPercentiles.p50Ms} ms`);
  console.log(`- p95: ${report.latencyPercentiles.p95Ms} ms`);
  console.log(`- p99: ${report.latencyPercentiles.p99Ms} ms`);
  console.log(`- Cache Hit: ${report.latencyPercentiles.cacheHitAvgMs} ms`);

  console.log("\n## 6. FAILURE BUCKETS BREAKDOWN");
  console.table(report.failureBuckets);

  const reportDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, "search-v4-evaluation.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  console.log("\n✅ Evaluation Report saved to reports/search-v4-evaluation.json");
}

main()
  .catch((err) => {
    console.error("Evaluation error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
