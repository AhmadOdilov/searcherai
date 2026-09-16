import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  TestClient,
  cleanupTestUsers,
  clearAiPrompts,
  readAiPrompts,
  testEmail,
  waitForGeneration,
} from "./helpers/client";

/**
 * Kalendar reja va dars ishlanmasini TAHRIRLASH — uchidan-uchgacha.
 *
 * Prezentatsiya tahriri `presentation-editing.e2e.ts` da. Bu yerda
 * qolgan ikki modul, chunki ular boshqa yo'l bilan fayl beradi:
 *  · kalendar reja — .xlsx saqlagichda, tahrirda QAYTA yasaladi;
 *  · dars ishlanmasi — .docx har so'rovda yasaladi, ya'ni mazmunni
 *    yangilash yetarli.
 *
 * Ikkalasida ham asosiy savol bir xil: tahrir AI'ni chaqirmaydimi va
 * natija HAQIQATAN yuklab olinadigan faylga tushadimi.
 */

const PASSWORD = "juda-maxfiy-parol";

interface CalendarPayload {
  calendarPlan: {
    id: string;
    title: string | null;
    status: "PENDING" | "READY" | "FAILED";
    rowCount: number | null;
    fileSize: number | null;
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

interface LessonPlanPayload {
  lessonPlan: {
    id: string;
    status: "PENDING" | "READY" | "FAILED";
    content: {
      objective: string;
      outcomes: string[];
      resources: string[];
      stages: Array<{
        name: string;
        durationMinutes: number;
        description: string;
        teacherActivity: string;
        studentActivity: string;
      }>;
      assessmentCriteria?: string[];
    } | null;
  };
}

after(async () => {
  await cleanupTestUsers();
});

async function signedInClient(suffix: string): Promise<TestClient> {
  const client = new TestClient();
  const result = await client.request("/api/auth/register", {
    method: "POST",
    body: { email: testEmail(suffix), password: PASSWORD, fullName: "Sinov O'qituvchi" },
  });
  assert.equal(result.status, 201);
  return client;
}

// ─── Kalendar reja ──────────────────────────────────────────────────────────

async function createCalendarPlan(
  client: TestClient,
): Promise<CalendarPayload["calendarPlan"]> {
  const created = await client.request<CalendarPayload>("/api/calendar-plans", {
    method: "POST",
    body: {
      subject: "Matematika",
      grade: "7-sinf",
      period: "1-chorak",
      startDate: "2026-09-14",
      weeks: 3,
      hoursPerWeek: 2,
    },
  });
  assert.equal(created.status, 202);

  const ready = await waitForGeneration<CalendarPayload["calendarPlan"]>(
    client,
    `/api/calendar-plans/${created.data!.calendarPlan.id}`,
    "calendarPlan",
  );
  assert.equal(ready.status, "READY");
  assert.ok(ready.content);
  return ready;
}

describe("kalendar rejani tahrirlash", () => {
  it("TAHRIR AI'ni QAYTA CHAQIRMAYDI", async () => {
    const client = await signedInClient("cal-tahrir-ai");
    const plan = await createCalendarPlan(client);

    await clearAiPrompts();
    const before = (await readAiPrompts()).length;

    const result = await client.request<CalendarPayload>(
      `/api/calendar-plans/${plan.id}`,
      { method: "PATCH", body: { content: { ...plan.content!, title: "Qo'lda nom" } } },
    );

    assert.equal(result.status, 200);
    assert.equal((await readAiPrompts()).length, before, "tahrirda AI chaqirildi");
  });

  it("tahrirlangan mavzu .xlsx FAYLIDA ko'rinadi", async () => {
    const client = await signedInClient("cal-tahrir-fayl");
    const plan = await createCalendarPlan(client);

    const marker = "QOLDA-YOZILGAN-MAVZU-5521";
    const weeks = plan.content!.weeks.map((week, index) =>
      index === 0
        ? { ...week, topics: [{ ...week.topics[0], name: marker, hours: 2 }] }
        : week,
    );

    const patched = await client.request<CalendarPayload>(
      `/api/calendar-plans/${plan.id}`,
      { method: "PATCH", body: { content: { ...plan.content!, weeks } } },
    );
    assert.equal(patched.status, 200);

    const response = await client.fetchRaw(`/api/calendar-plans/${plan.id}/download`);
    assert.equal(response.status, 200);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());

    let found = false;
    workbook.worksheets[0].eachRow((row) => {
      row.eachCell((cell) => {
        if (String(cell.value ?? "").includes(marker)) found = true;
      });
    });

    assert.ok(found, "tahrirlangan mavzu .xlsx faylida topilmadi");
  });

  it("qator qo'shilganda rowCount SERVERDA qayta hisoblanadi", async () => {
    /*
      Klient qatorlar sonini umuman yubormaydi — server uni mazmundan
      hisoblaydi. Shu tufayli soxta son bilan yozuvni chalg'itib bo'lmaydi.
    */
    const client = await signedInClient("cal-tahrir-qator");
    const plan = await createCalendarPlan(client);
    const before = plan.rowCount!;

    const weeks = plan.content!.weeks.map((week, index) =>
      index === 0
        ? { ...week, topics: [...week.topics, { name: "Yangi mavzu", hours: 1 }] }
        : week,
    );

    const patched = await client.request<CalendarPayload>(
      `/api/calendar-plans/${plan.id}`,
      { method: "PATCH", body: { content: { ...plan.content!, weeks } } },
    );

    assert.equal(patched.status, 200);
    assert.equal(patched.data!.calendarPlan.rowCount, before + 1);
  });

  it("noto'g'ri soatni rad etadi", async () => {
    const client = await signedInClient("cal-tahrir-soat");
    const plan = await createCalendarPlan(client);

    const weeks = plan.content!.weeks.map((week, index) =>
      index === 0 ? { ...week, topics: [{ ...week.topics[0], hours: 0 }] } : week,
    );

    const result = await client.request(`/api/calendar-plans/${plan.id}`, {
      method: "PATCH",
      body: { content: { ...plan.content!, weeks } },
    });

    assert.equal(result.status, 400);
  });

  it("BOSHQA foydalanuvchi tahrirlay olmaydi (404)", async () => {
    const owner = await signedInClient("cal-tahrir-ega");
    const stranger = await signedInClient("cal-tahrir-begona");

    const plan = await createCalendarPlan(owner);
    const original = plan.content!.title;

    const attempt = await stranger.request(`/api/calendar-plans/${plan.id}`, {
      method: "PATCH",
      body: { content: { ...plan.content!, title: "Buzildi" } },
    });

    assert.equal(attempt.status, 404);

    const reloaded = await owner.request<CalendarPayload>(
      `/api/calendar-plans/${plan.id}`,
    );
    assert.equal(reloaded.data!.calendarPlan.content!.title, original);
  });
});

// ─── Dars ishlanmasi ────────────────────────────────────────────────────────

async function createLessonPlan(
  client: TestClient,
): Promise<LessonPlanPayload["lessonPlan"]> {
  const created = await client.request<LessonPlanPayload>("/api/lesson-plans", {
    method: "POST",
    body: {
      subject: "Biologiya",
      grade: "7-sinf",
      topic: "Fotosintez",
      durationMinutes: 45,
    },
  });
  assert.equal(created.status, 202);

  const ready = await waitForGeneration<LessonPlanPayload["lessonPlan"]>(
    client,
    `/api/lesson-plans/${created.data!.lessonPlan.id}`,
    "lessonPlan",
  );
  assert.equal(ready.status, "READY");
  assert.ok(ready.content);
  return ready;
}

describe("dars ishlanmasini tahrirlash", () => {
  it("TAHRIR AI'ni QAYTA CHAQIRMAYDI", async () => {
    const client = await signedInClient("lp-tahrir-ai");
    const plan = await createLessonPlan(client);

    await clearAiPrompts();
    const before = (await readAiPrompts()).length;

    const result = await client.request<LessonPlanPayload>(
      `/api/lesson-plans/${plan.id}`,
      {
        method: "PATCH",
        body: {
          content: { ...plan.content!, objective: "Qo'lda yozilgan maqsad matni" },
        },
      },
    );

    assert.equal(result.status, 200);
    assert.equal((await readAiPrompts()).length, before, "tahrirda AI chaqirildi");
  });

  it("tahrirlangan matn WORD faylida ko'rinadi", async () => {
    /*
      .docx har so'rovda mazmundan yasaladi — saqlangan fayl yo'q.
      Shuning uchun bu sinov aynan eksport route'ini tekshiradi.
    */
    const client = await signedInClient("lp-tahrir-word");
    const plan = await createLessonPlan(client);

    const marker = "QOLDA-YOZILGAN-MAQSAD-8834";
    const patched = await client.request(`/api/lesson-plans/${plan.id}`, {
      method: "PATCH",
      body: { content: { ...plan.content!, objective: marker } },
    });
    assert.equal(patched.status, 200);

    const response = await client.fetchRaw(`/api/lesson-plans/${plan.id}/export`);
    assert.equal(response.status, 200);

    // .docx — ZIP arxiv; matn `word/document.xml` ichida.
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    const xml = await zip.file("word/document.xml")!.async("string");

    assert.ok(xml.includes(marker), "tahrirlangan maqsad Word faylida topilmadi");
  });

  it("bosqich qo'shish saqlanadi", async () => {
    const client = await signedInClient("lp-tahrir-bosqich");
    const plan = await createLessonPlan(client);
    const before = plan.content!.stages.length;

    const stages = [
      ...plan.content!.stages,
      {
        name: "Qo'shimcha bosqich",
        durationMinutes: 5,
        description: "Bu bosqich qo'lda qo'shildi va yetarli uzunlikda.",
        teacherActivity: "O'qituvchi savol beradi.",
        studentActivity: "O'quvchilar javob beradi.",
      },
    ];

    const patched = await client.request<LessonPlanPayload>(
      `/api/lesson-plans/${plan.id}`,
      { method: "PATCH", body: { content: { ...plan.content!, stages } } },
    );

    assert.equal(patched.status, 200);
    assert.equal(patched.data!.lessonPlan.content!.stages.length, before + 1);
  });

  it("3 tadan kam bosqichni rad etadi", async () => {
    const client = await signedInClient("lp-tahrir-kam");
    const plan = await createLessonPlan(client);

    const result = await client.request(`/api/lesson-plans/${plan.id}`, {
      method: "PATCH",
      body: {
        content: { ...plan.content!, stages: plan.content!.stages.slice(0, 2) },
      },
    });

    assert.equal(result.status, 400);
  });

  it("NOTANISH maydonli tanani rad etadi", async () => {
    const client = await signedInClient("lp-tahrir-notanish");
    const plan = await createLessonPlan(client);

    const result = await client.request(`/api/lesson-plans/${plan.id}`, {
      method: "PATCH",
      body: { content: plan.content, topic: "Boshqa mavzu" },
    });

    assert.equal(result.status, 400);
  });

  it("BOSHQA foydalanuvchi tahrirlay olmaydi (404)", async () => {
    const owner = await signedInClient("lp-tahrir-ega");
    const stranger = await signedInClient("lp-tahrir-begona");

    const plan = await createLessonPlan(owner);
    const original = plan.content!.objective;

    const attempt = await stranger.request(`/api/lesson-plans/${plan.id}`, {
      method: "PATCH",
      body: { content: { ...plan.content!, objective: "Buzib yuborilgan maqsad" } },
    });

    assert.equal(attempt.status, 404);

    const reloaded = await owner.request<LessonPlanPayload>(
      `/api/lesson-plans/${plan.id}`,
    );
    assert.equal(reloaded.data!.lessonPlan.content!.objective, original);
  });
});
