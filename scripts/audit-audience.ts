/**
 * Auditoriya (audience) aniqlashning maqsadli auditi — V6 PHASE 1.
 *
 * Maqsad: 89.60% ko'rsatkichining ORQASIDA nima turganini so'rov darajasida
 * ko'rsatish. Umumiy foiz ikki xil narsani aralashtirib yuboradi:
 *   a) so'rovda auditoriya ANIQ aytilgan holatlar (haqiqiy aniqlash);
 *   b) hech qanday marker yo'q holatlar (tizim taxmin qiladi).
 *
 * Skript hech narsani o'zgartirmaydi — faqat o'qiydi va tasniflaydi.
 */

import fs from "fs";
import path from "path";
import { understandQuery, type AudienceMode } from "../lib/search/understanding";

interface Item {
  id: string;
  q: string;
  expectedAudience?: AudienceMode;
  expectedIntent?: string;
  category?: string;
  difficulty?: string;
}

/**
 * Datasetdagi so'rovda auditoriya markeri BORMI?
 *
 * Bu ro'yxat `detectAudienceDetails` naqshlaridan MUSTAQIL yozilgan —
 * aks holda audit tekshirayotgan kodning o'z fikrini takrorlagan bo'lardi.
 */
const STUDENT_MARKER =
  /(bolaga|bolalarga|o['‘`ʻ]quvchiga|o['‘`ʻ]quvchiman|oddiy qilib|oddiy tilda|sodda qilib|tushunarli qilib|tushunmadim|uy vazifa|для учени|ученику|школьник|простыми словами|простым языком|для детей|домашнее задание|не понял|for students?|for a child|for pupils?|in simple words|i am a student|my homework)/i;

const TEACHER_MARKER =
  /(o['‘`ʻ]qituvchi|ustoz|dars ishlanma|dars reja|konspekt|sinfda|darsga|metodik|baholash|для учител|учителю|преподавател|поурочн|на уроке|методик|lesson plan|teaching|classroom|for teachers?)/i;

function main() {
  const root = process.cwd();
  const dataset: Item[] = JSON.parse(
    fs.readFileSync(path.join(root, "benchmark", "golden-dataset-500.json"), "utf8"),
  );

  const rows: Array<{
    id: string;
    q: string;
    expected: AudienceMode;
    actual: AudienceMode;
    isExplicitDetected: boolean;
    datasetMarker: "student" | "teacher" | "none" | "both";
    intent: string;
    ok: boolean;
  }> = [];

  for (const item of dataset) {
    if (!item.expectedAudience) continue;
    const u = understandQuery(item.q);

    const hasStudent = STUDENT_MARKER.test(item.q);
    const hasTeacher = TEACHER_MARKER.test(item.q);
    const datasetMarker =
      hasStudent && hasTeacher
        ? "both"
        : hasStudent
          ? "student"
          : hasTeacher
            ? "teacher"
            : "none";

    rows.push({
      id: item.id,
      q: item.q,
      expected: item.expectedAudience,
      actual: u.audience,
      isExplicitDetected: u.audienceIsExplicit,
      datasetMarker,
      intent: u.detectedIntent,
      ok: u.audience === item.expectedAudience,
    });
  }

  const failures = rows.filter((r) => !r.ok);
  const t2s = failures.filter((r) => r.actual === "teacher" && r.expected === "student");
  const s2t = failures.filter((r) => r.actual === "student" && r.expected === "teacher");

  console.log("==========================================================");
  console.log("   AUDIENCE AUDIT — V6 PHASE 1");
  console.log("==========================================================");
  console.log(`Auditoriya kutilmasi bor so'rovlar: ${rows.length}`);
  console.log(
    `To'g'ri: ${rows.length - failures.length}  (${((1 - failures.length / rows.length) * 100).toFixed(2)}%)`,
  );
  console.log(
    `Xato:    ${failures.length}  (teacher->student ${t2s.length}, student->teacher ${s2t.length})\n`,
  );

  // Markerlar bo'yicha kesim
  const byMarker: Record<string, { total: number; ok: number }> = {};
  for (const r of rows) {
    byMarker[r.datasetMarker] ??= { total: 0, ok: 0 };
    byMarker[r.datasetMarker].total++;
    if (r.ok) byMarker[r.datasetMarker].ok++;
  }

  console.log("## So'rovda marker bor-yo'qligi bo'yicha aniqlik");
  for (const [marker, stat] of Object.entries(byMarker)) {
    console.log(
      `- ${marker.padEnd(8)} ${String(stat.ok).padStart(4)}/${String(stat.total).padEnd(4)} = ${((stat.ok / stat.total) * 100).toFixed(2)}%`,
    );
  }

  const markerless = rows.filter((r) => r.datasetMarker === "none");
  const markerlessExpected: Record<string, number> = {};
  for (const r of markerless)
    markerlessExpected[r.expected] = (markerlessExpected[r.expected] ?? 0) + 1;

  console.log(
    `\n## Markersiz so'rovlarda dataset nimani kutadi (${markerless.length} ta)`,
  );
  console.log(`   ${JSON.stringify(markerlessExpected)}`);
  console.log("   -> Bitta standart qiymat bilan erishish mumkin bo'lgan MAKSIMUM:");
  const best = Math.max(...Object.values(markerlessExpected));
  console.log(
    `      ${best}/${markerless.length} = ${((best / markerless.length) * 100).toFixed(2)}%`,
  );

  console.log("\n## MARKERLI, lekin XATO aniqlangan (haqiqiy nosozliklar)");
  const realBugs = failures.filter((r) => r.datasetMarker !== "none");
  if (realBugs.length === 0) console.log("   yo'q");
  for (const r of realBugs) {
    console.log(`   ${r.id} [${r.datasetMarker}] ${r.actual} != ${r.expected} | ${r.q}`);
  }

  console.log("\n## teacher -> student (dataset student kutadi, tizim teacher berdi)");
  for (const r of t2s.slice(0, 40)) {
    console.log(`   ${r.id} [marker:${r.datasetMarker}] [intent:${r.intent}] ${r.q}`);
  }

  console.log("\n## student -> teacher (dataset teacher kutadi, tizim student berdi)");
  for (const r of s2t.slice(0, 40)) {
    console.log(`   ${r.id} [marker:${r.datasetMarker}] [intent:${r.intent}] ${r.q}`);
  }

  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "reports", "search-v6-audience-audit.json"),
    `${JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        total: rows.length,
        correct: rows.length - failures.length,
        accuracy: Number(
          (((rows.length - failures.length) / rows.length) * 100).toFixed(2),
        ),
        byDatasetMarker: byMarker,
        markerlessExpectedDistribution: markerlessExpected,
        markerlessBestPossibleWithSingleDefault: Number(
          ((best / markerless.length) * 100).toFixed(2),
        ),
        realDetectionBugs: realBugs,
        teacherInsteadOfStudent: t2s,
        studentInsteadOfTeacher: s2t,
      },
      null,
      2,
    )}\n`,
  );
  console.log("\n✅ reports/search-v6-audience-audit.json yozildi.");
}

main();
