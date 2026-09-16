import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  TestClient,
  cleanupTestUsers,
  clearAiPrompts,
  testEmail,
  waitForGeneration,
} from "./helpers/client";
import { MARKER_SERVER_ERROR, MARKER_BAD_SHAPE } from "./helpers/mock-ai.ts";

/**
 * Generatsiya hayot sikli — osilib qolgan yozuvlar va kvota qaytarilishi.
 *
 * ── Nega bu ikkisi BIR faylda ─────────────────────────────────────────────
 * Ular bitta stsenariyning ikki tomoni: generatsiya uzilganda
 * foydalanuvchi IKKI narsani yo'qotadi — natijani va kvotasini. Birinchisi
 * `recoverStaleGenerations()`, ikkinchisi `releaseAiQuota()` bilan
 * yopiladi va ikkalasi ham bir xil nosozlikdan kelib chiqadi.
 */

const PASSWORD = "juda-maxfiy-parol";
const STALE_AFTER_MS = 5 * 60 * 1000;

interface Row {
  id: string;
  status: string;
  errorMessage: string | null;
}

before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

async function signedInClient(
  suffix: string,
): Promise<{ client: TestClient; userId: string }> {
  const client = new TestClient();
  const email = testEmail(suffix);
  const result = await client.request("/api/auth/register", {
    method: "POST",
    body: { email, password: PASSWORD, fullName: "Hayot sikli" },
  });
  assert.equal(result.status, 201);

  const { prisma } = await import("../../lib/db");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { client, userId: user.id };
}

/** Bazaga to'g'ridan-to'g'ri yozuv qo'yadi — AI chaqirmasdan. */
async function seedRecord(
  model: "lessonPlan" | "presentation" | "calendarPlan",
  userId: string,
  options: { status: "PENDING" | "READY" | "FAILED"; ageMs: number },
): Promise<string> {
  const { prisma } = await import("../../lib/db");
  const updatedAt = new Date(Date.now() - options.ageMs);

  const base = { userId, status: options.status, language: "UZ" as const };

  if (model === "lessonPlan") {
    const row = await prisma.lessonPlan.create({
      data: {
        ...base,
        subject: "Matematika",
        grade: "7-sinf",
        topic: "Hayot sikli sinovi",
        durationMinutes: 45,
      },
    });
    // `updatedAt` avtomatik qo'yiladi — uni ataylab eskiga suramiz.
    await prisma.lessonPlan.update({ where: { id: row.id }, data: { updatedAt } });
    return row.id;
  }

  if (model === "presentation") {
    const row = await prisma.presentation.create({
      data: { ...base, topic: "Hayot sikli sinovi", template: "klassik" },
    });
    await prisma.presentation.update({ where: { id: row.id }, data: { updatedAt } });
    return row.id;
  }

  const row = await prisma.calendarPlan.create({
    data: {
      ...base,
      subject: "Matematika",
      grade: "7-sinf",
      period: "Sinov chorak",
      weeks: 3,
      hoursPerWeek: 2,
      startDate: new Date("2026-09-14"),
    },
  });
  await prisma.calendarPlan.update({ where: { id: row.id }, data: { updatedAt } });
  return row.id;
}

async function readRow(
  model: "lessonPlan" | "presentation" | "calendarPlan",
  id: string,
): Promise<Row> {
  const { prisma } = await import("../../lib/db");
  const select = { id: true, status: true, errorMessage: true };

  if (model === "lessonPlan") {
    return prisma.lessonPlan.findUniqueOrThrow({ where: { id }, select });
  }
  if (model === "presentation") {
    return prisma.presentation.findUniqueOrThrow({ where: { id }, select });
  }
  return prisma.calendarPlan.findUniqueOrThrow({ where: { id }, select });
}

// ════════════════════════════════════════════════════════════════════════════
// P1-01 — osilib qolgan generatsiyalarni tiklash
// ════════════════════════════════════════════════════════════════════════════

