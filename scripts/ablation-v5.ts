/**
 * V5 ablatsiya tadqiqoti (§29).
 *
 * Maqsad: qaysi komponent RANKING sifatiga HAQIQATAN hissa qo'shayotganini
 * o'lchash. "Bor deb o'ylangan" foyda emas, o'lchangan foyda.
 *
 * Usul: nomzodlar to'plami barcha variantlar uchun BIR XIL (haqiqiy
 * retrieval natijasi), faqat REYTINGLASH usuli almashtiriladi. Shunda
 * farq faqat reyting sifatiga tegishli bo'ladi.
 *
 * Variantlar:
 *   A. Exact            — faqat sarlavha mosligi
 *   B. Lexical          — faqat leksik qoplama
 *   C. Semantic         — faqat semantik vektor o'xshashligi
 *   D. Hybrid           — A+B+C (metadata va jazolarsiz)
 *   E. Hybrid+Metadata  — D + fan/sinf mosligi
 *   F. Full V5          — ishlab chiqarishdagi reranker
 *
 * Maqsadli ablatsiyalar (F dan bittadan komponent olib tashlanadi):
 *   - sinf jazosisiz
 *   - semantik ballsiz
 *   - cross-lingual kengaytmasiz
 *   - metadata mosligisiz
 */

import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { understandQuery, type QueryUnderstanding } from "../lib/search/understanding";
import { retrieveCurriculumCandidates } from "../lib/search/curriculum-matcher";
import { rerankCandidates, type RerankerCandidate } from "../lib/search/reranker";
import { defaultSemanticProvider } from "../lib/search/semantic";
import { stemUzbekWord } from "../lib/search/normalization";
import { expandRetrievalTerms } from "../lib/search/concept-map";
import { prisma } from "../lib/db";

interface EvalItem {
  id: string;
  q: string;
  goldEvidenceTopicId?: string | null;
}

interface Metrics {
  variant: string;
  queries: number;
  recall1: number;
  recall3: number;
  recall5: number;
  mrr: number;
  ndcg5: number;
  avgLatencyMs: number;
}

function pct(n: number, d: number): number {
  return d > 0 ? Number(((n / d) * 100).toFixed(2)) : 0;
}

