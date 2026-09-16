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
