import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  BASE_URL,
  TestClient,
  cleanupTestUsers,
  findAiPrompt,
  testEmail,
  waitForGeneration,
} from "./helpers/client";
import { MARKER_BAD_SHAPE, MARKER_SERVER_ERROR } from "./helpers/mock-ai.ts";

/**
 * Kalendar reja moduli — uchidan-uchgacha.
 *
 * AI soxta server bilan almashtirilgan, qolgan hamma narsa haqiqiy:
 * HTTP, sessiya, baza, zod, exceljs va fayl tizimi.
 */

const PASSWORD = "juda-maxfiy-parol";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface CalendarPlanPayload {
  calendarPlan: {
    id: string;
    subject: string;
    grade: string;
    period: string;
    weeks: number;
    hoursPerWeek: number;
    startDate: string;
    language: string;
    title: string | null;
    status: "PENDING" | "READY" | "FAILED";
    errorMessage: string | null;
    filePath: string | null;
    fileSize: number | null;
    rowCount: number | null;
    aiModel: string | null;
    aiDurationMs: number | null;
    content: {
      title: string;
      weeks: Array<{
        weekNumber: number;
        dateRange: string;
        topics: Array<{ name: string; hours: number; note?: string }>;
      }>;
    } | null;
  };
}

interface ListPayload {
  items: Array<{ id: string; period: string; status: string }>;
}

/** POST yuboradi, 202 ni tekshiradi va generatsiya tugashini kutadi. */
async function createAndWait(
  client: TestClient,
  body: Record<string, unknown>,
): Promise<CalendarPlanPayload["calendarPlan"]> {
  const created = await client.request<CalendarPlanPayload>("/api/calendar-plans", {
    method: "POST",
    body,
  });

  assert.equal(created.status, 202, "fon rejimida 202 qaytishi kerak");
  assert.equal(created.data!.calendarPlan.status, "PENDING");

  return waitForGeneration<CalendarPlanPayload["calendarPlan"]>(
    client,
    `/api/calendar-plans/${created.data!.calendarPlan.id}`,
    "calendarPlan",
  );
}

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

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    subject: "Matematika",
    grade: "7-sinf",
    period: "1-chorak",
    startDate: "2026-09-14",
    weeks: 9,
    hoursPerWeek: 2,
    language: "UZ",
    ...overrides,
  };
}

before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

