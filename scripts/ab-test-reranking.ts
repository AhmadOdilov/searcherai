/**
 * Reranking Scoring A/B Evaluation (Phase 5).
 *
 * Sinovdan o'tkazilayotgan variantlar:
 *  - Variant A (Current): 0.35 Exact + 0.25 Semantic + 0.20 GradeSubj + 0.10 Outcome + 0.10 Intent
 *  - Variant B (Lexical-first): 0.50 Exact + 0.15 Semantic + 0.20 GradeSubj + 0.05 Outcome + 0.10 Intent
 *  - Variant C (Semantic-first): 0.20 Exact + 0.45 Semantic + 0.20 GradeSubj + 0.05 Outcome + 0.10 Intent
 *  - Variant D (Hybrid Calibrated): 0.40 Exact + 0.30 Semantic + 0.15 GradeSubj + 0.08 Outcome + 0.07 Intent
 */

import { BENCHMARK_DATASET_V3 } from "./evaluate-search-v3";
import { understandQuery } from "../lib/search/understanding";
import { prisma } from "../lib/db";
import { searchTerms } from "../lib/curriculum/terms";
import { stemUzbekWord, getApostropheVariants } from "../lib/search/normalization";
import { expandQueryConcepts } from "../lib/search/concept-map";
import { calculateJaccardSimilarity } from "../lib/search/scoring";

interface WeightVariant {
  name: string;
  wExact: number;
  wSemantic: number;
  wGradeSubj: number;
  wOutcome: number;
  wIntent: number;
}

const VARIANTS: WeightVariant[] = [
  {
    name: "Variant A (Baseline)",
    wExact: 0.35,
    wSemantic: 0.25,
    wGradeSubj: 0.2,
    wOutcome: 0.1,
    wIntent: 0.1,
  },
  {
    name: "Variant B (Lexical-first)",
    wExact: 0.5,
    wSemantic: 0.15,
    wGradeSubj: 0.2,
    wOutcome: 0.05,
    wIntent: 0.1,
  },
  {
    name: "Variant C (Semantic-first)",
    wExact: 0.2,
    wSemantic: 0.45,
    wGradeSubj: 0.2,
    wOutcome: 0.05,
    wIntent: 0.1,
  },
  {
    name: "Variant D (Hybrid Calibrated)",
    wExact: 0.4,
    wSemantic: 0.3,
    wGradeSubj: 0.15,
    wOutcome: 0.08,
    wIntent: 0.07,
  },
];

