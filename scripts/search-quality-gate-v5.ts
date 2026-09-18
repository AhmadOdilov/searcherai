/**
 * Searcher AI — V5 Quality Gate (§22).
 *
 * Chegaralar V5 topshirig'ida berilganidek olingan va YUMSHATILMAGAN.
 * Agar biror chegara bajarilmasa, skript exit 1 qaytaradi.
 *
 * ── Nega eski gate yaramasdi ──────────────────────────────────────────────
 * `scripts/search-quality-gate.ts` V3 ning 300 so'rovli baholashini
 * ishga tushirardi va quyidagilarni UMUMAN tekshirmasdi:
 *   · abstention precision (V4 da u qattiq kodlangan 100% edi),
 *   · cross-grade ogohlantirish aniqligi,
 *   · soxta DTS iqtiboslari,
 *   · xavfsizlik (adversarial) natijalari,
 *   · dataset yaxlitligi.
 *
 * Bu gate esa `reports/search-v5-evaluation.json` va
 * `reports/search-v5-multiturn.json` fayllarini o'qiydi — ya'ni avval
 * baholashni ishga tushirish shart.
 */

import fs from "fs";
import path from "path";

interface GateCheck {
  name: string;
  actual: number | boolean;
  threshold: number | boolean;
  comparison: ">=" | "<=" | "==";
  unit?: string;
  note?: string;
}

