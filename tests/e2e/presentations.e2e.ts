import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  BASE_URL,
  TestClient,
  cleanupTestUsers,
  clearAiPrompts,
  findAiPrompt,
  testEmail,
} from "./helpers/client";
import {
  MARKER_BAD_SHAPE,
  MARKER_NOT_JSON,
  MARKER_SERVER_ERROR,
} from "./helpers/mock-ai.ts";

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
  assert.equal(result.status, 201, "dars ishlanmasi yaratilishi kerak");
  assert.equal(result.data!.lessonPlan.status, "READY");
  return result.data!.lessonPlan.id;
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

    const result = await client.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: { mode: "from-lesson-plan", lessonPlanId },
    });

    assert.equal(result.status, 201);
    const presentation = result.data!.presentation;

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

    await client.request("/api/presentations", {
      method: "POST",
      body: { mode: "from-lesson-plan", lessonPlanId },
    });

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
    // Foydalanuvchiga NIMA QILISH kerakligi aytilsin.
    assert.match(result.error!.message, /qayta yarat/i);
  });
});

describe("prezentatsiya — mustaqil rejim", () => {
  it("faqat mavzu bilan yaratadi", async () => {
    const client = await signedInClient("pr-mustaqil");

    const result = await client.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Suvning aylanishi" },
    });

    assert.equal(result.status, 201);
    const presentation = result.data!.presentation;

    assert.equal(presentation.status, "READY");
    assert.equal(presentation.lessonPlanId, null, "bog'lanmagan bo'lishi kerak");
    assert.equal(presentation.topic, "Suvning aylanishi");
    assert.equal(presentation.subject, null);
  });

  it("fan, sinf va til bilan yaratadi", async () => {
    const client = await signedInClient("pr-mustaqil-toliq");

    const result = await client.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: {
        mode: "standalone",
        topic: "Круговорот воды",
        subject: "География",
        grade: "6 класс",
        language: "RU",
      },
    });

    assert.equal(result.status, 201);
    assert.equal(result.data!.presentation.subject, "География");
    assert.equal(result.data!.presentation.language, "RU");
  });

  it("promptda dars ishlanmasi bo'limi BO'LMAYDI", async () => {
    const client = await signedInClient("pr-mustaqil-prompt");
    await clearAiPrompts();

    await client.request("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Suvning aylanishi" },
    });

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

    const result = await client.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Fotosintez" },
    });

    const presentation = result.data!.presentation;

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

    const result = await client.request("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: `Mavzu ${MARKER_SERVER_ERROR}` },
    });

    assert.equal(result.ok, false);
    // Foydalanuvchiga texnik tafsilot ketmasligi kerak.
    assert.ok(!result.error!.message.includes("500"));
    assert.ok(!result.error!.message.includes("mock"));

    const list = await client.request<ListPayload>("/api/presentations");
    const failed = list.data!.items.find((item) => item.status === "FAILED");
    assert.ok(failed, "FAILED yozuv ro'yxatda qolishi kerak");

    const detail = await client.request<PresentationPayload>(
      `/api/presentations/${failed.id}`,
    );
    assert.equal(detail.data!.presentation.status, "FAILED");
    assert.ok(detail.data!.presentation.errorMessage !== null);
    assert.ok(!detail.data!.presentation.errorMessage!.includes("mock"));
    // Yiqilgan generatsiyada fayl qolmasligi kerak.
    assert.equal(detail.data!.presentation.filePath, null);
  });

  it("AI noto'g'ri JSON qaytarsa FAILED qiladi", async () => {
    const client = await signedInClient("pr-xato-json");

    const result = await client.request("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: `Mavzu ${MARKER_NOT_JSON}` },
    });

    assert.equal(result.ok, false);

    const list = await client.request<ListPayload>("/api/presentations");
    assert.ok(list.data!.items.some((item) => item.status === "FAILED"));
  });

  it("AI sxemaga mos kelmaydigan javob bersa FAILED qiladi", async () => {
    const client = await signedInClient("pr-xato-sxema");

    const result = await client.request("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: `Mavzu ${MARKER_BAD_SHAPE}` },
    });

    assert.equal(result.ok, false);

    const list = await client.request<ListPayload>("/api/presentations");
    const failed = list.data!.items.find((item) => item.status === "FAILED");
    assert.ok(failed);

    const detail = await client.request<PresentationPayload>(
      `/api/presentations/${failed.id}`,
    );
    assert.ok(detail.data!.presentation.errorMessage !== null);
  });
});

describe("yuklab olish", () => {
  it("to'g'ri MIME turi va Content-Disposition bilan qaytaradi", async () => {
    const client = await signedInClient("pr-yuklash");

    const created = await client.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Fotosintez" },
    });
    const id = created.data!.presentation.id;

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

    const created = await owner.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Maxfiy prezentatsiya" },
    });
    const id = created.data!.presentation.id;

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
    const created = await owner.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Fotosintez" },
    });

    const response = await fetch(
      `${BASE_URL}/api/presentations/${created.data!.presentation.id}/download`,
      { redirect: "manual" },
    );

    assert.equal(response.status, 401);
  });

  it("FAILED prezentatsiyani yuklab bo'lmaydi", async () => {
    const client = await signedInClient("pr-fayl-failed");

    await client.request("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: `Mavzu ${MARKER_SERVER_ERROR}` },
    });
    const list = await client.request<ListPayload>("/api/presentations");
    const failedId = list.data!.items[0].id;

    const response = await client.fetchRaw(`/api/presentations/${failedId}/download`);
    assert.equal(response.status, 400);
  });
});

describe("qayta generatsiya va o'chirish", () => {
  it("qayta generatsiya yangi yozuv YARATMAYDI", async () => {
    const client = await signedInClient("pr-qayta");

    const created = await client.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Fotosintez" },
    });
    const id = created.data!.presentation.id;

    const regenerated = await client.request<PresentationPayload>(
      `/api/presentations/${id}/regenerate`,
      { method: "POST" },
    );

    assert.equal(regenerated.status, 200);
    assert.equal(regenerated.data!.presentation.id, id);
    assert.equal(regenerated.data!.presentation.status, "READY");
    assert.ok(regenerated.data!.presentation.filePath !== null);

    const list = await client.request<ListPayload>("/api/presentations");
    assert.equal(list.data!.items.length, 1);
  });

  it("BOSHQA foydalanuvchi qayta generatsiya qila olmaydi", async () => {
    const owner = await signedInClient("pr-qayta-ega");
    const stranger = await signedInClient("pr-qayta-begona");

    const created = await owner.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Fotosintez" },
    });

    const attempt = await stranger.request(
      `/api/presentations/${created.data!.presentation.id}/regenerate`,
      { method: "POST" },
    );
    assert.equal(attempt.status, 404);
  });

  it("o'chirilgandan keyin fayl ham berilmaydi", async () => {
    const client = await signedInClient("pr-ochirish");

    const created = await client.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Fotosintez" },
    });
    const id = created.data!.presentation.id;

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

    const created = await owner.request<PresentationPayload>("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Fotosintez" },
    });
    const id = created.data!.presentation.id;

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

    await first.request("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Birinchi mavzu" },
    });
    await second.request("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Ikkinchi mavzu" },
    });

    const firstList = await first.request<ListPayload>("/api/presentations");
    const secondList = await second.request<ListPayload>("/api/presentations");

    assert.equal(firstList.data!.items.length, 1);
    assert.equal(firstList.data!.items[0].topic, "Birinchi mavzu");
    assert.equal(secondList.data!.items.length, 1);
    assert.equal(secondList.data!.items[0].topic, "Ikkinchi mavzu");
  });
});