function norm(value: string): string {
  return value.toUpperCase().replace(/['‘’ʻʼ]/g, "'");
}

type Scorer = (
  cand: RerankerCandidate,
  ctx: {
    queryTopic: string;
    keywords: string[];
    subject?: string;
    grade?: string;
    queryVec: number[];
    canonicalTokens: string[];
  },
) => Promise<number>;

function exactComponent(cand: RerankerCandidate, queryTopic: string, keywords: string[]): number {
  const candTitle = norm(cand.topicName);
  const qTitle = norm(queryTopic);
  if (candTitle === qTitle) return 1;
  if (candTitle.includes(qTitle) || qTitle.includes(candTitle)) return 0.9;
  const tokens = keywords.map(stemUzbekWord).filter((t) => t.length >= 3);
  if (tokens.length === 0) return 0;
  const hits = tokens.filter((t) => candTitle.toLowerCase().includes(t)).length;
  return Math.min(0.75, hits / tokens.length);
}

function lexicalComponent(
  cand: RerankerCandidate,
  queryTopic: string,
  keywords: string[],
  canonicalTokens: string[],
): number {
  const haystack = `${cand.topicName} ${cand.description}`.toLowerCase();
  const tokens = Array.from(
    new Set([
      ...keywords.map(stemUzbekWord),
      ...queryTopic.toLowerCase().split(/\s+/).filter((w) => w.length >= 3).map(stemUzbekWord),
    ]),
  );
  const raw = tokens.length > 0 ? tokens.filter((t) => haystack.includes(t)).length / tokens.length : 0;
  const canonical =
    canonicalTokens.length > 0
      ? canonicalTokens.filter((t) => haystack.includes(t)).length / canonicalTokens.length
      : 0;
  return Math.min(1, Math.max(raw, canonical));
}

async function semanticComponent(cand: RerankerCandidate, queryVec: number[]): Promise<number> {
  const vec = await defaultSemanticProvider.embedText(`${cand.topicName} ${cand.description}`);
  return Math.max(0, defaultSemanticProvider.computeSimilarity(queryVec, vec));
}

function metadataComponent(cand: RerankerCandidate, subject?: string, grade?: string): number {
  let score = 0;
  if (subject && cand.subject.toLowerCase() === subject.toLowerCase()) score += 0.5;
  if (grade && cand.grade.toLowerCase() === grade.toLowerCase()) score += 0.5;
  return score;
}

function gradePenalty(cand: RerankerCandidate, grade?: string): number {
  if (!grade || cand.grade.toLowerCase() === grade.toLowerCase()) return 0;
  const req = parseInt(grade, 10);
  const got = parseInt(cand.grade, 10);
  if (Number.isNaN(req) || Number.isNaN(got)) return 0.2;
  return Math.abs(req - got) === 1 ? 0.1 : 0.25;
}

const SCORERS: Record<string, Scorer> = {
  "A. Exact": async (c, ctx) => exactComponent(c, ctx.queryTopic, ctx.keywords),
  "B. Lexical": async (c, ctx) => lexicalComponent(c, ctx.queryTopic, ctx.keywords, ctx.canonicalTokens),
  "C. Semantic": async (c, ctx) => semanticComponent(c, ctx.queryVec),
  "D. Hybrid (A+B+C)": async (c, ctx) =>
    0.4 * exactComponent(c, ctx.queryTopic, ctx.keywords) +
    0.3 * lexicalComponent(c, ctx.queryTopic, ctx.keywords, ctx.canonicalTokens) +
    0.3 * (await semanticComponent(c, ctx.queryVec)),
  "E. Hybrid + Metadata": async (c, ctx) =>
    0.35 * exactComponent(c, ctx.queryTopic, ctx.keywords) +
    0.25 * lexicalComponent(c, ctx.queryTopic, ctx.keywords, ctx.canonicalTokens) +
    0.25 * (await semanticComponent(c, ctx.queryVec)) +
    0.15 * metadataComponent(c, ctx.subject, ctx.grade),
  "G. F - sinf jazosisiz": async (c, ctx) =>
    0.3 * exactComponent(c, ctx.queryTopic, ctx.keywords) +
    0.25 * lexicalComponent(c, ctx.queryTopic, ctx.keywords, ctx.canonicalTokens) +
    0.25 * (await semanticComponent(c, ctx.queryVec)) +
    0.1 * metadataComponent(c, ctx.subject, ctx.grade),
  "H. F - semantik ballsiz": async (c, ctx) =>
    Math.max(
      0,
      0.4 * exactComponent(c, ctx.queryTopic, ctx.keywords) +
        0.35 * lexicalComponent(c, ctx.queryTopic, ctx.keywords, ctx.canonicalTokens) +
        0.1 * metadataComponent(c, ctx.subject, ctx.grade) -
        gradePenalty(c, ctx.grade),
    ),
  "I. F - cross-lingual kengaytmasiz": async (c, ctx) =>
    Math.max(
      0,
      0.3 * exactComponent(c, ctx.queryTopic, ctx.keywords) +
        0.25 * lexicalComponent(c, ctx.queryTopic, ctx.keywords, []) +
        0.25 * (await semanticComponent(c, ctx.queryVec)) +
        0.1 * metadataComponent(c, ctx.subject, ctx.grade) -
        gradePenalty(c, ctx.grade),
    ),
  "J. F - metadata mosligisiz": async (c, ctx) =>
    Math.max(
      0,
      0.3 * exactComponent(c, ctx.queryTopic, ctx.keywords) +
        0.25 * lexicalComponent(c, ctx.queryTopic, ctx.keywords, ctx.canonicalTokens) +
        0.25 * (await semanticComponent(c, ctx.queryVec)) -
        gradePenalty(c, ctx.grade),
    ),
};

function computeNdcg5(rank: number): number {
  if (rank < 1 || rank > 5) return 0;
  return 1 / Math.log2(rank + 1);
}

async function scoreVariant(
  name: string,
  scorer: Scorer,
  samples: Array<{ u: QueryUnderstanding; candidates: RerankerCandidate[]; gold: string }>,
): Promise<Metrics> {
  let h1 = 0, h3 = 0, h5 = 0, rr = 0, ndcg = 0;
  const t0 = performance.now();

  for (const sample of samples) {
    const queryTopic = sample.u.topic || sample.u.extractedTopic;
    const { expandedTerms } = expandRetrievalTerms(
      queryTopic,
      sample.u.keywords,
      sample.u.detectedSubject,
      sample.u.detectedGrade,
    );
    const ctx = {
      queryTopic,
      keywords: sample.u.keywords,
      subject: sample.u.detectedSubject,
      grade: sample.u.detectedGrade,
      queryVec: await defaultSemanticProvider.embedText(`${queryTopic} ${sample.u.detectedSubject ?? ""}`),
      canonicalTokens: Array.from(
        new Set(
          expandedTerms
            .flatMap((t) => t.toLowerCase().split(/\s+/))
            .filter((t) => t.length >= 3)
            .map(stemUzbekWord),
        ),
      ),
    };

    const scored: Array<{ id: string; score: number }> = [];
    for (const cand of sample.candidates) {
      scored.push({ id: cand.id, score: await scorer(cand, ctx) });
    }
    scored.sort((a, b) => b.score - a.score);

    const rank = scored.findIndex((s) => s.id === sample.gold) + 1;
    if (rank > 0) {
      if (rank === 1) h1++;
      if (rank <= 3) h3++;
      if (rank <= 5) h5++;
      rr += 1 / rank;
      ndcg += computeNdcg5(rank);
    }
  }

  const elapsed = performance.now() - t0;
  return {
    variant: name,
    queries: samples.length,
    recall1: pct(h1, samples.length),
    recall3: pct(h3, samples.length),
    recall5: pct(h5, samples.length),
    mrr: Number((rr / Math.max(1, samples.length)).toFixed(4)),
    ndcg5: Number((ndcg / Math.max(1, samples.length)).toFixed(4)),
    avgLatencyMs: Number((elapsed / Math.max(1, samples.length)).toFixed(3)),
  };
}

async function main() {
  const root = process.cwd();
  const core: EvalItem[] = JSON.parse(
    fs.readFileSync(path.join(root, "benchmark", "golden-dataset-500.json"), "utf8"),
  );
  const v5Dir = path.join(root, "benchmark", "v5");
  const extra: EvalItem[] = ["cross_grade.json", "synonym.json"].flatMap((f) =>
    JSON.parse(fs.readFileSync(path.join(v5Dir, f), "utf8")),
  );

  const withGold = [...core, ...extra].filter((i) => i.goldEvidenceTopicId);

  console.log("==========================================================");
  console.log(`   V5 ABLATION STUDY (${withGold.length} gold dalilli so'rov)`);
  console.log("==========================================================\n");
  console.log("Nomzodlar to'plami BARCHA variantlar uchun bir xil — faqat");
  console.log("reyting usuli almashtiriladi.\n");

  // Nomzodlarni bir marta yig'amiz.
  const samples: Array<{ u: QueryUnderstanding; candidates: RerankerCandidate[]; gold: string }> = [];
  for (const item of withGold) {
    const u = understandQuery(item.q);
    const candidates = await retrieveCurriculumCandidates(u, 100);
    samples.push({ u, candidates, gold: item.goldEvidenceTopicId! });
  }

  const results: Metrics[] = [];
  for (const [name, scorer] of Object.entries(SCORERS)) {
    results.push(await scoreVariant(name, scorer, samples));
  }

  // F — ishlab chiqarishdagi reranker (to'liq quvur).
  {
    let h1 = 0, h3 = 0, h5 = 0, rr = 0, ndcg = 0;
    const t0 = performance.now();
    for (const sample of samples) {
      const top = await rerankCandidates(sample.candidates, sample.u, 10);
      const rank = top.findIndex((m) => m.sourceId === sample.gold) + 1;
      if (rank > 0) {
        if (rank === 1) h1++;
        if (rank <= 3) h3++;
        if (rank <= 5) h5++;
        rr += 1 / rank;
        ndcg += computeNdcg5(rank);
      }
    }
    const elapsed = performance.now() - t0;
    results.splice(5, 0, {
      variant: "F. Full V5 (production)",
      queries: samples.length,
      recall1: pct(h1, samples.length),
      recall3: pct(h3, samples.length),
      recall5: pct(h5, samples.length),
      mrr: Number((rr / Math.max(1, samples.length)).toFixed(4)),
      ndcg5: Number((ndcg / Math.max(1, samples.length)).toFixed(4)),
      avgLatencyMs: Number((elapsed / Math.max(1, samples.length)).toFixed(3)),
    });
  }

  const full = results.find((r) => r.variant.startsWith("F."))!;

  console.log(
    "Variant".padEnd(36) +
      "R@1".padStart(8) + "R@3".padStart(8) + "R@5".padStart(8) +
      "MRR".padStart(9) + "nDCG@5".padStart(9) + "ms".padStart(8),
  );
  console.log("-".repeat(86));
  for (const r of results) {
    console.log(
      r.variant.padEnd(36) +
        `${r.recall1}`.padStart(8) + `${r.recall3}`.padStart(8) + `${r.recall5}`.padStart(8) +
        `${r.mrr}`.padStart(9) + `${r.ndcg5}`.padStart(9) + `${r.avgLatencyMs}`.padStart(8),
    );
  }

  console.log("\n## Komponentlarning HAQIQIY hissasi (F ga nisbatan MRR farqi)");
  for (const r of results.filter((x) => /^[GHIJ]\./.test(x.variant))) {
    const delta = Number((full.mrr - r.mrr).toFixed(4));
    const verdict = delta > 0.005 ? "FOYDALI" : delta < -0.005 ? "ZARARLI" : "ta'sirsiz";
    console.log(`- ${r.variant.padEnd(34)} MRR ${r.mrr} (F dan ${delta >= 0 ? "+" : ""}${delta}) -> ${verdict}`);
  }

  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "reports", "search-v5-ablation.json"),
    `${JSON.stringify({ timestamp: new Date().toISOString(), queries: samples.length, results }, null, 2)}\n`,
  );
  console.log("\n✅ reports/search-v5-ablation.json yozildi.");

  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
