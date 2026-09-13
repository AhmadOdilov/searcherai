import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  BASE_URL,
  TestClient,
  cleanupTestUsers,
  clearAiPrompts,
  findAiPrompt,
  testEmail,
  waitForGeneration,
} from "./helpers/client";
import {
  MARKER_BAD_SHAPE,
  MARKER_NOT_JSON,
  MARKER_SERVER_ERROR,
} from "./helpers/mock-ai.ts";
import { text } from "./helpers/messages";

/**
 * Prezentatsiya moduli — uchidan-uchgacha.
 *
 * AI soxta server bilan almashtirilgan, qolgan hamma narsa haqiqiy:
 * HTTP, sessiya, baza, zod, pptxgenjs va fayl tizimi.
 */

const PASSWORD = "juda-maxfiy-parol";
const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

interface PresentationPayload {
  presentation: {
    id: string;
    lessonPlanId: string | null;
    topic: string;
    subject: string | null;
    grade: string | null;
    title: string | null;
    language: string;
    status: "PENDING" | "READY" | "FAILED";
    errorMessage: string | null;
    filePath: string | null;
    fileSize: number | null;
    slideCount: number | null;
    aiModel: string | null;
    aiDurationMs: number | null;
    content: {
      title: string;
      slides: Array<{ type: string; heading: string; bullets: string[] }>;
    } | null;
  };
}

interface LessonPlanPayload {
  lessonPlan: { id: string; status: string; topic: string };
}

interface ListPayload {
  items: Array<{ id: string; topic: string; status: string }>;
}

/**
 * POST yuboradi, 202 ni tekshiradi va generatsiya tugashini kutadi.
 *
 * Fon rejimida POST natijani qaytarmaydi — yozuv PENDING holatida keladi,
 * generatsiya esa javobdan keyin davom etadi.
 */
