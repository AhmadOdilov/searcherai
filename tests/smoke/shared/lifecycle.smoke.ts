import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { TestClient, cleanupTestUsers, testEmail } from "../../e2e/helpers/client.ts";
import { STALE_AFTER_MS } from "../../../lib/generation/constants.ts";
import { storageFileExists, withRestartedInstance } from "../helpers/target.ts";

/**
 * Ma'lumot va generatsiya SIKLI — haqiqiy artefakt, haqiqiy baza,
 * haqiqiy fayl tizimi.
 *
 * Ikki narsa tekshiriladi va ikkalasi ham faqat shu qatlamda ko'rinadi:
 *
 *  1. HISOBNI O'CHIRISH — baza cascade'i fayl tizimini BILMAYDI. Yozuv
 *     o'chib, .pptx diskda qolib ketishi mumkin va bunday yetim fayl
 *     hech qanday so'rovda ko'rinmaydi. Uni topishning yagona yo'li —
 *     o'chirgandan keyin saqlagichga qarash.
 *
 *  2. OSILIB QOLGAN GENERATSIYA — `after()` ichidagi fon ishi deploy
 *     paytida uziladi va yozuv MANGU PENDING qolishi mumkin. Tiklanish
 *     ikki yo'l bilan bo'ladi (`lib/generation/stale.ts`) va ikkalasi
 *     ham bu yerda tekshiriladi.
 */

const PASSWORD = "juda-maxfiy-parol";

let prisma: typeof import("../../../lib/db.ts").prisma;

before(async () => {
  await cleanupTestUsers();
  ({ prisma } = await import("../../../lib/db.ts"));
});

after(async () => {
  await cleanupTestUsers();
});

async function signedUp(suffix: string): Promise<{ client: TestClient; email: string }> {
  const client = new TestClient();
  const email = testEmail(suffix);
  const registered = await client.request("/api/auth/register", {
    method: "POST",
    body: { email, password: PASSWORD, fullName: "Smoke Sikl" },
  });
  assert.equal(registered.status, 201);
  return { client, email };
}

/** Tayyor prezentatsiya yaratadi va yozuvni qaytaradi. */
async function readyPresentation(
  client: TestClient,
  topic: string,
): Promise<{ id: string; filePath: string }> {
  const created = await client.request<{ presentation: { id: string } }>(
    "/api/presentations",
    {
      method: "POST",
      body: { mode: "standalone", topic, language: "UZ", template: "klassik" },
    },
  );
  assert.equal(created.status, 202);
  const id = created.data!.presentation.id;

  for (let attempt = 0; attempt < 100; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const result = await client.request<{
      presentation: {
        status: string;
        filePath: string | null;
        errorMessage: string | null;
      };
    }>(`/api/presentations/${id}`);
    const record = result.data!.presentation;
    if (record.status === "READY") {
      assert.ok(record.filePath, "READY yozuvda fayl yo'li yo'q");
      return { id, filePath: record.filePath };
    }
    assert.notEqual(
      record.status,
      "FAILED",
      `generatsiya yiqildi: ${record.errorMessage}`,
    );
  }
  assert.fail("prezentatsiya 30s ichida tayyor bo'lmadi");
}

describe("hisobni o'chirish — baza va saqlagich birga", () => {
  it("noto'g'ri parol bilan o'chirib bo'lmaydi", async () => {
    const { client } = await signedUp("smoke-ochirish-parol");

    const rejected = await client.request("/api/user/account", {
      method: "DELETE",
      body: { password: "bu-parol-notogri" },
    });

    assert.equal(rejected.status, 400);

    // Hisob tirik qoldi.
    const alive = await client.request("/api/lesson-plans");
    assert.equal(alive.status, 200);
  });

  it("o'chirilgach: sessiya, yozuv va FAYL — hammasi yo'qoladi", async () => {
    const { client, email } = await signedUp("smoke-ochirish");

    const me = await client.request<{ user: { id: string } }>("/api/auth/me");
    const userId = me.data!.user.id;

    const { id, filePath } = await readyPresentation(client, "Smoke: o'chirish sinovi");

    // 1-holat: o'chirishdan OLDIN hammasi joyida.
    assert.ok(
      await storageFileExists("presentations", filePath),
      "o'chirishdan oldin fayl saqlagichda yo'q edi",
    );
    assert.equal(
      await prisma.presentation.count({ where: { id, userId } }),
      1,
      "o'chirishdan oldin bazada yozuv yo'q edi",
    );

    const deleted = await client.request("/api/user/account", {
      method: "DELETE",
      body: { password: PASSWORD },
    });
    assert.equal(deleted.status, 200);

    // 2-holat: sessiya o'ldi.
    const afterDelete = await client.request("/api/lesson-plans");
    assert.equal(afterDelete.status, 401, "o'chirilgan hisob sessiyasi tirik qoldi");

    // 3-holat: baza cascade'i ishladi — foydalanuvchi ham, yozuv ham, sessiya ham.
    assert.equal(await prisma.user.count({ where: { email } }), 0, "foydalanuvchi qoldi");
    assert.equal(
      await prisma.presentation.count({ where: { id } }),
      0,
      "prezentatsiya yozuvi cascade bilan o'chmadi",
    );
    assert.equal(
      await prisma.session.count({ where: { userId } }),
      0,
      "sessiya yozuvi cascade bilan o'chmadi",
    );

    // 4-holat: FIZIK fayl ham yo'q — yetim qolmadi.
    assert.equal(
      await storageFileExists("presentations", filePath),
      false,
      `saqlagichda yetim fayl qoldi: ${filePath}`,
    );
  });
});