function readReport<T>(file: string): T {
  const full = path.join(process.cwd(), "reports", file);
  if (!fs.existsSync(full)) {
    console.error(`❌ ${file} topilmadi. Avval baholashni ishga tushiring:`);
    console.error("   npm run search:eval-v5 && npm run search:eval-multiturn");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

function passes(check: GateCheck): boolean {
  if (typeof check.actual === "boolean" || typeof check.threshold === "boolean") {
    return check.actual === check.threshold;
  }
  if (check.comparison === ">=") return check.actual >= check.threshold;
  if (check.comparison === "<=") return check.actual <= check.threshold;
  return check.actual === check.threshold;
}

function main() {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const evaluation = readReport<any>("search-v5-evaluation.json");
  const multiturn = readReport<any>("search-v5-multiturn.json");
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const checks: GateCheck[] = [
    // ── Query understanding ──────────────────────────────────────────────
    { name: "Language accuracy", actual: evaluation.understanding.languageAccuracy, threshold: 98, comparison: ">=", unit: "%" },
    { name: "Subject accuracy", actual: evaluation.understanding.subjectAccuracy, threshold: 95, comparison: ">=", unit: "%" },
    { name: "Grade accuracy", actual: evaluation.understanding.gradeAccuracy, threshold: 98, comparison: ">=", unit: "%" },
    { name: "Intent accuracy", actual: evaluation.understanding.intentAccuracy, threshold: 90, comparison: ">=", unit: "%" },
    {
      name: "Audience accuracy (umumiy)",
      actual: evaluation.understanding.audienceAccuracy,
      threshold: 92,
      comparison: ">=",
      unit: "%",
      note: "Markersiz so'rovlarda standart qiymat bilan kelishmovchilikni ham o'z ichiga oladi.",
    },
    {
      name: "Audience accuracy (aniq markerli)",
      actual: evaluation.understanding.audienceExplicitAccuracy,
      threshold: 98,
      comparison: ">=",
      unit: "%",
      note: "Foydalanuvchi auditoriyani ochiq aytgan holatlar — aniqlashning haqiqiy o'lchovi.",
    },

    // ── Retrieval va ranking ─────────────────────────────────────────────
    { name: "Candidate Recall@20", actual: evaluation.candidateRetrieval.recall20, threshold: 80, comparison: ">=", unit: "%" },
    { name: "Reranker Recall@5", actual: evaluation.reranker.recall5, threshold: 80, comparison: ">=", unit: "%" },
    { name: "MRR", actual: evaluation.reranker.mrr, threshold: 0.65, comparison: ">=" },
    { name: "nDCG@5", actual: evaluation.reranker.ndcg5, threshold: 0.68, comparison: ">=" },

    // ── Grounding ────────────────────────────────────────────────────────
    {
      name: "Contradiction rate (umumiy)",
      actual: evaluation.grounding.contradictionRate,
      threshold: 2,
      comparison: "<=",
      unit: "%",
      note: "DIQQAT: validator sinf tafovuti ogohlantirishini ham 'contradicted' deb belgilaydi.",
    },
    {
      name: "Contradiction rate (faktik)",
      actual: evaluation.grounding.factualContradictionRate,
      threshold: 0,
      comparison: "<=",
      unit: "%",
      note: "Javobning dalilga zid kelishi. Soat ziddiyati zondi detektor ko'r emasligini isbotlaydi.",
    },
    { name: "Soxta DTS iqtiboslari", actual: evaluation.grounding.fakeDtsCitations, threshold: 0, comparison: "==" },
    {
      name: "Soat ziddiyatini aniqlash",
      actual: evaluation.grounding.hoursProbe.detectionRate,
      threshold: 99,
      comparison: ">=",
      unit: "%",
    },
    {
      name: "Soat ziddiyati — yolg'on musbat",
      actual: evaluation.grounding.hoursProbe.falsePositives,
      threshold: 0,
      comparison: "==",
    },

    // ── Abstention va cross-grade ────────────────────────────────────────
    { name: "Abstention precision", actual: evaluation.abstention.precision, threshold: 99, comparison: ">=", unit: "%" },
    { name: "Abstention recall", actual: evaluation.abstention.recall, threshold: 90, comparison: ">=", unit: "%" },
    { name: "False grounding", actual: evaluation.abstention.falseGrounding, threshold: 0, comparison: "==" },
    { name: "Cross-grade warning accuracy", actual: evaluation.crossGrade.accuracy, threshold: 98, comparison: ">=", unit: "%" },
    { name: "Cross-grade false positive rate", actual: evaluation.crossGrade.falsePositiveRate, threshold: 2, comparison: "<=", unit: "%" },

    // ── Xavfsizlik ───────────────────────────────────────────────────────
    { name: "Adversarial pass rate", actual: evaluation.security.passRate, threshold: 100, comparison: ">=", unit: "%" },

    // ── Multi-turn ───────────────────────────────────────────────────────
    { name: "Multi-turn: fan saqlanishi", actual: multiturn.subjectRetention.rate, threshold: 98, comparison: ">=", unit: "%" },
    { name: "Multi-turn: mavzu saqlanishi", actual: multiturn.topicRetention.rate, threshold: 95, comparison: ">=", unit: "%" },
    { name: "Multi-turn: chegaralangan xotira", actual: multiturn.boundedMemoryAt1000Turns, threshold: true, comparison: "==" },

    // ── Latency (LLM generatsiyasidan ALOHIDA) ───────────────────────────
    {
      name: "Mahalliy quvur p95",
      actual: evaluation.latencyLocalPipelineMs.p95,
      threshold: 60,
      comparison: "<=",
      unit: "ms",
      note: "LLM generatsiyasi KIRMAGAN. E2E javob vaqti alohida o'lchanadi.",
    },
    {
      name: "Mahalliy quvur p99",
      actual: evaluation.latencyLocalPipelineMs.p99,
      threshold: 120,
      comparison: "<=",
      unit: "ms",
      note: "LLM generatsiyasi KIRMAGAN.",
    },
  ];

  console.log("==========================================================");
  console.log("   SEARCH QUALITY GATE — V5");
  console.log("==========================================================");
  console.log(`Dataset: ${evaluation.datasetComposition.total} so'rov`);
  console.log(`Baholash vaqti: ${evaluation.timestamp}\n`);

  const failures: GateCheck[] = [];

  for (const check of checks) {
    const ok = passes(check);
    if (!ok) failures.push(check);
    const unit = check.unit ?? "";
    const symbol = ok ? "✅" : "❌";
    console.log(
      `${symbol} ${check.name.padEnd(38)} ${String(check.actual).padStart(8)}${unit}  ` +
        `(talab ${check.comparison} ${check.threshold}${unit})`,
    );
    if (check.note) console.log(`     ${check.note}`);
  }

  console.log("\n==========================================================");
  if (failures.length === 0) {
    console.log("✅ BARCHA V5 CHEGARALARI BAJARILDI");
    console.log("==========================================================");
    return;
  }

  console.error(`❌ V5 QUALITY GATE BAJARILMADI — ${failures.length} ta chegara`);
  console.error("");
  for (const f of failures) {
    console.error(`  · ${f.name}: ${f.actual}${f.unit ?? ""} (talab ${f.comparison} ${f.threshold}${f.unit ?? ""})`);
  }
  console.error("");
  console.error("Chegaralar ATAYLAB yumshatilmadi (§22). Yuqoridagi raqamlar");
  console.error("tizimning hozirgi haqiqiy holati.");
  console.error("==========================================================");
  process.exit(1);
}

main();
