import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import JSZip from "jszip";
import { TestClient, cleanupTestUsers, testEmail } from "../../e2e/helpers/client.ts";
import { storageFileExists } from "../helpers/target.ts";

/**
 * Uchala generator — HAQIQIY production artefaktida, boshidan oxirigacha.
 *
 * ── Zanjirning qaysi bo'g'ini tekshiriladi ────────────────────────────────
 *   so'rov qabul qilindi (202)
 *     → fon ishi bajarildi (`after()`)
 *       → yozuv READY bo'ldi
 *         → fayl ARTEFAKT ichida paydo bo'ldi
 *           → yuklab olish ishlaydi
 *             → chiqqan narsa HAQIQIY Office arxivi
 *
 * ── Nega faylning O'ZI ochiladi ───────────────────────────────────────────
 * "200 qaytdi" yetarli emas: buzuq yoki bo'sh fayl ham 200 bilan
 * keladi. Arxiv ochilib, ichidagi majburiy qism borligi tekshiriladi —
 * `tests/pptx-generate.test.ts` dagi bilan bir xil usul (`jszip`).
 *
 * ── Nega AI soxta, qolgani haqiqiy ────────────────────────────────────────
 * Haqiqiy provayder pul turadi va har safar boshqa javob beradi, ya'ni
 * CI'da ishlatib bo'lmaydi. Soxtalashtirish FAQAT AI chegarasida:
 * autentifikatsiya, baza, HTTP, saqlagich, fayl yasash va generatsiya
 * sikli — hammasi haqiqiy kod, haqiqiy artefakt ichida.
 */

const POLL_INTERVAL_MS = 300;
const POLL_LIMIT = 100;

before(async () => {
  await cleanupTestUsers();
});

after(async () => {
  await cleanupTestUsers();
});

/**
 * Har bir generator uchun ALOHIDA hisob.
 *
 * Nega: AI kvotasi bitta foydalanuvchi uchun daqiqasiga 3 ta so'rov
 * (`lib/ai/rate-limit.ts`). Uchala sinov bitta hisobdan ketsa, ular
 * chegaraga AYNAN tegib turardi va to'rtinchi sinov qo'shilgan kunda
 * to'plam tushunarsiz 429 bilan yiqilardi. Alohida hisob bu bog'liqlikni
 * butunlay yo'q qiladi.
 */
async function freshClient(suffix: string): Promise<TestClient> {
  const client = new TestClient();
  const registered = await client.request("/api/auth/register", {
    method: "POST",
    body: {
      email: testEmail(`smoke-${suffix}`),
      password: "juda-maxfiy-parol",
      fullName: "Smoke Generator",
    },
  });
  assert.equal(registered.status, 201);
  return client;
}

/**
 * Yozuv PENDING holatidan chiqqunicha kutadi.
 *
 * Timeout o'rniga ANIQ xato: "hali ham PENDING" va "FAILED bo'ldi" —
 * butunlay boshqa nosozliklar va ularni ajratib ko'rsatish kerak.
 */
async function waitForResult<T extends { status: string; errorMessage?: string | null }>(
  client: TestClient,
  path: string,
  key: string,
): Promise<T> {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const result = await client.request<Record<string, T>>(path);
    assert.equal(result.status, 200, `${path} o'qib bo'lmadi`);
    const record = result.data![key];
    if (record.status !== "PENDING") return record;
  }
  assert.fail(
    `${path} ${(POLL_LIMIT * POLL_INTERVAL_MS) / 1000}s ichida PENDING holatidan chiqmadi`,
  );
}

/** Arxiv haqiqiy Office hujjatimi — ochib, ichidagi majburiy qismni qidiramiz. */
async function assertOfficeArchive(
  buffer: Buffer,
  requiredEntry: string,
  label: string,
): Promise<void> {
  assert.ok(buffer.length > 1000, `${label}: fayl juda kichik (${buffer.length} bayt)`);
  // OOXML — ZIP konteyneri, ya'ni "PK" imzosi bilan boshlanadi.
  assert.equal(buffer[0], 0x50, `${label}: ZIP imzosi yo'q`);
  assert.equal(buffer[1], 0x4b, `${label}: ZIP imzosi yo'q`);

  const zip = await JSZip.loadAsync(buffer);
  assert.ok(zip.file(requiredEntry), `${label}: arxivda ${requiredEntry} yo'q`);
  assert.ok(
    zip.file("[Content_Types].xml"),
    `${label}: arxivda [Content_Types].xml yo'q`,
  );
}

