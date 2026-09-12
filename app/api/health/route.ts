import { prisma } from "@/lib/db";
import { aiInfo } from "@/lib/ai/provider";
import { storageDriverName } from "@/lib/storage/files";
import { ok, withErrorHandling } from "@/lib/api/with-error-handling";

/**
 * Sog'lik tekshiruvi — `GET /api/health`.
 *
 * Nima uchun kerak:
 *  · Deploy'dan keyin baza va AI sozlamasi joyidami — bir so'rov bilan bilish
 *  · Frontend AI yoqilganini bilib, generatsiya tugmasini ko'rsatishi uchun
 *
 * API kaliti qaytarilmaydi — faqat "sozlangan/sozlanmagan" holati.
 */
export const GET = withErrorHandling(async () => {
  const database = await checkDatabase();
  const ai = aiInfo();

  return ok({
    status: database.connected ? "ok" : "degraded",
    database,
    ai: {
      provider: ai.provider,
      model: ai.model,
      configured: ai.configured,
    },
    // Qaysi saqlagich ishlayotgani — deploy'dan keyin tekshirish uchun.
    storage: { driver: storageDriverName() },
    timestamp: new Date().toISOString(),
  });
});

async function checkDatabase(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true, latencyMs: Date.now() - startedAt };
  } catch (caught) {
    // Baza yiqilsa ham endpoint javob berishi kerak — shuning uchun bu
    // xatolik yuqoriga uzatilmaydi, javob ichida qaytariladi.
    console.error("[health] bazaga ulanib bo'lmadi:", caught);
    return {
      connected: false,
      error: "bazaga ulanib bo'lmadi",
    };
  }
}
