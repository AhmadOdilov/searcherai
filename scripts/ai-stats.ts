/**
 * AI generatsiyalari statistikasi.
 *
 * Ishga tushirish:
 *   npm run ai:stats
 *   npm run ai:stats -- 7        # oxirgi 7 kun
 *
 * ── Nima uchun ────────────────────────────────────────────────────────────
 * `generateJson` javob sxemadan o'tmasa modelga QAYTA so'rov yuboradi.
 * Bu generatsiya narxini va vaqtini ikki baravar oshiradi, lekin
 * foydalanuvchiga ko'rinmaydi — ya'ni muammo jim o'sadi.
 *
 * Bu skript `aiAttempts` va `aiDurationMs` ustunlaridan foydalanib,
 * qayta urinish HAQIQATDA qanchalik tez-tez sodir bo'layotganini
 * ko'rsatadi. Agar ulush yuqori bo'lsa — systemPrompt'ni tuzatish kerak.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";

interface Row {
  status: string;
  aiAttempts: number | null;
  aiDurationMs: number | null;
  aiModel: string | null;
}

interface ModuleStats {
  name: string;
  total: number;
  ready: number;
  failed: number;
  pending: number;
  withMetrics: number;
  retried: number;
  durations: number[];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function summarize(name: string, rows: Row[]): ModuleStats {
  const withMetrics = rows.filter((row) => row.aiAttempts !== null);
  return {
    name,
    total: rows.length,
    ready: rows.filter((row) => row.status === "READY").length,
    failed: rows.filter((row) => row.status === "FAILED").length,
    pending: rows.filter((row) => row.status === "PENDING").length,
    withMetrics: withMetrics.length,
    retried: withMetrics.filter((row) => (row.aiAttempts ?? 1) > 1).length,
    durations: withMetrics
      .map((row) => row.aiDurationMs ?? 0)
      .filter((value) => value > 0),
  };
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function printModule(stats: ModuleStats): void {
  const { name, total, ready, failed, pending, withMetrics, retried, durations } = stats;

  console.log(`\n── ${name} ${"─".repeat(Math.max(0, 46 - name.length))}`);
  console.log(
    `  yozuvlar : ${total} (READY ${ready}, FAILED ${failed}, PENDING ${pending})`,
  );

  if (withMetrics === 0) {
    console.log("  o'lchov  : yo'q (hali muvaffaqiyatli generatsiya bo'lmagan)");
    return;
  }

  const retryShare = ((retried / withMetrics) * 100).toFixed(1);
  console.log(
    `  qayta urinish: ${retried} / ${withMetrics} (${retryShare}%)` +
      (retried > 0 ? "  ← narxni ikki baravar oshiradi" : ""),
  );

  if (durations.length > 0) {
    const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    console.log(
      `  davomiylik: o'rtacha ${formatSeconds(average)} · ` +
        `p50 ${formatSeconds(percentile(durations, 50))} · ` +
        `p95 ${formatSeconds(percentile(durations, 95))} · ` +
        `eng uzun ${formatSeconds(Math.max(...durations))}`,
    );
  }
}

async function main(): Promise<void> {
  const days = Number(process.argv[2] ?? 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: since } };
  const select = {
    status: true,
    aiAttempts: true,
    aiDurationMs: true,
    aiModel: true,
  } as const;

  const [lessonPlans, presentations, calendarPlans] = await Promise.all([
    prisma.lessonPlan.findMany({ where, select }),
    prisma.presentation.findMany({ where, select }),
    prisma.calendarPlan.findMany({ where, select }),
  ]);

  console.log(
    `\nAI generatsiyalari statistikasi — oxirgi ${days} kun ` +
      `(${since.toISOString().slice(0, 10)} dan)`,
  );

  const modules = [
    summarize("Dars ishlanmasi", lessonPlans),
    summarize("Prezentatsiya", presentations),
    summarize("Kalendar reja", calendarPlans),
  ];

  for (const stats of modules) printModule(stats);

  // ── Umumiy xulosa ────────────────────────────────────────────────────────
  const totalWithMetrics = modules.reduce((sum, m) => sum + m.withMetrics, 0);
  const totalRetried = modules.reduce((sum, m) => sum + m.retried, 0);

  console.log(`\n── Xulosa ${"─".repeat(41)}`);

  if (totalWithMetrics === 0) {
    console.log("  Hali o'lchanadigan generatsiya yo'q.");
    console.log(
      "  Bir nechta dars ishlanmasi/prezentatsiya yaratib, qayta ishga tushiring.",
    );
  } else {
    const share = (totalRetried / totalWithMetrics) * 100;
    console.log(
      `  Qayta urinish ulushi: ${totalRetried}/${totalWithMetrics} (${share.toFixed(1)}%)`,
    );

    if (share >= 20) {
      console.log("\n  ⚠ Ulush YUQORI (≥20%). Tavsiya:");
      console.log("    · systemPrompt'ga TO'LIQ JSON namunasi qo'shing");
      console.log("    · sxema chegaralarini (min/max) promptda aniq yozing");
      console.log("    · `AI_MODEL` ni kuchliroq modelga almashtirib ko'ring");
    } else if (share > 0) {
      console.log("\n  Ulush maqbul (<20%) — prompt tuzatish shart emas.");
    } else {
      console.log("\n  Qayta urinish umuman bo'lmagan — promptlar yaxshi ishlayapti.");
    }
  }
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Statistika olishda xato:", error);
    process.exit(1);
  });