describe("dars ishlanmasi — generatsiya va Word eksporti", () => {
  it("so'rovdan tayyor .docx gacha", async () => {
    const client = await freshClient("dars");
    const created = await client.request<{ lessonPlan: { id: string; status: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          topic: "Smoke: oddiy kasrlar",
          durationMinutes: 45,
          lessonType: "NEW_TOPIC",
          language: "UZ",
        },
      },
    );
    assert.equal(created.status, 202, "so'rov qabul qilinmadi");
    assert.equal(created.data!.lessonPlan.status, "PENDING");

    const id = created.data!.lessonPlan.id;
    const record = await waitForResult<{
      status: string;
      errorMessage?: string | null;
      content?: unknown;
    }>(client, `/api/lesson-plans/${id}`, "lessonPlan");

    assert.equal(record.status, "READY", `xato: ${record.errorMessage}`);
    assert.ok(record.content, "bazadagi yozuvda mazmun yo'q");

    const download = await client.fetchRaw(`/api/lesson-plans/${id}/export`);
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type") ?? "", /wordprocessingml/);
    assert.match(download.headers.get("cache-control") ?? "", /no-store/);

    const buffer = Buffer.from(await download.arrayBuffer());
    await assertOfficeArchive(buffer, "word/document.xml", "docx");
  });
});

describe("prezentatsiya — generatsiya, fayl va yuklab olish", () => {
  it("so'rovdan tayyor .pptx gacha", async () => {
    const client = await freshClient("prezentatsiya");
    const created = await client.request<{
      presentation: { id: string; status: string };
    }>("/api/presentations", {
      method: "POST",
      body: {
        mode: "standalone",
        topic: "Smoke: fotosintez",
        language: "UZ",
        template: "klassik",
      },
    });
    assert.equal(created.status, 202);

    const id = created.data!.presentation.id;
    const record = await waitForResult<{
      status: string;
      errorMessage?: string | null;
      filePath?: string | null;
      fileSize?: number | null;
      slideCount?: number | null;
    }>(client, `/api/presentations/${id}`, "presentation");

    assert.equal(record.status, "READY", `xato: ${record.errorMessage}`);
    assert.ok(record.filePath, "bazada fayl yo'li yozilmagan");
    assert.ok((record.fileSize ?? 0) > 0, "fayl hajmi nol");
    assert.ok((record.slideCount ?? 0) > 0, "slayd soni nol");

    // Fayl ARTEFAKT ichida haqiqatan yotibdimi.
    assert.ok(
      await storageFileExists("presentations", record.filePath!),
      `saqlagichda fayl yo'q: ${record.filePath}`,
    );

    const download = await client.fetchRaw(`/api/presentations/${id}/download`);
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type") ?? "", /presentationml/);

    const buffer = Buffer.from(await download.arrayBuffer());
    await assertOfficeArchive(buffer, "ppt/presentation.xml", "pptx");
  });
});

describe("kalendar reja — generatsiya, fayl va yuklab olish", () => {
  it("so'rovdan tayyor .xlsx gacha", async () => {
    const client = await freshClient("reja");
    const created = await client.request<{
      calendarPlan: { id: string; status: string };
    }>("/api/calendar-plans", {
      method: "POST",
      body: {
        subject: "Matematika",
        grade: "7-sinf",
        period: "1-chorak",
        weeks: 8,
        hoursPerWeek: 4,
        startDate: "2026-09-01",
        language: "UZ",
      },
    });
    assert.equal(created.status, 202);

    const id = created.data!.calendarPlan.id;
    const record = await waitForResult<{
      status: string;
      errorMessage?: string | null;
      filePath?: string | null;
      fileSize?: number | null;
      rowCount?: number | null;
    }>(client, `/api/calendar-plans/${id}`, "calendarPlan");

    assert.equal(record.status, "READY", `xato: ${record.errorMessage}`);
    assert.ok(record.filePath, "bazada fayl yo'li yozilmagan");
    assert.ok((record.fileSize ?? 0) > 0, "fayl hajmi nol");
    assert.ok(
      await storageFileExists("calendar-plans", record.filePath!),
      `saqlagichda fayl yo'q: ${record.filePath}`,
    );

    const download = await client.fetchRaw(`/api/calendar-plans/${id}/download`);
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type") ?? "", /spreadsheetml/);

    const buffer = Buffer.from(await download.arrayBuffer());
    await assertOfficeArchive(buffer, "xl/workbook.xml", "xlsx");
  });
});
