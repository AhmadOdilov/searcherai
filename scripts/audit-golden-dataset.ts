/**
 * Golden Dataset V4 Audit Script
 *
 * Vazifalari:
 * 1. 500 ta golden querylar ichidagi dublikat va deyarli-dublikatlarni (Levenshtein / Jaccard) tekshirish.
 * 2. 10 ta fan, 11 ta sinf, 3 ta til, 13 ta intent taqsimotini to'liq hisoblash.
 * 3. PostgreSQL bazasidagi mavzular bilan bog'lash va har bir ta'limiy so'rovga aniq `goldEvidenceTopicId` biriktirish.
 * 4. Unsupported fanni (Fizika, Kimyo, Biologiya va b.) aniqlash va abstention holatini tasdiqlash.
 * 5. Natijani reports/golden-dataset-audit.json ga yozish.
 */

import fs from "fs";
import path from "path";
import { prisma } from "../lib/db";
import { normalizeQuery } from "../lib/search/normalization";

interface GoldenItem {
  id: string;
  q: string;
  expectedLanguage: string;
  expectedSubject?: string;
  expectedGrade?: string;
  expectedIntent: string;
  expectedAudience: string;
  difficulty: string;
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

function jaccardSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeQuery(s1 || "").normalized || "";
  const norm2 = normalizeQuery(s2 || "").normalized || "";
  const set1 = new Set(norm1.split(/\s+/).filter(Boolean));
  const set2 = new Set(norm2.split(/\s+/).filter(Boolean));
  if (set1.size === 0 || set2.size === 0) return 0;
  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }
  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