async function runRerankingABTest() {
  console.log("==========================================================");
  console.log("   RERANKING SCORING A/B BENCHMARK (PHASE 5)");
  console.log("==========================================================\n");

  const evaluatedQueries = BENCHMARK_DATASET_V3.filter((i) => i.expectedCurriculumTopic);
  console.log(`Evaluated Curriculum Queries: ${evaluatedQueries.length}\n`);

  for (const variant of VARIANTS) {
    let r1 = 0;
    let r3 = 0;
    let r5 = 0;
    let r10 = 0;
    let mrrSum = 0;
    let ndcg5Sum = 0;
    let ndcg10Sum = 0;
    let prec5Sum = 0;
    const latencies: number[] = [];

    for (const item of evaluatedQueries) {
      const u = understandQuery(
        item.q,
        undefined,
        undefined,
        undefined,
        item.conversationContext,
      );
      const t0 = performance.now();

      // Retrieve candidates
      const baseTerms = searchTerms(u.extractedTopic);
      const stemmed = u.keywords.map(stemUzbekWord);
      const exp = expandQueryConcepts(
        u.extractedTopic,
        u.detectedSubject,
        u.detectedGrade,
      );
      const allTerms = new Set([
        ...baseTerms,
        ...stemmed,
        ...exp.expandedTerms,
        u.extractedTopic,
      ]);

      const variants = new Set<string>();
      for (const t of allTerms) {
        if (t.length >= 3) {
          for (const v of getApostropheVariants(t)) variants.add(v);
        }
      }

      const orClauses = Array.from(variants)
        .slice(0, 16)
        .flatMap((term) => [
          { topicName: { contains: term, mode: "insensitive" as const } },
          { description: { contains: term, mode: "insensitive" as const } },
        ]);

      const where: Record<string, unknown> = {};
      if (u.detectedSubject)
        where.subject = { equals: u.detectedSubject, mode: "insensitive" };
      if (u.detectedGrade) where.grade = { equals: u.detectedGrade, mode: "insensitive" };
      if (orClauses.length > 0) where.OR = orClauses;

      const candidates = await prisma.curriculumTopic.findMany({
        where,
        take: 20,
      });

      // Score candidates according to variant
      const scored = candidates.map((c) => {
        const norm = (s: string) =>
          s.toUpperCase().replace(/['\u2018\u2019\u02BB\u02BC]/g, "'");
        const topicUpper = norm(c.topicName);
        const queryUpper = norm(u.extractedTopic);
        const descLower = c.description.toLowerCase();

        let exactMatch = 0;
        if (
          topicUpper === queryUpper ||
          topicUpper.includes(queryUpper) ||
          queryUpper.includes(topicUpper)
        ) {
          exactMatch = 1.0;
        } else {
          let tm = 0,
            dm = 0;
          for (const k of stemmed) {
            if (k.length < 3) continue;
            if (topicUpper.toLowerCase().includes(k)) tm++;
            else if (descLower.includes(k)) dm++;
          }
          const totalK = Math.max(1, stemmed.filter((k) => k.length >= 3).length);
          exactMatch = Math.min(1.0, (tm / totalK) * 0.85 + (dm / totalK) * 0.25);
        }

        const simTopic = calculateJaccardSimilarity(c.topicName, u.extractedTopic);
        const simDesc = calculateJaccardSimilarity(c.description, u.extractedTopic);
        const semanticSimilarity = Math.max(simTopic, simDesc);

        let gradeSubjectMatch = 0;
        if (
          u.detectedSubject &&
          c.subject.toLowerCase() === u.detectedSubject.toLowerCase()
        )
          gradeSubjectMatch += 0.5;
        if (u.detectedGrade && c.grade.toLowerCase() === u.detectedGrade.toLowerCase())
          gradeSubjectMatch += 0.5;

        const outcomeMatch = 0.5;
        const intentMatch = 0.8;

        let total =
          variant.wExact * exactMatch +
          variant.wSemantic * semanticSimilarity +
          variant.wGradeSubj * gradeSubjectMatch +
          variant.wOutcome * outcomeMatch +
          variant.wIntent * intentMatch;

        if (u.detectedGrade && c.grade.toLowerCase() !== u.detectedGrade.toLowerCase()) {
          total = Math.max(0, total - 0.2);
        }

        return { ...c, totalScore: total };
      });

      scored.sort((a, b) => b.totalScore - a.totalScore);
      const t1 = performance.now();
      latencies.push(t1 - t0);

      const expectedUpper = item.expectedCurriculumTopic!.toUpperCase();
      let rank = 0;
      let matchesInTop5 = 0;

      for (let i = 0; i < Math.min(10, scored.length); i++) {
        if (scored[i].topicName.toUpperCase().includes(expectedUpper)) {
          if (rank === 0) rank = i + 1;
          if (i < 5) matchesInTop5++;
        }
      }

      if (rank === 1) r1++;
      if (rank >= 1 && rank <= 3) r3++;
      if (rank >= 1 && rank <= 5) r5++;
      if (rank >= 1 && rank <= 10) r10++;

      if (rank > 0) {
        mrrSum += 1 / rank;
        ndcg5Sum += rank <= 5 ? 1 / Math.log2(rank + 1) : 0;
        ndcg10Sum += 1 / Math.log2(rank + 1);
      }
      prec5Sum += matchesInTop5 / 5;
    }

    latencies.sort((a, b) => a - b);
    const n = evaluatedQueries.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)].toFixed(2);
    const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);

    console.log(`### ${variant.name}`);
    console.log(`- Recall@1: ${((r1 / n) * 100).toFixed(2)}%`);
    console.log(`- Recall@3: ${((r3 / n) * 100).toFixed(2)}%`);
    console.log(`- Recall@5: ${((r5 / n) * 100).toFixed(2)}%`);
    console.log(`- Recall@10: ${((r10 / n) * 100).toFixed(2)}%`);
    console.log(`- MRR: ${(mrrSum / n).toFixed(4)}`);
    console.log(`- nDCG@5: ${(ndcg5Sum / n).toFixed(4)}`);
    console.log(`- nDCG@10: ${(ndcg10Sum / n).toFixed(4)}`);
    console.log(`- Precision@5: ${(prec5Sum / n).toFixed(4)}`);
    console.log(`- Latency p50: ${p50} ms | p95: ${p95} ms\n`);
  }
}

runRerankingABTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