describe("kalendar reja — generatsiya", () => {
  it("to'liq reja yaratadi va READY qiladi", async () => {
    const client = await signedInClient("cp-ok");

    const plan = await createAndWait(client, validInput());

    assert.equal(plan.status, "READY");
    assert.equal(plan.errorMessage, null);
    assert.equal(plan.subject, "Matematika");
    assert.equal(plan.weeks, 9);
    assert.equal(plan.hoursPerWeek, 2);

    // Kuzatuv maydonlari
    assert.equal(plan.aiModel, "mock-lesson-model");
    assert.ok(plan.aiDurationMs !== null && plan.aiDurationMs > 0);
    assert.ok(plan.title !== null, "AI sarlavhasi saqlanishi kerak");

    // Fayl
    assert.ok(plan.filePath !== null, "filePath to'ldirilishi kerak");
    assert.ok(plan.filePath!.endsWith(".xlsx"));
    assert.ok(
      plan.fileSize !== null && plan.fileSize > 3_000,
      `fayl hajmi mantiqiy bo'lsin (${plan.fileSize})`,
    );
    assert.equal(plan.rowCount, 9, "9 hafta × 1 mavzu = 9 qator");

    // Kontent
    const content = plan.content!;
    assert.equal(content.weeks.length, 9);
    assert.equal(content.weeks[0].weekNumber, 1);
    assert.ok(content.weeks[0].topics.length >= 1);
  });

  it("SANALAR promptdagi qiymatlar bilan bir xil bo'ladi", async () => {
    // Sanalar kodda hisoblanadi va AI ularni ko'chiradi. Bu bog'lanish
    // uzilsa, jadvalda noto'g'ri sanalar chiqadi.
    const client = await signedInClient("cp-sana");

    const plan = await createAndWait(
      client,
      validInput({ weeks: 3, startDate: "2026-09-14" }),
    );

    const weeks = plan.content!.weeks;
    assert.equal(weeks[0].dateRange, "14.09.2026 – 20.09.2026");
    assert.equal(weeks[1].dateRange, "21.09.2026 – 27.09.2026");
    assert.equal(weeks[2].dateRange, "28.09.2026 – 04.10.2026");
  });

  it("AI'ga yuborilgan promptda hafta sanalari bo'ladi", async () => {
    const client = await signedInClient("cp-prompt");

    await createAndWait(client, validInput({ period: "Sinov chorak PROMPT", weeks: 4 }));

    const { system, user } = await findAiPrompt("Sinov chorak PROMPT");

    // System prompt — kalendar reja uchun
    assert.ok(system.includes('"weekNumber"'), "kalendar sxemasi bo'lishi kerak");
    // Parametrlar
    assert.ok(user.includes("Matematika"));
    assert.ok(user.includes("Jami soat: 8"), "4 × 2 = 8 soat");
    // Tayyor sanalar
    assert.match(user, /1\. 14\.09\.2026 – 20\.09\.2026/);
    assert.match(user, /4\. 05\.10\.2026 – 11\.10\.2026/);
  });

  it("eng uzun ruxsat etilgan davr (24 hafta) uchun ishlaydi", async () => {
    // Bu eng og'ir holat — token chegarasi yetishi tekshiriladi.
    //
    // 24 — MAX_WEEKS. Undan uzun davr ATAYLAB rad etiladi: haqiqiy AI
    // bilan o'lchanganda model 24 haftadan uzun rejani ishonchli
    // generatsiya qila olmaydi.
    const client = await signedInClient("cp-uzun");

    const plan = await createAndWait(
      client,
      validInput({ period: "Yarim yil", weeks: 24, hoursPerWeek: 3 }),
    );

    assert.equal(plan.status, "READY");
    assert.equal(plan.content!.weeks.length, 24);
    assert.equal(plan.rowCount, 24);
  });

  it("chegaradan uzun davrni RAD ETADI (400)", async () => {
    const client = await signedInClient("cp-chegara");

    const result = await client.request("/api/calendar-plans", {
      method: "POST",
      body: validInput({ period: "O'quv yili", weeks: 34 }),
    });

    assert.equal(result.status, 400);
    assert.ok(result.error!.fieldErrors!.weeks, "weeks maydonida xato bo'lishi kerak");
  });

  it("uch tilda ham ishlaydi", async () => {
    const client = await signedInClient("cp-tillar");

    for (const language of ["UZ", "RU", "EN"]) {
      const plan = await createAndWait(
        client,
        validInput({ language, period: `Davr ${language}`, weeks: 3 }),
      );

      assert.equal(plan.language, language, `${language} uchun`);
      assert.equal(plan.status, "READY");
    }
  });

  it("noto'g'ri kirishni 400 bilan rad etadi", async () => {
    const client = await signedInClient("cp-validatsiya");

    const result = await client.request("/api/calendar-plans", {
      method: "POST",
      body: {
        subject: "M",
        grade: "",
        period: "",
        startDate: "sana emas",
        weeks: 100,
        hoursPerWeek: 0,
      },
    });

    assert.equal(result.status, 400);
    assert.equal(result.error!.code, "validation_error");
    const fields = result.error!.fieldErrors!;
    assert.ok(fields.subject);
    assert.ok(fields.grade);
    assert.ok(fields.period);
    assert.ok(fields.startDate);
    assert.ok(fields.weeks);
    assert.ok(fields.hoursPerWeek);
  });

  it("kirmagan foydalanuvchini 401 bilan rad etadi", async () => {
    const anonymous = new TestClient();
    const result = await anonymous.request("/api/calendar-plans", {
      method: "POST",
      body: validInput(),
    });
    assert.equal(result.status, 401);
  });
});

describe("kalendar reja — xato holatlari", () => {
  it("AI server xatosida FAILED qiladi", async () => {
    const client = await signedInClient("cp-xato-server");

    const plan = await createAndWait(
      client,
      validInput({ period: `Chorak ${MARKER_SERVER_ERROR}` }),
    );

    // Fon rejimida xato POST javobida kelmaydi — yozuvga yoziladi.
    assert.equal(plan.status, "FAILED");
    assert.ok(plan.errorMessage !== null);
    assert.ok(!plan.errorMessage!.includes("mock"));
    assert.ok(!plan.errorMessage!.includes("500"));
    assert.equal(plan.filePath, null);

    const list = await client.request<ListPayload>("/api/calendar-plans");
    assert.ok(list.data!.items.some((item) => item.status === "FAILED"));
  });

  it("AI sxemaga mos kelmaydigan javob bersa FAILED qiladi", async () => {
    const client = await signedInClient("cp-xato-sxema");

    const plan = await createAndWait(
      client,
      validInput({ period: `Chorak ${MARKER_BAD_SHAPE}` }),
    );

    assert.equal(plan.status, "FAILED");
    assert.ok(plan.errorMessage !== null);
  });
});