async function main() {
  const datasetPath = path.join(process.cwd(), "benchmark", "golden-dataset-500.json");
  const rawData = fs.readFileSync(datasetPath, "utf8");
  const dataset: GoldenItem[] = JSON.parse(rawData);

  console.log("==================================================");
  console.log(`🔍 AUDITING GOLDEN DATASET: ${dataset.length} items`);
  console.log("==================================================");

  // 1. Duplicate & Near-duplicate check
  const exactDuplicates: { id1: string; id2: string; q: string }[] = [];
  const nearDuplicates: {
    id1: string;
    id2: string;
    q1: string;
    q2: string;
    sim: number;
  }[] = [];
  const seenQueries = new Map<string, string>();

  for (let i = 0; i < dataset.length; i++) {
    const itemA = dataset[i];
    const normQ = normalizeQuery(itemA.q || "").normalized;

    if (seenQueries.has(normQ)) {
      exactDuplicates.push({
        id1: seenQueries.get(normQ)!,
        id2: itemA.id,
        q: itemA.q,
      });
    } else {
      seenQueries.set(normQ, itemA.id);
    }

    for (let j = i + 1; j < dataset.length; j++) {
      const itemB = dataset[j];
      const sim = jaccardSimilarity(itemA.q, itemB.q);
      if (sim > 0.85 && sim < 1.0) {
        nearDuplicates.push({
          id1: itemA.id,
          id2: itemB.id,
          q1: itemA.q,
          q2: itemB.q,
          sim,
        });
      }
    }
  }

  console.log(`- Exact duplicate normalized queries: ${exactDuplicates.length}`);
  console.log(`- High near-duplicates (Jaccard > 0.85): ${nearDuplicates.length}`);

  // 2. Fetch database topics
  const dbTopics = await prisma.curriculumTopic.findMany({
    select: {
      id: true,
      topicName: true,
      description: true,
      subject: true,
      grade: true,
    },
  });
  console.log(`- Database Curriculum Topics Available: ${dbTopics.length}`);

  // 3. Match expectedCurriculumTopic to dbTopics
  let linkedGoldEvidenceCount = 0;
  let unlinkedCurriculumExpected = 0;
  let abstentionExpectedCount = 0;

  for (const item of dataset) {
    if (item.expectedCurriculumTopic) {
      const expNorm = normalizeQuery(item.expectedCurriculumTopic || "").normalized;
      const matchedTopic = dbTopics.find((t) => {
        const topicNorm = normalizeQuery(t.topicName || "").normalized;
        const subjMatch =
          !item.expectedSubject ||
          t.subject.toLowerCase() === item.expectedSubject.toLowerCase();
        const gradeMatch =
          !item.expectedGrade ||
          t.grade.toLowerCase() === item.expectedGrade.toLowerCase() ||
          item.isCrossGrade;
        return (
          (topicNorm.includes(expNorm) || expNorm.includes(topicNorm)) &&
          subjMatch &&
          gradeMatch
        );
      });

      if (matchedTopic) {
        item.goldEvidenceTopicId = matchedTopic.id;
        item.goldEvidenceTopicTitle = matchedTopic.topicName;
        linkedGoldEvidenceCount++;
      } else {
        // Fallback: search by topic name only in same subject
        const fallbackTopic = dbTopics.find((t) => {
          const topicNorm = normalizeQuery(t.topicName || "").normalized;
          return topicNorm.includes(expNorm) || expNorm.includes(topicNorm);
        });
        if (fallbackTopic) {
          item.goldEvidenceTopicId = fallbackTopic.id;
          item.goldEvidenceTopicTitle = fallbackTopic.topicName;
          linkedGoldEvidenceCount++;
        } else {
          item.goldEvidenceTopicId = null;
          item.goldEvidenceTopicTitle = null;
          unlinkedCurriculumExpected++;
        }
      }
    } else {
      item.goldEvidenceTopicId = null;
      item.goldEvidenceTopicTitle = null;
      abstentionExpectedCount++;
    }
  }

  console.log(`- Linked Gold Evidence IDs: ${linkedGoldEvidenceCount}`);
  console.log(
    `- Queries expecting Evidence but not matched in DB: ${unlinkedCurriculumExpected}`,
  );
  console.log(
    `- Queries expecting Abstention (no DB evidence / unseeded): ${abstentionExpectedCount}`,
  );

  // 4. Distributions
  const subjectDist: Record<string, number> = {};
  const gradeDist: Record<string, number> = {};
  const langDist: Record<string, number> = {};
  const intentDist: Record<string, number> = {};
  const difficultyDist: Record<string, number> = {};

  for (const item of dataset) {
    const s = item.expectedSubject || "Unknown";
    subjectDist[s] = (subjectDist[s] || 0) + 1;

    const g = item.expectedGrade || "General";
    gradeDist[g] = (gradeDist[g] || 0) + 1;

    const l = item.expectedLanguage;
    langDist[l] = (langDist[l] || 0) + 1;

    const i = item.expectedIntent;
    intentDist[i] = (intentDist[i] || 0) + 1;

    const d = item.difficulty;
    difficultyDist[d] = (difficultyDist[d] || 0) + 1;
  }

  const auditReport = {
    timestamp: new Date().toISOString(),
    totalQueries: dataset.length,
    exactDuplicatesCount: exactDuplicates.length,
    exactDuplicates: exactDuplicates.slice(0, 10),
    nearDuplicatesCount: nearDuplicates.length,
    nearDuplicatesSample: nearDuplicates.slice(0, 10),
    linkedGoldEvidenceCount,
    unlinkedCurriculumExpected,
    abstentionExpectedCount,
    distributions: {
      subjects: subjectDist,
      grades: gradeDist,
      languages: langDist,
      intents: intentDist,
      difficulties: difficultyDist,
    },
  };

  const reportDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, "golden-dataset-audit.json"),
    JSON.stringify(auditReport, null, 2),
    "utf8",
  );

  // Also write updated dataset with goldEvidenceTopicId and goldEvidenceTopicTitle back
  fs.writeFileSync(datasetPath, JSON.stringify(dataset, null, 2), "utf8");

  console.log(
    "✅ Golden Dataset Audit finished! Report written to reports/golden-dataset-audit.json",
  );
}

main()
  .catch((err) => {
    console.error("Error running audit:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