async function createAndWait(
  client: TestClient,
  body: Record<string, unknown>,
): Promise<PresentationPayload["presentation"]> {
  const created = await client.request<PresentationPayload>("/api/presentations", {
    method: "POST",
    body,
  });

  assert.equal(created.status, 202, "fon rejimida 202 qaytishi kerak");
  assert.equal(created.data!.presentation.status, "PENDING");

  return waitForGeneration<PresentationPayload["presentation"]>(
    client,
    `/api/presentations/${created.data!.presentation.id}`,
    "presentation",
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

/** Tayyor (READY) dars ishlanmasi yaratadi va uning id sini qaytaradi. */
async function createLessonPlan(
  client: TestClient,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const result = await client.request<LessonPlanPayload>("/api/lesson-plans", {
    method: "POST",
    body: {
      subject: "Biologiya",
      grade: "7-sinf",
      topic: "Fotosintez jarayoni",
      durationMinutes: 45,
      lessonType: "NEW_TOPIC",
      language: "UZ",
      ...overrides,
    },
  });
  assert.equal(result.status, 202, "dars ishlanmasi qabul qilinishi kerak");

  const plan = await waitForGeneration<LessonPlanPayload["lessonPlan"]>(
    client,
    `/api/lesson-plans/${result.data!.lessonPlan.id}`,
    "lessonPlan",
  );
  assert.equal(plan.status, "READY");
  return plan.id;
}

before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

describe("prezentatsiya — DARS ISHLANMASI asosida", () => {
  it("dars ishlanmasidan prezentatsiya yaratadi va BOG'LAYDI", async () => {
    const client = await signedInClient("pr-darsdan");
    const lessonPlanId = await createLessonPlan(client);

    const presentation = await createAndWait(client, {
      mode: "from-lesson-plan",
      lessonPlanId,
    });

    assert.equal(presentation.status, "READY");
    assert.equal(
      presentation.lessonPlanId,
      lessonPlanId,
      "dars ishlanmasiga bog'langan bo'lishi kerak",
    );
    // Mavzu, fan, sinf va til dars ishlanmasidan KO'CHIRILISHI kerak.
    assert.equal(presentation.topic, "Fotosintez jarayoni");
    assert.equal(presentation.subject, "Biologiya");
    assert.equal(presentation.grade, "7-sinf");
    assert.equal(presentation.language, "UZ");
  });

  it("AI'ga yuborilgan promptda dars ishlanmasi MAZMUNI bo'ladi", async () => {
    // Eng muhim tekshiruv: slaydlar darsga mos bo'lishi uchun promptga
    // maqsad va bosqichlar tushishi SHART. Bu jim buziladigan narsa.
    const client = await signedInClient("pr-prompt");
    const lessonPlanId = await createLessonPlan(client, {
      topic: "Fotosintez va nafas olish",
    });

    // Dars ishlanmasi generatsiyasining promptlarini tashlab yuboramiz.
    await clearAiPrompts();

    await createAndWait(client, { mode: "from-lesson-plan", lessonPlanId });

    const { system, user } = await findAiPrompt("Fotosintez va nafas olish");

    // System prompt — prezentatsiya uchun (dars ishlanmasi uchun emas).
    assert.ok(system.includes('"slides"'), "prezentatsiya sxemasi bo'lishi kerak");

    // Mavzu
    assert.ok(
      user.includes("Fotosintez va nafas olish"),
      "promptda mavzu bo'lishi kerak",
    );
    // Dars ishlanmasining MAQSADI — soxta AI har doim shu matnni qaytaradi.
    assert.ok(
      user.includes("asosiy tushunchalarni o'zlashtiradi"),
      "promptda dars maqsadi bo'lishi kerak",
    );
    // Dars BOSQICHLARI
    for (const stageName of ["Kirish", "Asosiy qism", "Mustahkamlash", "Uyga vazifa"]) {
      assert.ok(
        user.includes(stageName),
        `promptda "${stageName}" bosqichi bo'lishi kerak`,
      );
    }
    // Har bosqichga bitta slayd ko'rsatmasi
    assert.ok(user.includes("MUHIM"), "vaqt/bosqich ko'rsatmasi bo'lishi kerak");
  });

  it("BOSHQA foydalanuvchining dars ishlanmasidan yasab bo'lmaydi", async () => {
    const owner = await signedInClient("pr-ega");
    const stranger = await signedInClient("pr-begona");

    const lessonPlanId = await createLessonPlan(owner, {
      topic: "Maxfiy dars mavzusi",
    });

    const attempt = await stranger.request("/api/presentations", {
      method: "POST",
      body: { mode: "from-lesson-plan", lessonPlanId },
    });

    assert.equal(attempt.status, 404, "begona yozuv uchun 404");
    // Javobda begona yozuvning mazmuni sizib chiqmasligi kerak.
    assert.ok(!JSON.stringify(attempt).includes("Maxfiy dars mavzusi"));

    // Begonaning ro'yxatida hech narsa paydo bo'lmasligi kerak.
    const list = await stranger.request<ListPayload>("/api/presentations");
    assert.equal(list.data!.items.length, 0);
  });

  it("mavjud bo'lmagan lessonPlanId uchun 404", async () => {
    const client = await signedInClient("pr-yoq-plan");

    const result = await client.request("/api/presentations", {
      method: "POST",
      body: { mode: "from-lesson-plan", lessonPlanId: "umuman-mavjud-emas" },
    });

    assert.equal(result.status, 404);
    assert.match(result.error!.message, /topilmadi/);
  });

  it("FAILED dars ishlanmasidan yasashga urinsa tushunarli xato beradi", async () => {
    const client = await signedInClient("pr-failed-plan");

    // Ataylab yiqilgan dars ishlanmasi.
    await client.request("/api/lesson-plans", {
      method: "POST",
      body: {
        subject: "Biologiya",
        grade: "7-sinf",
        topic: `Fotosintez ${MARKER_SERVER_ERROR}`,
        durationMinutes: 45,
      },
    });
    const plans = await client.request<ListPayload>("/api/lesson-plans");
    const failedId = plans.data!.items[0].id;

    const result = await client.request("/api/presentations", {
      method: "POST",
      body: { mode: "from-lesson-plan", lessonPlanId: failedId },
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    // Kutilgan matn tarjima faylidan olinadi: matn tahrirlansa sinov
    // yiqilmaydi, lekin noto'g'ri xabar qaytsa — darhol ko'rinadi.
    assert.equal(result.error!.message, text("uz", "errors.domain.lessonPlanFailed"));
  });
});

describe("prezentatsiya — mustaqil rejim", () => {
  it("faqat mavzu bilan yaratadi", async () => {
    const client = await signedInClient("pr-mustaqil");

    const presentation = await createAndWait(client, {
      mode: "standalone",
      topic: "Suvning aylanishi",
    });

    assert.equal(presentation.status, "READY");
    assert.equal(presentation.lessonPlanId, null, "bog'lanmagan bo'lishi kerak");
    assert.equal(presentation.topic, "Suvning aylanishi");
    assert.equal(presentation.subject, null);
  });

  it("fan, sinf va til bilan yaratadi", async () => {
    const client = await signedInClient("pr-mustaqil-toliq");

    const presentation = await createAndWait(client, {
      mode: "standalone",
      topic: "Круговорот воды",
      subject: "География",
      grade: "6 класс",
      language: "RU",
    });

    assert.equal(presentation.subject, "География");
    assert.equal(presentation.language, "RU");
  });

  it("promptda dars ishlanmasi bo'limi BO'LMAYDI", async () => {
    const client = await signedInClient("pr-mustaqil-prompt");
    await clearAiPrompts();

    await createAndWait(client, { mode: "standalone", topic: "Suvning aylanishi" });

    const { user } = await findAiPrompt("Suvning aylanishi");
    assert.ok(!user.includes("Dars maqsadi"), "dars maqsadi bo'lmasligi kerak");
    assert.ok(!user.includes("Dars bosqichlari"), "bosqichlar bo'lmasligi kerak");
  });

  it("noto'g'ri kirishni 400 bilan rad etadi", async () => {
    const client = await signedInClient("pr-validatsiya");

    const result = await client.request("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "ab" },
    });

    assert.equal(result.status, 400);
    assert.equal(result.error!.code, "validation_error");
  });

  it("mode berilmasa 400", async () => {
    const client = await signedInClient("pr-mode-yoq");

    const result = await client.request("/api/presentations", {
      method: "POST",
      body: { topic: "Suvning aylanishi" },
    });

    assert.equal(result.status, 400);
  });

  it("kirmagan foydalanuvchini 401 bilan rad etadi", async () => {
    const anonymous = new TestClient();

    const result = await anonymous.request("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Suvning aylanishi" },
    });

    assert.equal(result.status, 401);
  });
});

describe("prezentatsiya — muvaffaqiyatli natija", () => {
  it("fayl, slayd soni va kuzatuv maydonlari to'ldiriladi", async () => {
    const client = await signedInClient("pr-natija");

    const presentation = await createAndWait(client, {
      mode: "standalone",
      topic: "Fotosintez",
    });

    assert.equal(presentation.status, "READY");
    assert.ok(presentation.filePath !== null, "filePath to'ldirilishi kerak");
    assert.ok(presentation.filePath!.endsWith(".pptx"), "fayl .pptx bo'lishi kerak");
    assert.ok(
      presentation.fileSize !== null && presentation.fileSize > 10_000,
      `fayl hajmi mantiqiy bo'lishi kerak (${presentation.fileSize})`,
    );
    assert.equal(presentation.slideCount, 6);
    assert.equal(presentation.aiModel, "mock-lesson-model");
    assert.ok(
      presentation.aiDurationMs !== null && presentation.aiDurationMs > 0,
      "aiDurationMs 0 dan katta bo'lishi kerak",
    );
    assert.ok(presentation.title !== null, "AI sarlavhasi saqlanishi kerak");

    // Slaydlar strukturasi
    const content = presentation.content!;
    assert.equal(content.slides.length, 6);
    assert.equal(content.slides[0].type, "title");
    assert.equal(content.slides.at(-1)!.type, "summary");
  });
});

describe("prezentatsiya — xato holatlari", () => {
  it("AI server xatosida FAILED qiladi", async () => {
    const client = await signedInClient("pr-xato-server");

    const presentation = await createAndWait(client, {
      mode: "standalone",
      topic: `Mavzu ${MARKER_SERVER_ERROR}`,
    });

    // Fon rejimida xato POST javobida kelmaydi — yozuvga yoziladi.
    assert.equal(presentation.status, "FAILED");
    assert.ok(presentation.errorMessage !== null);
    assert.ok(!presentation.errorMessage!.includes("mock"));
    assert.ok(!presentation.errorMessage!.includes("500"));
    // Yiqilgan generatsiyada fayl qolmasligi kerak.
    assert.equal(presentation.filePath, null);

    const list = await client.request<ListPayload>("/api/presentations");
    assert.ok(list.data!.items.some((item) => item.status === "FAILED"));
  });

  it("AI noto'g'ri JSON qaytarsa FAILED qiladi", async () => {
    const client = await signedInClient("pr-xato-json");

    const presentation = await createAndWait(client, {
      mode: "standalone",
      topic: `Mavzu ${MARKER_NOT_JSON}`,
    });

    assert.equal(presentation.status, "FAILED");
  });

  it("AI sxemaga mos kelmaydigan javob bersa FAILED qiladi", async () => {
    const client = await signedInClient("pr-xato-sxema");

    const presentation = await createAndWait(client, {
      mode: "standalone",
      topic: `Mavzu ${MARKER_BAD_SHAPE}`,
    });

    assert.equal(presentation.status, "FAILED");
    assert.ok(presentation.errorMessage !== null);
  });
});

describe("yuklab olish", () => {
  it("to'g'ri MIME turi va Content-Disposition bilan qaytaradi", async () => {
    const client = await signedInClient("pr-yuklash");

    const created = await createAndWait(client, {
      mode: "standalone",
      topic: "Fotosintez",
    });
    const id = created.id;

    const response = await client.fetchRaw(`/api/presentations/${id}/download`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), PPTX_MIME);

    const disposition = response.headers.get("content-disposition")!;
    assert.match(disposition, /^attachment;/, "attachment bo'lishi kerak");
    assert.match(disposition, /filename="/, "ASCII fayl nomi bo'lishi kerak");
    assert.match(disposition, /filename\*=UTF-8''/, "UTF-8 nomi ham bo'lishi kerak");
    assert.match(disposition, /\.pptx/);

    // Shaxsiy fayl keshlanmasligi kerak.
    assert.match(response.headers.get("cache-control")!, /no-store/);

    // Fayl HAQIQATAN .pptx (ZIP = "PK") bo'lishi kerak.
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");
    assert.ok(buffer.length > 10_000, `fayl juda kichik: ${buffer.length}`);
    assert.equal(
      Number(response.headers.get("content-length")),
      buffer.length,
      "content-length mos kelishi kerak",
    );
  });

  it("BOSHQA foydalanuvchi faylni yuklab OLOLMAYDI", async () => {
    const owner = await signedInClient("pr-fayl-ega");
    const stranger = await signedInClient("pr-fayl-begona");

    const created = await createAndWait(owner, {
      mode: "standalone",
      topic: "Maxfiy prezentatsiya",
    });
    const id = created.id;

    // Egasi — ha.
    const byOwner = await owner.fetchRaw(`/api/presentations/${id}/download`);
    assert.equal(byOwner.status, 200);

    // Begona — yo'q.
    const byStranger = await stranger.fetchRaw(`/api/presentations/${id}/download`);
    assert.equal(byStranger.status, 404);
    assert.ok(
      !byStranger.headers.get("content-type")?.includes("presentationml"),
      "fayl berilmasligi kerak",
    );
  });

  it("kirmagan foydalanuvchi faylni ololmaydi", async () => {
    const owner = await signedInClient("pr-fayl-anonim");
    const created = await createAndWait(owner, {
      mode: "standalone",
      topic: "Fotosintez",
    });

    const response = await fetch(`${BASE_URL}/api/presentations/${created.id}/download`, {
      redirect: "manual",
    });

    assert.equal(response.status, 401);
  });

  it("FAILED prezentatsiyani yuklab bo'lmaydi", async () => {
    const client = await signedInClient("pr-fayl-failed");

    const failed = await createAndWait(client, {
      mode: "standalone",
      topic: `Mavzu ${MARKER_SERVER_ERROR}`,
    });
    const failedId = failed.id;

    const response = await client.fetchRaw(`/api/presentations/${failedId}/download`);
    assert.equal(response.status, 400);
  });
});

describe("qayta generatsiya va o'chirish", () => {
  it("qayta generatsiya yangi yozuv YARATMAYDI", async () => {
    const client = await signedInClient("pr-qayta");

    const created = await createAndWait(client, {
      mode: "standalone",
      topic: "Fotosintez",
    });
    const id = created.id;

    const accepted = await client.request<PresentationPayload>(
      `/api/presentations/${id}/regenerate`,
      { method: "POST" },
    );
    assert.equal(accepted.status, 202);

    const regenerated = await waitForGeneration<PresentationPayload["presentation"]>(
      client,
      `/api/presentations/${id}`,
      "presentation",
    );

    assert.equal(regenerated.id, id);
    assert.equal(regenerated.status, "READY");
    assert.ok(regenerated.filePath !== null);

    const list = await client.request<ListPayload>("/api/presentations");
    assert.equal(list.data!.items.length, 1);
  });

  it("BOSHQA foydalanuvchi qayta generatsiya qila olmaydi", async () => {
    const owner = await signedInClient("pr-qayta-ega");
    const stranger = await signedInClient("pr-qayta-begona");

    const created = await createAndWait(owner, {
      mode: "standalone",
      topic: "Fotosintez",
    });

    const attempt = await stranger.request(
      `/api/presentations/${created.id}/regenerate`,
      { method: "POST" },
    );
    assert.equal(attempt.status, 404);
  });

  it("o'chirilgandan keyin fayl ham berilmaydi", async () => {
    const client = await signedInClient("pr-ochirish");

    const created = await createAndWait(client, {
      mode: "standalone",
      topic: "Fotosintez",
    });
    const id = created.id;

    const deleted = await client.request(`/api/presentations/${id}`, {
      method: "DELETE",
    });
    assert.equal(deleted.status, 200);

    const gone = await client.request(`/api/presentations/${id}`);
    assert.equal(gone.status, 404);

    const download = await client.fetchRaw(`/api/presentations/${id}/download`);
    assert.equal(download.status, 404);
  });

  it("BOSHQA foydalanuvchi o'chira olmaydi", async () => {
    const owner = await signedInClient("pr-ochirish-ega");
    const stranger = await signedInClient("pr-ochirish-begona");

    const created = await createAndWait(owner, {
      mode: "standalone",
      topic: "Fotosintez",
    });
    const id = created.id;

    const attempt = await stranger.request(`/api/presentations/${id}`, {
      method: "DELETE",
    });
    assert.equal(attempt.status, 404);

    const stillThere = await owner.request(`/api/presentations/${id}`);
    assert.equal(stillThere.status, 200);
  });
});

describe("ro'yxat", () => {
  it("faqat O'Z yozuvlarini qaytaradi", async () => {
    const first = await signedInClient("pr-royxat-1");
    const second = await signedInClient("pr-royxat-2");

    await createAndWait(first, { mode: "standalone", topic: "Birinchi mavzu" });
    await createAndWait(second, { mode: "standalone", topic: "Ikkinchi mavzu" });

    const firstList = await first.request<ListPayload>("/api/presentations");
    const secondList = await second.request<ListPayload>("/api/presentations");

    assert.equal(firstList.data!.items.length, 1);
    assert.equal(firstList.data!.items[0].topic, "Birinchi mavzu");
    assert.equal(secondList.data!.items.length, 1);
    assert.equal(secondList.data!.items[0].topic, "Ikkinchi mavzu");
  });
});