describe("kalendar reja — yuklab olish", () => {
  it("to'g'ri MIME turi va Content-Disposition bilan qaytaradi", async () => {
    const client = await signedInClient("cp-yuklash");

    const created = await createAndWait(client, validInput({ weeks: 3 }));
    const id = created.id;

    const response = await client.fetchRaw(`/api/calendar-plans/${id}/download`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), XLSX_MIME);

    const disposition = response.headers.get("content-disposition")!;
    assert.match(disposition, /^attachment;/);
    assert.match(disposition, /filename="/);
    assert.match(disposition, /filename\*=UTF-8''/);
    assert.match(disposition, /\.xlsx/);

    assert.match(response.headers.get("cache-control")!, /no-store/);

    // .xlsx ham ZIP — "PK" bilan boshlanadi.
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");
    assert.ok(buffer.length > 3_000, `fayl juda kichik: ${buffer.length}`);
    assert.equal(
      Number(response.headers.get("content-length")),
      buffer.length,
      "content-length mos kelishi kerak",
    );
  });

  it("BOSHQA foydalanuvchi faylni yuklab OLOLMAYDI", async () => {
    const owner = await signedInClient("cp-fayl-ega");
    const stranger = await signedInClient("cp-fayl-begona");

    const created = await createAndWait(
      owner,
      validInput({ period: "Maxfiy chorak", weeks: 2 }),
    );
    const id = created.id;

    const byOwner = await owner.fetchRaw(`/api/calendar-plans/${id}/download`);
    assert.equal(byOwner.status, 200);

    const byStranger = await stranger.fetchRaw(`/api/calendar-plans/${id}/download`);
    assert.equal(byStranger.status, 404);
    assert.ok(
      !byStranger.headers.get("content-type")?.includes("spreadsheetml"),
      "fayl berilmasligi kerak",
    );
  });

  it("kirmagan foydalanuvchi faylni ololmaydi", async () => {
    const owner = await signedInClient("cp-fayl-anonim");
    const created = await createAndWait(owner, validInput({ weeks: 2 }));

    const response = await fetch(
      `${BASE_URL}/api/calendar-plans/${created.id}/download`,
      { redirect: "manual" },
    );

    assert.equal(response.status, 401);
  });

  it("FAILED rejani yuklab bo'lmaydi", async () => {
    const client = await signedInClient("cp-fayl-failed");

    const failed = await createAndWait(
      client,
      validInput({ period: `Chorak ${MARKER_SERVER_ERROR}` }),
    );
    const failedId = failed.id;

    const response = await client.fetchRaw(`/api/calendar-plans/${failedId}/download`);
    assert.equal(response.status, 400);
  });
});

describe("kalendar reja — egalik tekshiruvi", () => {
  it("BOSHQA foydalanuvchi yozuvini o'qib bo'lmaydi (404)", async () => {
    const owner = await signedInClient("cp-ega");
    const stranger = await signedInClient("cp-begona");

    const created = await createAndWait(
      owner,
      validInput({ period: "Maxfiy davr", weeks: 2 }),
    );
    const id = created.id;

    assert.equal((await owner.request(`/api/calendar-plans/${id}`)).status, 200);

    const byStranger = await stranger.request(`/api/calendar-plans/${id}`);
    assert.equal(byStranger.status, 404, "403 emas, 404 bo'lishi kerak");
    assert.ok(!JSON.stringify(byStranger).includes("Maxfiy davr"));
  });

  it("BOSHQA foydalanuvchi o'chira olmaydi", async () => {
    const owner = await signedInClient("cp-ochirish-ega");
    const stranger = await signedInClient("cp-ochirish-begona");

    const created = await createAndWait(owner, validInput({ weeks: 2 }));
    const id = created.id;

    const attempt = await stranger.request(`/api/calendar-plans/${id}`, {
      method: "DELETE",
    });
    assert.equal(attempt.status, 404);

    assert.equal(
      (await owner.request(`/api/calendar-plans/${id}`)).status,
      200,
      "yozuv o'chirilmagan bo'lishi kerak",
    );
  });

  it("BOSHQA foydalanuvchi qayta generatsiya qila olmaydi", async () => {
    const owner = await signedInClient("cp-qayta-ega");
    const stranger = await signedInClient("cp-qayta-begona");

    const created = await createAndWait(owner, validInput({ weeks: 2 }));

    const attempt = await stranger.request(
      `/api/calendar-plans/${created.id}/regenerate`,
      { method: "POST" },
    );
    assert.equal(attempt.status, 404);
  });

  it("mavjud bo'lmagan id uchun 404", async () => {
    const client = await signedInClient("cp-yoq");
    const result = await client.request("/api/calendar-plans/umuman-mavjud-emas");
    assert.equal(result.status, 404);
  });
});

