/**
 * Production Search Quality Gate (Phase 18).
 *
 * Ushbu skript CI/CD quvurida ishga tushirilib, qidiruv sifati yoki
 * tezligida regressiya bo'lsa, deploymentni BLOKLAYDI (exit code 1).
 */

import { runV3Evaluation } from "./evaluate-search-v3";
import { prisma } from "../lib/db";

interface QualityThresholds {
  minLanguageAccuracy: number;
  minSubjectAccuracy: number;
  minGradeAccuracy: number;
  minIntentAccuracy: number;
  minAudienceAccuracy: number;
  minRecallAt5: number;
  minMrr: number;
  minNdcg5: number;
  maxP95LatencyMs: number;
  maxContradictionRate: number;
}

const THRESHOLDS: QualityThresholds = {
  minLanguageAccuracy: 98.0,
  minSubjectAccuracy: 95.0,
  minGradeAccuracy: 98.0,
  minIntentAccuracy: 90.0,
  minAudienceAccuracy: 92.0,
  minRecallAt5: 75.0,
  minMrr: 0.65,
  minNdcg5: 0.68,
  maxP95LatencyMs: 35.0,
  maxContradictionRate: 2.0,
};

async function checkQualityGate() {
  console.log("==========================================================");
  console.log("   SEARCH QUALITY GATE ENFORCEMENT (PHASE 18)");
  console.log("==========================================================\n");

  const results = await runV3Evaluation();
  const violations: string[] = [];

  if (results.langAcc < THRESHOLDS.minLanguageAccuracy) {
    violations.push(
      `Language Accuracy (${results.langAcc}%) < ${THRESHOLDS.minLanguageAccuracy}%`,
    );
  }
  if (results.subjAcc < THRESHOLDS.minSubjectAccuracy) {
    violations.push(
      `Subject Accuracy (${results.subjAcc}%) < ${THRESHOLDS.minSubjectAccuracy}%`,
    );
  }
  if (results.gradeAcc < THRESHOLDS.minGradeAccuracy) {
    violations.push(
      `Grade Accuracy (${results.gradeAcc}%) < ${THRESHOLDS.minGradeAccuracy}%`,
    );
  }
  if (results.intentAcc < THRESHOLDS.minIntentAccuracy) {
    violations.push(
      `Intent Accuracy (${results.intentAcc}%) < ${THRESHOLDS.minIntentAccuracy}%`,
    );
  }
  if (results.audAcc < THRESHOLDS.minAudienceAccuracy) {
    violations.push(
      `Audience Accuracy (${results.audAcc}%) < ${THRESHOLDS.minAudienceAccuracy}%`,
    );
  }
  if (results.recall5 < THRESHOLDS.minRecallAt5) {
    violations.push(`Recall@5 (${results.recall5}%) < ${THRESHOLDS.minRecallAt5}%`);
  }
  if (results.mrr < THRESHOLDS.minMrr) {
    violations.push(`MRR (${results.mrr}) < ${THRESHOLDS.minMrr}`);
  }
  if (results.ndcg5 < THRESHOLDS.minNdcg5) {
    violations.push(`nDCG@5 (${results.ndcg5}) < ${THRESHOLDS.minNdcg5}`);
  }
  if (results.p95Latency > THRESHOLDS.maxP95LatencyMs) {
    violations.push(
      `p95 Latency (${results.p95Latency} ms) > ${THRESHOLDS.maxP95LatencyMs} ms`,
    );
  }
  if (results.contradictionRate > THRESHOLDS.maxContradictionRate) {
    violations.push(
      `Contradiction Rate (${results.contradictionRate}%) > ${THRESHOLDS.maxContradictionRate}%`,
    );
  }

  console.log("\n==========================================================");
  if (violations.length > 0) {
    console.error("❌ SEARCH QUALITY GATE FAILED — DEPLOYMENT BLOCKED");
    console.error("Violations detected:");
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  } else {
    console.log("✅ ALL SEARCH QUALITY GATE THRESHOLDS PASSED");
    console.log("Deployment is approved.");
  }
  console.log("==========================================================\n");
}

checkQualityGate()
  .catch((err) => {
    console.error("Quality gate execution error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
