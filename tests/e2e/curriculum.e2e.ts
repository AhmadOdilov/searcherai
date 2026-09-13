import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  TestClient,
  cleanupTestUsers,
  findAiPrompt,
  testEmail,
  waitForGeneration,
} from "./helpers/client";

/**
 * O'quv dasturi integratsiyasi — uchidan-uchgacha.
 *
 * ── Nima tekshiriladi ─────────────────────────────────────────────────────
 * Ikki yo'nalish, ikkalasi ham teng muhim:
 *  1. Dastur TOPILGANDA — rasmiy ma'lumot AI promptiga qo'shiladi;
 *  2. Dastur TOPILMAGANDA — oqim o'zgarishsiz ishlaydi.
 *
 * Ikkinchisi birinchisidan muhimroq: yangi funksiya mavjud ishlayotgan
 * oqimni buzsa, hali qo'shilmagan fanlar (ya'ni ko'pchilik) butunlay
 * ishlamay qolardi.
 */

const PASSWORD = "juda-maxfiy-parol";

/** Sinov ma'lumoti — haqiqiy pilotdan mustaqil bo'lishi uchun o'z fani. */
const TEST_SUBJECT = "E2E-Sinov-Fani";
const TEST_GRADE = "7-sinf";
const TEST_TOPIC_NAME = "KASRLAR BILAN AMALLAR";
const TEST_HOURS = 29;
const TEST_OUTCOME = "kasrlarni umumiy maxrajga keltira oladi";

async function signedInClient(suffix: string): Promise<TestClient> {
  const client = new TestClient();
  const result = await client.request("/api/auth/register", {
    method: "POST",
    body: {
      email: testEmail(suffix),
      password: PASSWORD,
      fullName: "Sinov O'qituvchi",
    },
  });
  assert.equal(result.status, 201);
  return client;
}

before(async () => {
  await cleanupTestUsers();

  const { prisma } = await import("../../lib/db");
  await prisma.curriculumTopic.deleteMany({ where: { subject: TEST_SUBJECT } });
  await prisma.curriculumTopic.create({
    data: {
      subject: TEST_SUBJECT,
      grade: TEST_GRADE,
      topicName: TEST_TOPIC_NAME,
      description: "Kasr tushunchasi. Umumiy maxraj. Qo'shish va ayirish.",
      expectedHours: TEST_HOURS,
      expectedOutcomes: [TEST_OUTCOME],
      source: "sinov",
    },
  });
});

after(async () => {
  const { prisma } = await import("../../lib/db");
  await prisma.curriculumTopic.deleteMany({ where: { subject: TEST_SUBJECT } });
  await cleanupTestUsers();
});

describe("o'quv dasturi — dars ishlanmasi", () => {
  it("dastur TOPILGANDA rasmiy ma'lumot promptga qo'shiladi", async () => {
    const client = await signedInClient("dastur-lp-bor");

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: TEST_SUBJECT,
          grade: TEST_GRADE,
          // Mavzu dasturdagi nom bilan TO'LIQ mos emas — qisman moslik
          // ishlashi kerak.
          topic: "Kasrlarni qo'shish",
          durationMinutes: 45,
          lessonType: "NEW_TOPIC",
          language: "UZ",
        },
      },
    );
    assert.equal(created.status, 202);

    await waitForGeneration(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );

    const prompt = await findAiPrompt("Kasrlarni qo'shish");

    assert.ok(prompt.user.includes(TEST_TOPIC_NAME), "dastur bo'limi promptga tushmagan");
    assert.ok(prompt.user.includes(String(TEST_HOURS)), "soat promptga tushmagan");
    assert.ok(
      prompt.user.includes(TEST_OUTCOME),
      "kutilayotgan natija promptga tushmagan",
    );
    assert.match(prompt.user, /RASMIY O['‘’]QUV DASTURI/);
  });

  it("dastur TOPILMAGANDA oqim o'zgarishsiz ishlaydi", async () => {
    const client = await signedInClient("dastur-lp-yoq");

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: "Dasturda-Yoq-Fan",
          grade: "11-sinf",
          topic: "Dasturda yo'q mavzu",
          durationMinutes: 45,
          lessonType: "NEW_TOPIC",
          language: "UZ",
        },
      },
    );
    assert.equal(created.status, 202, "dastursiz ham yaratilishi kerak");

    const plan = await waitForGeneration<{ status: string }>(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );
    assert.equal(plan.status, "READY", "dastursiz generatsiya yiqilgan");

    const prompt = await findAiPrompt("Dasturda yo'q mavzu");
    assert.ok(
      !prompt.user.includes("RASMIY O'QUV DASTURI"),
      "dastur topilmaganda ham bo'lim qo'shilgan",
    );
  });

  it("BOSHQA sinfning dasturi olinmaydi", async () => {
    /*
      Fan bir xil, lekin sinf boshqa. 7-sinf mavzusini 5-sinf darsiga
      qo'shish natijani yaxshilamaydi — buzadi.
    */
    const client = await signedInClient("dastur-lp-sinf");

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: TEST_SUBJECT,
          grade: "5-sinf",
          topic: "Boshqa sinf uchun kasrlar",
          durationMinutes: 45,
          lessonType: "NEW_TOPIC",
          language: "UZ",
        },
      },
    );

    await waitForGeneration(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );

    const prompt = await findAiPrompt("Boshqa sinf uchun kasrlar");
    assert.ok(
      !prompt.user.includes(TEST_TOPIC_NAME),
      "boshqa sinfning dastur bo'limi qo'shilib qolgan",
    );
  });
});

describe("o'quv dasturi — kalendar reja", () => {
  it("dastur TOPILGANDA bo'limlar ro'yxati promptga qo'shiladi", async () => {
    const client = await signedInClient("dastur-kr-bor");

    const created = await client.request<{ calendarPlan: { id: string } }>(
      "/api/calendar-plans",
      {
        method: "POST",
        body: {
          subject: TEST_SUBJECT,
          grade: TEST_GRADE,
          period: "Dasturli chorak",
          startDate: "2026-09-01",
          weeks: 3,
          hoursPerWeek: 2,
          language: "UZ",
        },
      },
    );
    assert.equal(created.status, 202);

    await waitForGeneration(
      client,
      `/api/calendar-plans/${created.data!.calendarPlan.id}`,
      "calendarPlan",
    );

    const prompt = await findAiPrompt("Dasturli chorak");
    assert.ok(prompt.user.includes(TEST_TOPIC_NAME), "dastur bo'limi promptga tushmagan");
    assert.match(prompt.user, /RASMIY O['‘’]QUV DASTURI/);
  });

  it("dastur TOPILMAGANDA oqim o'zgarishsiz ishlaydi", async () => {
    const client = await signedInClient("dastur-kr-yoq");

    const created = await client.request<{ calendarPlan: { id: string } }>(
      "/api/calendar-plans",
      {
        method: "POST",
        body: {
          subject: "Dasturda-Yoq-Fan",
          grade: "11-sinf",
          period: "Dastursiz chorak",
          startDate: "2026-09-01",
          weeks: 3,
          hoursPerWeek: 2,
          language: "UZ",
        },
      },
    );
    assert.equal(created.status, 202);

    const plan = await waitForGeneration<{ status: string }>(
      client,
      `/api/calendar-plans/${created.data!.calendarPlan.id}`,
      "calendarPlan",
    );
    assert.equal(plan.status, "READY", "dastursiz generatsiya yiqilgan");

    const prompt = await findAiPrompt("Dastursiz chorak");
    assert.ok(!prompt.user.includes("RASMIY O'QUV DASTURI"));
  });
});