describe("kalendar reja — qayta generatsiya va o'chirish", () => {
  it("qayta generatsiya yangi yozuv YARATMAYDI", async () => {
    const client = await signedInClient("cp-qayta");

    const created = await createAndWait(client, validInput({ weeks: 3 }));
    const id = created.id;

    const accepted = await client.request<CalendarPlanPayload>(
      `/api/calendar-plans/${id}/regenerate`,
      { method: "POST" },
    );
    assert.equal(accepted.status, 202);

    const regenerated = await waitForGeneration<CalendarPlanPayload["calendarPlan"]>(
      client,
      `/api/calendar-plans/${id}`,
      "calendarPlan",
    );

    assert.equal(regenerated.id, id);
    assert.equal(regenerated.status, "READY");
    assert.ok(regenerated.filePath !== null);

    const list = await client.request<ListPayload>("/api/calendar-plans");
    assert.equal(list.data!.items.length, 1);
  });

  it("o'chirilgandan keyin fayl ham berilmaydi", async () => {
    const client = await signedInClient("cp-ochirish");

    const created = await createAndWait(client, validInput({ weeks: 2 }));
    const id = created.id;

    assert.equal(
      (await client.request(`/api/calendar-plans/${id}`, { method: "DELETE" })).status,
      200,
    );
    assert.equal((await client.request(`/api/calendar-plans/${id}`)).status, 404);
    assert.equal(
      (await client.fetchRaw(`/api/calendar-plans/${id}/download`)).status,
      404,
    );
  });
});

describe("kalendar reja — ro'yxat", () => {
  it("faqat O'Z yozuvlarini qaytaradi", async () => {
    const first = await signedInClient("cp-royxat-1");
    const second = await signedInClient("cp-royxat-2");

    await createAndWait(first, validInput({ period: "Birinchi davr", weeks: 2 }));
    await createAndWait(second, validInput({ period: "Ikkinchi davr", weeks: 2 }));

    const firstList = await first.request<ListPayload>("/api/calendar-plans");
    const secondList = await second.request<ListPayload>("/api/calendar-plans");

    assert.equal(firstList.data!.items.length, 1);
    assert.equal(firstList.data!.items[0].period, "Birinchi davr");
    assert.equal(secondList.data!.items.length, 1);
    assert.equal(secondList.data!.items[0].period, "Ikkinchi davr");
  });

  it("holat bo'yicha filtrlaydi", async () => {
    const client = await signedInClient("cp-filtr");

    await createAndWait(client, validInput({ period: "Muvaffaqiyatli", weeks: 2 }));
    await createAndWait(
      client,
      validInput({ period: `Yiqilgan ${MARKER_SERVER_ERROR}`, weeks: 2 }),
    );

    const ready = await client.request<ListPayload>("/api/calendar-plans?status=READY");
    assert.equal(ready.data!.items.length, 1);
    assert.equal(ready.data!.items[0].period, "Muvaffaqiyatli");

    const failed = await client.request<ListPayload>("/api/calendar-plans?status=FAILED");
    assert.equal(failed.data!.items.length, 1);
  });

  it("kirmagan foydalanuvchini 401 bilan rad etadi", async () => {
    const anonymous = new TestClient();
    assert.equal((await anonymous.request("/api/calendar-plans")).status, 401);
  });
});
