import { prisma } from "@/lib/db";
import { aiInfo } from "@/lib/ai/provider";
import { getCurrentUser } from "@/lib/auth/session";
import { storageDriverName } from "@/lib/storage/files";
import { ok, withErrorHandling } from "@/lib/api/with-error-handling";

/**
 * Sog'lik tekshiruvi — `GET /api/health`.
 *
 * Nima uchun kerak:
 *  · Docker `HEALTHCHECK` va `scripts/deploy.sh` ilova ko'tarilganini
 *    shu orqali biladi;
 *  · deploy'dan keyin baza va AI sozlamasi joyidami — bir so'rov bilan.
 *
 * ── Nega javob IKKI darajali ──────────────────────────────────────────────
 * Bu endpoint autentifikatsiyasiz ochiq bo'lishi SHART: healthcheck
 * konteyner ichidan cookie'siz so'raydi. Lekin auditda ma'lum bo'ldiki,
 * ochiq javob infratuzilma tafsilotlarini oshkor qilardi — jumladan
 * to'liq model identifikatorini:
 *
 *   "gpt://b1guvejikvogoiq83shn/yandexgpt-5-pro/latest"
 *
 * Bu — bulut katalogi identifikatori. Kalitning o'zi emas, lekin
 * hujumchiga qaysi provayder, qaysi model va qaysi hisob ishlatilayotganini
 * aytadi. Bunday ma'lumot ochiq turishi kerak emas.
 *
 * Shuning uchun:
 *  · ANONIM so'rov  → faqat "ishlayaptimi" degan javob. Hech qanday
 *    provayder nomi, model, saqlagich turi yoki o'lchov yo'q.
 *  · ADMIN so'rovi  → to'liq diagnostika.
 *
 * API kaliti HECH QAYSI darajada qaytarilmaydi — `aiInfo()` uni umuman
 * bermaydi.
 *
 * ── Nega qo'shimcha baza so'rovi paydo bo'lmaydi ──────────────────────────
 * `getCurrentUser()` avval cookie'ni o'qiydi. Healthcheck cookie'siz
 * so'raydi, ya'ni funksiya bazaga tegmasdan `null` qaytaradi.
 */
export const GET = withErrorHandling(async () => {
  const database = await checkDatabase();

  /*
    Anonim javobning maydonlari ataylab shu uchtasi:
      · status   — deploy skriptlari va operator uchun;
      · database.connected — e2e `global-server.ts` shu qiymatni kutadi
        va u hech narsani oshkor qilmaydi ("baza bor" — allaqachon ma'lum);
      · ai.configured — AI yoqilganmi. Provayder nomi YO'Q.
  */
  const publicPayload = {
    status: database.connected ? "ok" : "degraded",
    database: { connected: database.connected },
    ai: { configured: aiInfo().configured },
    timestamp: new Date().toISOString(),
  };

  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return ok(publicPayload);

  const ai = aiInfo();
  return ok({
    ...publicPayload,
    /*
      Faqat ADMIN uchun. Bu yerdagi hamma narsa — infratuzilma tafsiloti:
      qaysi provayder, qaysi model, qayerda fayl saqlanadi, baza qancha
      tez javob beradi.
    */
    diagnostics: {
      database: { latencyMs: database.latencyMs, error: database.error },
      ai: { provider: ai.provider, model: ai.model, baseUrl: ai.baseUrl },
      storage: { driver: storageDriverName() },
    },
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
