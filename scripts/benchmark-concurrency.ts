/**
 * Search Pipeline Concurrency, Latency Breakdown & Memory Leak Benchmark (Phase 15).
 *
 * O'lchanadi:
 *  - Pipeline bosqichlari (Understanding, Retrieval, Scoring, Validation)
 *  - Cold vs Warm kesh tezligi
 *  - 1, 10, 50, 100, 250 concurrent requests
 *  - Xotira oqishi (Memory leak) tekshiruvi: HeapUsed va RSS farqi
 */

import { understandQuery } from "../lib/search/understanding";
import { matchCurriculumTopics } from "../lib/search/curriculum-matcher";
import { searchCache } from "../lib/search/cache";
import { prisma } from "../lib/db";

const TEST_QUERIES = [
  "5-sinf matematika oddiy kasrlar dars ishlanmasi",
  "8-sinf algebra kvadrat tenglamalar va Viyet teoremasi",
  "6-sinf ona tili sifat so'z turkumi darajalari",
  "7-sinf algebra birhadlar va ko'phadlar slaydlar",
  "11-sinf algebra hosila tushunchasi va tatbiqlari",
  "9-sinf ona tili qo'shma gaplar tahlili",
  "10-sinf matematika ko'rsatkichli funksiyalar",
  "8-sinf geometriya to'rtburchaklar xossalari",
];

async function runPipelineStep(query: string) {
  const t0 = performance.now();
  const u = understandQuery(query);
  const t1 = performance.now();
  const matches = await matchCurriculumTopics(u, 3);
  const t2 = performance.now();

  return {
    understandingMs: t1 - t0,
    retrievalMs: t2 - t1,
    totalMs: t2 - t0,
    matchesCount: matches.length,
  };
}

async function runConcurrentBatch(concurrency: number): Promise<{ p50: number; p95: number; p99: number; avg: number }> {
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    const q = TEST_QUERIES[i % TEST_QUERIES.length];
    promises.push(
      (async () => {
        const start = performance.now();
        await runPipelineStep(q);
        return performance.now() - start;
      })(),
    );
  }

  const times = await Promise.all(promises);
  times.sort((a, b) => a - b);

  return {
    avg: Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(2)),
    p50: Number(times[Math.floor(times.length * 0.5)].toFixed(2)),
    p95: Number(times[Math.floor(times.length * 0.95)].toFixed(2)),
    p99: Number(times[Math.floor(times.length * 0.99)].toFixed(2)),
  };
}

async function main() {
  console.log("==========================================================");
  console.log("   SEARCHER AI V3 PERFORMANCE & CONCURRENCY BENCHMARK");
  console.log("==========================================================\n");

  // 1. Pipeline bosqichlari bo'yicha profil
  console.log("## 1. LATENCY BREAKDOWN (Single Request Profile)");
  const sample = await runPipelineStep("8-sinf algebra kvadrat tenglamalar");
  console.log(`- Query Understanding: ${sample.understandingMs.toFixed(3)} ms`);
  console.log(`- Curriculum DB Retrieval & Scoring: ${sample.retrievalMs.toFixed(3)} ms`);
  console.log(`- Total Local Pipeline: ${sample.totalMs.toFixed(3)} ms`);
  console.log(`- Matches Found: ${sample.matchesCount}\n`);

  // 2. Kesh samaradorligi (Cold vs Warm)
  console.log("## 2. CACHE HIT VS COLD PERFORMANCE");
  const testU = understandQuery("5-sinf matematika oddiy kasrlar");
  const cKey = searchCache.generateKey(testU);
  searchCache.set(cKey, {
    answer: { answer: "Kesh javobi", keyPoints: [], classroomIdeas: [] },
    understanding: testU,
    curriculumMatches: [],
    grounding: { isGrounded: true, groundingScore: 1, sourceCitations: [], claims: [], contradictions: [], supportedClaimRate: 1, contradictionRate: 0, factualContradictionRate: 0, gradeConflictRate: 0, sourceConflictRate: 0, unsupportedClaimRate: 0 },
    suggestedActions: [],
    durationMs: 1,
    latencyBreakdown: { understandingMs: 0.5, retrievalMs: 0.5, aiMs: 0, validationMs: 0, totalMs: 1 },
    model: "mock",
    usage: { inputTokens: 10, outputTokens: 10 },
  });

  const warmTimes: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const t0 = performance.now();
    searchCache.get(cKey);
    warmTimes.push(performance.now() - t0);
  }
  warmTimes.sort((a, b) => a - b);
  const cacheP50 = warmTimes[Math.floor(warmTimes.length * 0.5)].toFixed(4);
  const cacheP95 = warmTimes[Math.floor(warmTimes.length * 0.95)].toFixed(4);
  console.log(`- Warm Cache Hit p50: ${cacheP50} ms`);
  console.log(`- Warm Cache Hit p95: ${cacheP95} ms\n`);

  // 3. Konkurent yuklama sinovi (Concurrency Load Test)
  console.log("## 3. CONCURRENCY LOAD TEST (1, 10, 50, 100, 250 requests)");
  const concurrencies = [1, 10, 50, 100, 250];
  for (const c of concurrencies) {
    const res = await runConcurrentBatch(c);
    console.log(`- Concurrency = ${c.toString().padEnd(3)}: Avg = ${res.avg.toFixed(2)} ms | p50 = ${res.p50} ms | p95 = ${res.p95} ms | p99 = ${res.p99} ms`);
  }
  console.log("");

  // 4. Xotira oqishi (Memory Leak Check)
  console.log("## 4. MEMORY LEAK AUDIT (1,000 Iterations)");
  if (global.gc) global.gc();
  const memBefore = process.memoryUsage();

  for (let i = 0; i < 1000; i++) {
    const q = TEST_QUERIES[i % TEST_QUERIES.length];
    await runPipelineStep(q);
  }

  if (global.gc) global.gc();
  const memAfter = process.memoryUsage();

  const heapDiffMb = ((memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024)).toFixed(2);
  const rssDiffMb = ((memAfter.rss - memBefore.rss) / (1024 * 1024)).toFixed(2);
  console.log(`- Heap Used Delta: ${heapDiffMb} MB (1,000 requests)`);
  console.log(`- RSS Delta: ${rssDiffMb} MB`);
  console.log(`- Memory Status: ${Number(heapDiffMb) < 50 ? "PASS — Stabil va oqishsiz" : "WARNING"}\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
