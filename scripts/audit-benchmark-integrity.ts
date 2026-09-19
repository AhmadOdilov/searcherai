/**
 * Benchmark yaxlitligi auditi (§19).
 *
 * Bu skript o'lchov EMAS — u datasetning O'ZINI tekshiradi. Sabab: V4 da
 * datasetdagi yorliq xatolari jimgina o'lchovlarga oqib o'tgan edi.
 *
 * Aniqlangan haqiqiy nosozliklar (V5 auditida):
 *   · 7 ta so'rovning gold dalili BOSHQA sinfdan edi, lekin ular
 *     `isCrossGrade` deb belgilanmagan — ya'ni cross-grade hodisasi
 *     oddiy retrieval sifatida hisoblangan;
 *   · gold id'lar `cuid()` bo'lgani uchun har qayta seed'da yaroqsiz
 *     bo'lib qolardi (endi `dts_…` deterministik).
 *
 * Tekshiradi:
 *   1. Takroriy so'rov va takroriy id (barcha to'plamlar bo'ylab).
 *   2. Har bir gold id bazada MAVJUDligi.
 *   3. Gold dalil sinfi so'ralgan sinfga mos yoki cross-grade deb
 *      to'g'ri belgilanganligi.
 *   4. Fan nomi reyestrda borligi.
 *   5. Sinf formati va til kodi to'g'riligi.
 *   6. Abstention kutilayotgan so'rovlarda gold dalil bo'lmasligi.
 *
 * Nosozlik topilsa exit code 1 — CI buni bloklaydi.
 */

import fs from "fs";
import path from "path";
import { prisma } from "../lib/db";
import { CURRICULUM_SUBJECT_REGISTRY } from "../lib/curriculum/ingestion/registry";
import { getCurriculumCoverage } from "../lib/curriculum/coverage";

interface Item {
  id: string;
  q: string;
  suite?: string;
  expectedLanguage?: string;
  expectedSubject?: string;
  expectedGrade?: string;
  goldEvidenceTopicId?: string | null;
  goldEvidenceTopicTitle?: string | null;
  expectAbstention?: boolean;
  isUnsupportedSubject?: boolean;
  isCrossGrade?: boolean;
  expectedAvailableGrade?: string;
}

const VALID_LANGUAGES = new Set(["UZ", "RU", "EN"]);
const GRADE_PATTERN = /^([1-9]|1[01])-sinf$/;