describe("osilib qolgan generatsiyani tiklash", () => {
  /**
   * Yozuvni "eskirgan" holatga keltiradi.
   *
   * ── Vaqt zonasi haqida ────────────────────────────────────────────────
   * Bu yerda `now()` kabi SQL funksiyalari ATAYLAB ishlatilmaydi.
   * Postgres nusxasi `Asia/Tashkent` da ishlashi mumkin, `updatedAt`
   * ustuni esa `timestamp without time zone` va Prisma unga UTC yozadi.
   * `now()` bilan yozilgan qiymat o'sha holatda Prisma uchun besh soat
   * KELAJAKDA bo'lib ko'rinadi va tiklanish umuman ishga tushmaydi —
   * ya'ni sinov yolg'on qizil bo'lardi.
   *
   * Qiymat JS `Date` sifatida Prisma orqali beriladi: yozish ham,
   * o'qish ham bitta qatlamdan o'tadi, ya'ni vaqt zonasi tenglamadan
   * butunlay chiqib ketadi.
   */
  async function makeStale(id: string): Promise<void> {
    const staleAt = new Date(Date.now() - STALE_AFTER_MS - 60_000);
    const { count } = await prisma.presentation.updateMany({
      where: { id },
      data: { status: "PENDING", errorMessage: null, updatedAt: staleAt },
    });
    assert.equal(count, 1, "yozuvni eskirgan holatga keltirib bo'lmadi");

    const check = await prisma.presentation.findUniqueOrThrow({
      where: { id },
      select: { updatedAt: true },
    });
    assert.ok(
      Date.now() - check.updatedAt.getTime() > STALE_AFTER_MS,
      "yozuv eskirgan deb hisoblanmadi — vaqt zonasi siljishi bo'lishi mumkin",
    );
  }

  it("egasi yozuvni ochganda FAILED bo'ladi", async () => {
    const { client } = await signedUp("smoke-eskirgan-oqish");
    const { id } = await readyPresentation(client, "Smoke: eskirgan yozuv (o'qish)");

    await makeStale(id);

    const result = await client.request<{
      presentation: { status: string; errorMessage: string | null };
    }>(`/api/presentations/${id}`);

    assert.equal(result.status, 200);
    assert.equal(result.data!.presentation.status, "FAILED");
    assert.equal(
      result.data!.presentation.errorMessage,
      "errors.domain.generationTimedOut",
      "xato kaliti kutilganidan boshqa",
    );
  });

  it("egasi QAYTMASA ham, server qayta ishga tushganda FAILED bo'ladi", async () => {
    /*
      Bu — deploy paytidagi haqiqiy holat: o'qituvchi reja so'radi va
      telefonni yopdi, o'sha payt server qayta ishga tushdi va fon ishi
      uzildi. Yozuvni faqat `instrumentation.ts` dagi `register()`
      tiklaydi, u esa FAQAT yangi server jarayonida bajariladi.

      Asosiy nishonga tegilmaydi: o'sha bazaga ulanadigan qisqa umrli
      ikkinchi nusxa ko'tariladi va shu yetarli.
    */
    const { client } = await signedUp("smoke-eskirgan-restart");
    const { id } = await readyPresentation(client, "Smoke: eskirgan yozuv (restart)");

    await makeStale(id);

    await withRestartedInstance(async () => {
      const record = await prisma.presentation.findUniqueOrThrow({
        where: { id },
        select: { status: true, errorMessage: true },
      });

      assert.equal(record.status, "FAILED", "ishga tushishdagi tiklanish ishlamadi");
      assert.equal(record.errorMessage, "errors.domain.generationTimedOut");
    });
  });

  it("HALI ishlayotgan generatsiya tiklanish tomonidan o'ldirilmaydi", async () => {
    /*
      Tiklanish haddan tashqari ochko'z bo'lsa, u ishlayotgan
      generatsiyani ham FAILED qilib qo'yardi — bu esa nuqsonni
      tuzatish o'rniga yangisini yaratish bo'lardi.
    */
    const { client } = await signedUp("smoke-yangi-pending");

    const created = await client.request<{ presentation: { id: string } }>(
      "/api/presentations",
      {
        method: "POST",
        // Soxta AI bu belgida javobni ataylab kechiktiradi (`MARKER_SLOW`).
        body: {
          mode: "standalone",
          topic: "SEKIN-SINOV yangi generatsiya",
          language: "UZ",
          template: "klassik",
        },
      },
    );
    assert.equal(created.status, 202);
    const id = created.data!.presentation.id;

    await withRestartedInstance(async () => {
      const record = await prisma.presentation.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      assert.notEqual(
        record.status,
        "FAILED",
        "yangi PENDING yozuv noo'rin FAILED qilindi",
      );
    });
  });
});