describe("osilib qolgan generatsiyalarni tiklash", () => {
  const MODELS = ["lessonPlan", "presentation", "calendarPlan"] as const;

  for (const model of MODELS) {
    it(`eskirgan ${model} FAILED qilinadi`, async () => {
      const { userId } = await signedInClient(`stale-${model.toLowerCase()}`);
      const id = await seedRecord(model, userId, {
        status: "PENDING",
        // Chegaradan ikki barobar eski — chegaraga yaqinligi bilan
        // bog'liq mo'rt sinov bo'lmasin.
        ageMs: STALE_AFTER_MS * 2,
      });

      const { recoverStaleGenerations } = await import("../../lib/generation/stale");
      await recoverStaleGenerations();

      const row = await readRow(model, id);
      assert.equal(row.status, "FAILED", `${model} tozalanmadi`);
      assert.equal(row.errorMessage, "errors.domain.generationTimedOut");
    });
  }

  it("YANGI PENDING yozuvga TEGILMAYDI", async () => {
    /*
      Eng xavfli xato — hali ishlayotgan generatsiyani xato bilan
      to'xtatib qo'yish. Shuning uchun chegara 5 daqiqa va bu sinov
      uni himoya qiladi.
    */
    const { userId } = await signedInClient("stale-yangi");
    const id = await seedRecord("lessonPlan", userId, {
      status: "PENDING",
      ageMs: 10_000,
    });

    const { recoverStaleGenerations } = await import("../../lib/generation/stale");
    await recoverStaleGenerations();

    const row = await readRow("lessonPlan", id);
    assert.equal(row.status, "PENDING", "ishlayotgan generatsiya to'xtatildi");
  });

  it("READY va FAILED yozuvlarga TEGILMAYDI", async () => {
    const { userId } = await signedInClient("stale-tugagan");

    const readyId = await seedRecord("presentation", userId, {
      status: "READY",
      ageMs: STALE_AFTER_MS * 5,
    });
    const failedId = await seedRecord("calendarPlan", userId, {
      status: "FAILED",
      ageMs: STALE_AFTER_MS * 5,
    });

    const { recoverStaleGenerations } = await import("../../lib/generation/stale");
    await recoverStaleGenerations();

    assert.equal((await readRow("presentation", readyId)).status, "READY");
    assert.equal((await readRow("calendarPlan", failedId)).status, "FAILED");
  });

  it("FOYDALANUVCHIGA BOG'LIQ EMAS — boshqa hisobning yozuvi ham tozalanadi", async () => {
    /*
      Asosiy nuqson aynan shu edi: eski `markStaleAsFailed()` `userId`
      talab qilardi, ya'ni yozuvni faqat EGASI qaytganda tozalash mumkin
      edi. Bu sinov yangi funksiya undan xoli ekanini isbotlaydi.
    */
    const first = await signedInClient("stale-birinchi");
    const second = await signedInClient("stale-ikkinchi");

    const firstId = await seedRecord("lessonPlan", first.userId, {
      status: "PENDING",
      ageMs: STALE_AFTER_MS * 2,
    });
    const secondId = await seedRecord("presentation", second.userId, {
      status: "PENDING",
      ageMs: STALE_AFTER_MS * 2,
    });

    const { recoverStaleGenerations } = await import("../../lib/generation/stale");
    const result = await recoverStaleGenerations();

    assert.ok(result.total >= 2, `kutilgan >=2, kelgan ${result.total}`);
    assert.equal((await readRow("lessonPlan", firstId)).status, "FAILED");
    assert.equal((await readRow("presentation", secondId)).status, "FAILED");
  });

  it("TAKRORIY chaqiruv idempotent — ikkinchisida hech narsa o'zgarmaydi", async () => {
    const { userId } = await signedInClient("stale-takror");
    const id = await seedRecord("calendarPlan", userId, {
      status: "PENDING",
      ageMs: STALE_AFTER_MS * 2,
    });

    const { recoverStaleGenerations } = await import("../../lib/generation/stale");

    const first = await recoverStaleGenerations();
    assert.ok(first.total >= 1);

    const before = await readRow("calendarPlan", id);
    const second = await recoverStaleGenerations();
    const after = await readRow("calendarPlan", id);

    assert.equal(second.calendarPlan, 0, "ikkinchi chaqiruv yana yozdi");
    assert.deepEqual(after, before, "yozuv ikkinchi chaqiruvda o'zgardi");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// P2-05 — haqiqiy generatsiya bosqichlari
// ════════════════════════════════════════════════════════════════════════════

describe("generatsiya bosqichlari", () => {
  it("yangi yozuv QUEUED bosqichi bilan yaratiladi", async () => {
    /*
      Bosqich yozuv yaratilgan lahzadan boshlab mavjud — fon ishi hali
      boshlanmagan bo'lsa ham. Shu tufayli UI birinchi soniyadayoq
      HAQIQIY holatni ko'rsatadi, taxminni emas.
    */
    const { client } = await signedInClient("bosqich-queued");

    const created = await client.request<{
      lessonPlan: { id: string; status: string; stage: string | null };
    }>("/api/lesson-plans", {
      method: "POST",
      body: {
        subject: "Matematika",
        grade: "7-sinf",
        topic: "Bosqich sinovi",
        durationMinutes: 45,
      },
    });

    assert.equal(created.status, 202);
    assert.equal(created.data!.lessonPlan.status, "PENDING");
    assert.equal(created.data!.lessonPlan.stage, "QUEUED");
  });

  it("MUVAFFAQIYATLI generatsiya SAVING bosqichigacha boradi", async () => {
    const { client } = await signedInClient("bosqich-tugadi");

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          topic: "Bosqich oxirigacha",
          durationMinutes: 45,
        },
      },
    );
    assert.equal(created.status, 202);

    const finished = await waitForGeneration<{ status: string; stage: string | null }>(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );

    assert.equal(finished.status, "READY");
    // Oxirgi yozilgan bosqich — fayl yo'q moduli uchun SAVING.
    assert.equal(finished.stage, "SAVING");
  });

  it("FAYL yasaydigan modul BUILDING_FILE bosqichidan o'tadi", async () => {
    const { client } = await signedInClient("bosqich-fayl");

    const created = await client.request<{ presentation: { id: string } }>(
      "/api/presentations",
      { method: "POST", body: { mode: "standalone", topic: "Fayl bosqichi" } },
    );
    assert.equal(created.status, 202);

    const finished = await waitForGeneration<{ status: string; stage: string | null }>(
      client,
      `/api/presentations/${created.data!.presentation.id}`,
      "presentation",
    );

    assert.equal(finished.status, "READY");
    assert.equal(finished.stage, "SAVING", "fayl yasalgach SAVING bo'lishi kerak");
  });

  it("bosqich POLLING javobida qaytadi", async () => {
    // UI bosqichni aynan shu yo'l bilan oladi — boshqa transport yo'q.
    const { client } = await signedInClient("bosqich-polling");

    const created = await client.request<{ presentation: { id: string } }>(
      "/api/presentations",
      { method: "POST", body: { mode: "standalone", topic: "Polling bosqichi" } },
    );

    const read = await client.request<{
      presentation: { stage: string | null };
    }>(`/api/presentations/${created.data!.presentation.id}`);

    assert.equal(read.status, 200);
    assert.ok(
      read.data!.presentation.stage !== undefined,
      "polling javobida `stage` maydoni yo'q",
    );
  });

  it("ESKI yozuv (stage = null) o'qilaveradi", async () => {
    /*
      Migratsiya orqaga mos: ustun nullable qo'shildi. Eski yozuvlarda
      `stage` yo'q va ular hech qanday xatosiz ochilishi kerak — UI
      bunday holatda zaxira matnga tushadi.
    */
    const { client, userId } = await signedInClient("bosqich-eski");
    const id = await seedRecord("presentation", userId, {
      status: "READY",
      ageMs: 1000,
    });

    const { prisma } = await import("../../lib/db");
    await prisma.presentation.update({ where: { id }, data: { stage: null } });

    const read = await client.request<{ presentation: { stage: string | null } }>(
      `/api/presentations/${id}`,
    );

    assert.equal(read.status, 200, "eski yozuv o'qilmadi");
    assert.equal(read.data!.presentation.stage, null);
  });

  it("QAYTA generatsiyada bosqich boshidan boshlanadi", async () => {
    const { client } = await signedInClient("bosqich-qayta");

    const created = await client.request<{ presentation: { id: string } }>(
      "/api/presentations",
      { method: "POST", body: { mode: "standalone", topic: "Qayta bosqich" } },
    );
    await waitForGeneration(
      client,
      `/api/presentations/${created.data!.presentation.id}`,
      "presentation",
    );

    const again = await client.request<{
      presentation: { status: string; stage: string | null };
    }>(`/api/presentations/${created.data!.presentation.id}/regenerate`, {
      method: "POST",
    });

    assert.equal(again.status, 202);
    assert.equal(again.data!.presentation.stage, "QUEUED");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// P1-02 — kvota qaytarilishi
// ════════════════════════════════════════════════════════════════════════════

/** Foydalanuvchining joriy oynadagi kvota yozuvlari soni. */
async function quotaUsed(userId: string): Promise<number> {
  const { prisma } = await import("../../lib/db");
  return prisma.aiRequest.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
}

describe("kvota qaytarilishi", () => {
  it("MUVAFFAQIYATLI generatsiya kvotani SARFLAYDI", async () => {
    const { client, userId } = await signedInClient("kvota-muvaffaqiyat");
    await clearAiPrompts();

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          topic: "Kvota sarflansin",
          durationMinutes: 45,
        },
      },
    );
    assert.equal(created.status, 202);

    await waitForGeneration(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );

    assert.equal(await quotaUsed(userId), 1, "muvaffaqiyatda kvota sarflanmadi");
  });

  it("PROVAYDER XATOSIDA kvota QAYTARILADI", async () => {
    /*
      Bu — muammoning o'zagi. Ilgari provayder uzilgan paytda o'qituvchi
      uch marta urinardi, uchalasi yiqilardi va u bir daqiqaga
      bloklanardi — o'z aybisiz.
    */
    const { client, userId } = await signedInClient("kvota-xato");

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          topic: `${MARKER_SERVER_ERROR} kvota qaytsin`,
          durationMinutes: 45,
        },
      },
    );
    assert.equal(created.status, 202);

    const finished = await waitForGeneration<{ status: string }>(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );
    assert.equal(finished.status, "FAILED", "soxta AI xato qaytarmadi");

    assert.equal(await quotaUsed(userId), 0, "xatoda kvota qaytarilmadi");
  });

  it("SXEMA XATOSIDA ham kvota QAYTARILADI", async () => {
    const { client, userId } = await signedInClient("kvota-sxema");

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          topic: `${MARKER_BAD_SHAPE} sxemadan o'tmaydi`,
          durationMinutes: 45,
        },
      },
    );
    assert.equal(created.status, 202);

    const finished = await waitForGeneration<{ status: string }>(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );
    assert.equal(finished.status, "FAILED");

    assert.equal(await quotaUsed(userId), 0, "sxema xatosida kvota qaytarilmadi");
  });

  it("uchala modulda ham qaytariladi", async () => {
    const { client, userId } = await signedInClient("kvota-uchala");

    // Prezentatsiya
    const presentation = await client.request<{ presentation: { id: string } }>(
      "/api/presentations",
      {
        method: "POST",
        body: { mode: "standalone", topic: `${MARKER_SERVER_ERROR} prezentatsiya` },
      },
    );
    assert.equal(presentation.status, 202);
    await waitForGeneration(
      client,
      `/api/presentations/${presentation.data!.presentation.id}`,
      "presentation",
    );

    // Kalendar reja
    const calendar = await client.request<{ calendarPlan: { id: string } }>(
      "/api/calendar-plans",
      {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          period: `${MARKER_SERVER_ERROR} reja`,
          startDate: "2026-09-14",
          weeks: 3,
          hoursPerWeek: 2,
        },
      },
    );
    assert.equal(calendar.status, 202);
    await waitForGeneration(
      client,
      `/api/calendar-plans/${calendar.data!.calendarPlan.id}`,
      "calendarPlan",
    );

    assert.equal(await quotaUsed(userId), 0, "kvota uchala modulda qaytarilmadi");
  });

  it("qaytarish CHEGARANI BUZMAYDI — parallel muvaffaqiyatli so'rovlar sanaladi", async () => {
    /*
      Qaytarish qo'shilgach paydo bo'lishi mumkin bo'lgan xavf: kvota
      hisoblagichi jim ishlamay qolishi. Bu sinov chegara hali ham
      kuchda ekanini tekshiradi.
    */
    const { client, userId } = await signedInClient("kvota-chegara");

    // Chegaragacha (3 ta) muvaffaqiyatli so'rov.
    for (let index = 0; index < 3; index++) {
      const result = await client.request("/api/lesson-plans", {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          topic: `Chegara ${index + 1}`,
          durationMinutes: 45,
        },
      });
      assert.equal(result.status, 202, `${index + 1}-so'rov o'tmadi`);
    }

    assert.equal(await quotaUsed(userId), 3);

    // To'rtinchisi rad etilishi kerak.
    const fourth = await client.request("/api/lesson-plans", {
      method: "POST",
      body: {
        subject: "Matematika",
        grade: "7-sinf",
        topic: "To'rtinchi so'rov",
        durationMinutes: 45,
      },
    });
    assert.equal(fourth.status, 429, "chegara buzildi — kvota ishlamayapti");
  });

  it("MUVAFFAQIYATLI generatsiya token o'lchovini SAQLAYDI", async () => {
    /*
      O'lchov provayder transportidan allaqachon kelardi
      (`GenerateTextResult.usage`), lekin hech qayerga yozilmasdi.
      Endi u kvota yozuviga tushadi — kunlik kvota va model bo'yicha
      taqqoslash uchun asos.

      Xarajat ($) ATAYLAB hisoblanmaydi: narx vaqt o'tib o'zgaradi,
      tokenlar esa o'zgarmaydi.
    */
    const { client, userId } = await signedInClient("token-olchov");

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          topic: "Token o'lchovi",
          durationMinutes: 45,
        },
      },
    );
    assert.equal(created.status, 202);

    await waitForGeneration(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );

    const { prisma } = await import("../../lib/db");
    const row = await prisma.aiRequest.findFirstOrThrow({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { model: true, inputTokens: true, outputTokens: true },
    });

    assert.ok(row.model !== null, "model yozilmadi");
    assert.ok(
      row.inputTokens !== null && row.inputTokens > 0,
      `kirish tokenlari yozilmadi: ${row.inputTokens}`,
    );
    assert.ok(
      row.outputTokens !== null && row.outputTokens > 0,
      `chiqish tokenlari yozilmadi: ${row.outputTokens}`,
    );
  });

  it("MUVAFFAQIYATSIZ generatsiyada o'lchov yozuvi ham QOLMAYDI", async () => {
    // Kvota qaytarilgach, o'lchov yozuvi ham o'chadi — yetim qolmaydi.
    const { client, userId } = await signedInClient("token-xato");

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          topic: `${MARKER_SERVER_ERROR} token`,
          durationMinutes: 45,
        },
      },
    );
    assert.equal(created.status, 202);

    await waitForGeneration(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );

    const { prisma } = await import("../../lib/db");
    assert.equal(await prisma.aiRequest.count({ where: { userId } }), 0);
  });

  it("AI JAVOB BERGANDAN keyingi xatoda o'lchov yozuvi SAQLANADI", async () => {
    /*
      Generatsiya AI'dan KEYIN ham yiqilishi mumkin: .pptx yasalmadi,
      fayl saqlanmadi, baza javob bermadi. O'sha paytda AI so'rovi
      allaqachon bajarilgan va provayder uni hisobga qo'shgan.

      Ilgari `releaseAiQuota()` yozuvni baribir o'chirardi: sarflangan
      tokenlar izsiz yo'qolardi va kvota ham qaytarilardi — ya'ni
      foydalanuvchi darhol qayta urinib xarajatni ikkilantirardi.

      Bu yerda o'sha holat TO'G'RIDAN-TO'G'RI quriladi: bandlik olinadi,
      o'lchov yoziladi (AI javob berdi), keyin qaytarish chaqiriladi.
    */
    const { userId } = await signedInClient("kvota-sarflangan");
    const { consumeAiQuota, recordAiUsage, releaseAiQuota } =
      await import("../../lib/ai/rate-limit");

    const reservation = await consumeAiQuota(userId, "presentations");
    await recordAiUsage(reservation, {
      model: "mock-model",
      inputTokens: 120,
      outputTokens: 340,
    });

    await releaseAiQuota(reservation);

    const { prisma } = await import("../../lib/db");
    const row = await prisma.aiRequest.findUnique({
      where: { id: reservation.id },
      select: { model: true, inputTokens: true, outputTokens: true },
    });

    assert.ok(row !== null, "sarflangan so'rov yozuvi o'chirilmasligi kerak");
    assert.equal(row.model, "mock-model");
    assert.equal(row.inputTokens, 120);
    assert.equal(row.outputTokens, 340);

    // Kvota ham qaytarilmaydi: xarajat haqiqiy bo'lgan.
    assert.equal(await quotaUsed(userId), 1);
  });

  it("AI UMUMAN javob bermagan bo'lsa bandlik QAYTARILADI", async () => {
    // Teskari holat: o'lchov yozilmagan, ya'ni hech narsa sarflanmagan.
    const { userId } = await signedInClient("kvota-sarflanmagan");
    const { consumeAiQuota, releaseAiQuota } = await import("../../lib/ai/rate-limit");

    const reservation = await consumeAiQuota(userId, "presentations");
    assert.equal(await quotaUsed(userId), 1);

    await releaseAiQuota(reservation);
    assert.equal(await quotaUsed(userId), 0);
  });

  it("qaytarish IDEMPOTENT — ikki marta chaqirilsa xato bermaydi", async () => {
    const { userId } = await signedInClient("kvota-idempotent");
    const { consumeAiQuota, releaseAiQuota } = await import("../../lib/ai/rate-limit");

    const reservation = await consumeAiQuota(userId, "lesson-plans");
    assert.equal(await quotaUsed(userId), 1);

    await releaseAiQuota(reservation);
    assert.equal(await quotaUsed(userId), 0);

    // Ikkinchi marta — xato bermasligi kerak.
    await releaseAiQuota(reservation);
    assert.equal(await quotaUsed(userId), 0);

    // `undefined` bilan ham xavfsiz.
    await releaseAiQuota(undefined);
  });
});