async function main() {
  const root = process.cwd();
  const files: Array<{ name: string; items: Item[] }> = [];

  files.push({
    name: "golden-dataset-500.json",
    items: JSON.parse(
      fs.readFileSync(path.join(root, "benchmark", "golden-dataset-500.json"), "utf8"),
    ),
  });

  const v5Dir = path.join(root, "benchmark", "v5");
  if (fs.existsSync(v5Dir)) {
    for (const f of fs
      .readdirSync(v5Dir)
      .filter((n) => n.endsWith(".json"))
      .sort()) {
      files.push({
        name: `v5/${f}`,
        items: JSON.parse(fs.readFileSync(path.join(v5Dir, f), "utf8")),
      });
    }
  }

  const dbTopics = await prisma.curriculumTopic.findMany({
    select: { id: true, subject: true, grade: true, topicName: true },
  });
  const topicById = new Map(dbTopics.map((t) => [t.id, t]));

  const problems: string[] = [];

  /*
    REYESTR <-> BAZA DREYFI (V6).

    `CURRICULUM_SUBJECT_REGISTRY.gradesAvailable` endi qamrov tekshiruvining
    MANBASI: so'ralgan sinf ro'yxatda bo'lmasa, tizim rasmiy dalil
    qaytarmaydi. Shuning uchun ro'yxat bazadan ajralib qolsa, oqibat
    jiddiy bo'ladi — mavjud dastur "yo'q" deb e'lon qilinadi yoki aksincha.
  */
  const dbGrades = new Map<string, Set<string>>();
  for (const t of dbTopics) {
    const key = t.subject.toLowerCase();
    if (!dbGrades.has(key)) dbGrades.set(key, new Set());
    dbGrades.get(key)!.add(t.grade.toLowerCase());
  }

  for (const entry of Object.values(CURRICULUM_SUBJECT_REGISTRY)) {
    const actual = dbGrades.get(entry.subject.toLowerCase()) ?? new Set<string>();
    const declared = new Set(entry.gradesAvailable.map((g) => g.toLowerCase()));

    for (const g of declared) {
      if (!actual.has(g)) {
        problems.push(
          `[registry_grade_missing_in_db] ${entry.subject}: reyestr «${g}» deydi, bazada yo'q`,
        );
      }
    }
    for (const g of actual) {
      if (!declared.has(g)) {
        problems.push(
          `[db_grade_missing_in_registry] ${entry.subject}: bazada «${g}» bor, reyestrda yo'q`,
        );
      }
    }
    if (entry.status !== "OFFICIAL" && actual.size > 0) {
      problems.push(
        `[registry_status_drift] ${entry.subject}: status ${entry.status}, lekin bazada ${actual.size} sinf bor`,
      );
    }
  }

  // Qamrov mantiqi reyestr bilan mos ishlayotganini tasdiqlash.
  for (const entry of Object.values(CURRICULUM_SUBJECT_REGISTRY)) {
    for (const g of entry.gradesAvailable) {
      if (getCurriculumCoverage(entry.subject, g).status !== "COVERED") {
        problems.push(`[coverage_logic_drift] ${entry.subject} ${g}: COVERED kutilgandi`);
      }
    }
  }

  const seenIds = new Map<string, string>();
  const seenQueries = new Map<string, string>();
  let total = 0;
  let withGold = 0;

  for (const file of files) {
    for (const item of file.items) {
      total++;

      // 1. Takrorlanish
      if (seenIds.has(item.id)) {
        problems.push(
          `[duplicate_id] ${item.id} — ${file.name} va ${seenIds.get(item.id)}`,
        );
      } else {
        seenIds.set(item.id, file.name);
      }

      const qKey = item.q.trim().toLowerCase();
      if (seenQueries.has(qKey)) {
        problems.push(
          `[duplicate_query] ${item.id} — ${seenQueries.get(qKey)} bilan bir xil`,
        );
      } else {
        seenQueries.set(qKey, item.id);
      }

      // 5. Format
      if (item.expectedLanguage && !VALID_LANGUAGES.has(item.expectedLanguage)) {
        problems.push(`[invalid_language] ${item.id}: ${item.expectedLanguage}`);
      }
      if (item.expectedGrade && !GRADE_PATTERN.test(item.expectedGrade)) {
        problems.push(`[invalid_grade] ${item.id}: ${item.expectedGrade}`);
      }

      // 4. Fan reyestrda
      if (item.expectedSubject && !CURRICULUM_SUBJECT_REGISTRY[item.expectedSubject]) {
        problems.push(`[unknown_subject] ${item.id}: ${item.expectedSubject}`);
      }

      // 2 & 3. Gold dalil
      if (item.goldEvidenceTopicId) {
        withGold++;
        const topic = topicById.get(item.goldEvidenceTopicId);
        if (!topic) {
          problems.push(
            `[missing_gold_topic] ${item.id}: ${item.goldEvidenceTopicId} bazada yo'q`,
          );
          continue;
        }
        if (!item.goldEvidenceTopicId.startsWith("dts_")) {
          problems.push(
            `[non_deterministic_gold_id] ${item.id}: ${item.goldEvidenceTopicId}`,
          );
        }
        if (
          item.goldEvidenceTopicTitle &&
          item.goldEvidenceTopicTitle.normalize("NFC") !==
            topic.topicName.normalize("NFC")
        ) {
          problems.push(
            `[gold_title_drift] ${item.id}: «${item.goldEvidenceTopicTitle}» != «${topic.topicName}»`,
          );
        }
        if (
          item.expectedSubject &&
          topic.subject.toLowerCase() !== item.expectedSubject.toLowerCase()
        ) {
          problems.push(
            `[gold_subject_mismatch] ${item.id}: ${topic.subject} != ${item.expectedSubject}`,
          );
        }
        if (item.expectedGrade) {
          const sameGrade =
            topic.grade.toLowerCase() === item.expectedGrade.toLowerCase();
          if (!sameGrade && !item.isCrossGrade) {
            problems.push(
              `[unlabelled_cross_grade] ${item.id}: so'ralgan ${item.expectedGrade}, gold ${topic.grade}`,
            );
          }
          if (
            !sameGrade &&
            item.isCrossGrade &&
            item.expectedAvailableGrade?.toLowerCase() !== topic.grade.toLowerCase()
          ) {
            problems.push(
              `[cross_grade_label_drift] ${item.id}: ${item.expectedAvailableGrade} != ${topic.grade}`,
            );
          }
          if (sameGrade && item.isCrossGrade) {
            problems.push(
              `[false_cross_grade_label] ${item.id}: gold aynan so'ralgan sinfda`,
            );
          }
        }

        // 6. Abstention va gold birga bo'lmaydi
        if (item.expectAbstention || item.isUnsupportedSubject) {
          problems.push(
            `[abstention_with_gold] ${item.id}: ehtiyot kutilyapti, lekin gold dalil bor`,
          );
        }
      }
    }
  }

  console.log("==========================================================");
  console.log("   BENCHMARK INTEGRITY AUDIT");
  console.log("==========================================================");
  console.log(`Fayllar:        ${files.length}`);
  for (const f of files)
    console.log(`  · ${f.name.padEnd(28)} ${String(f.items.length).padStart(4)}`);
  console.log(`Jami so'rov:    ${total}`);
  console.log(
    `Takroriy id:    ${problems.filter((p) => p.startsWith("[duplicate_id]")).length}`,
  );
  console.log(
    `Takroriy so'rov:${problems.filter((p) => p.startsWith("[duplicate_query]")).length}`,
  );
  console.log(`Gold dalilli:   ${withGold}`);
  console.log(`Bazadagi mavzu: ${dbTopics.length}`);

  if (problems.length > 0) {
    console.error(`\n❌ ${problems.length} ta yaxlitlik muammosi:`);
    for (const p of problems.slice(0, 60)) console.error(`  - ${p}`);
    if (problems.length > 60) console.error(`  … va yana ${problems.length - 60} ta`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("\n✅ Yaxlitlik muammolari topilmadi.");
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
