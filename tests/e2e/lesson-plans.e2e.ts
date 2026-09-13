import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  BASE_URL,
  TestClient,
  cleanupTestUsers,
  testEmail,
  waitForGeneration,
} from "./helpers/client";
import { MARKER_BAD_SHAPE, MARKER_SERVER_ERROR, MARKER_SLOW } from "./helpers/mock-ai";

/**
 * Dars ishlanmasi moduli — uchidan-uchgacha.
 *
 * AI soxta server bilan almashtirilgan (`helpers/mock-ai.ts`), lekin
 * qolgan hamma narsa haqiqiy: HTTP, sessiya, baza, zod tekshiruvi.
 *
 * ── FON REJIMI ────────────────────────────────────────────────────────────
 * POST endi `202` va PENDING yozuvni qaytaradi — natija tayyor emas.
 * Shuning uchun sinovlar `waitForGeneration()` bilan tugashini kutadi,
 * xuddi brauzer polling qilgani kabi.
 *
 * MUHIM natija: generatsiya XATOSI endi POST javobida kelmaydi. U
 * yozuvning `status: FAILED` va `errorMessage` maydonlarida bo'ladi.
 */

/** POST yuboradi, 202 ni tekshiradi va generatsiya tugashini kutadi. */
async function createAndWait(
  client: TestClient,
  body: Record<string, unknown>,
): Promise<LessonPlanPayload["lessonPlan"]> {
  const created = await client.request<LessonPlanPayload>("/api/lesson-plans", {
    method: "POST",
    body,
  });

  assert.equal(created.status, 202, "fon rejimida 202 qaytishi kerak");
  assert.equal(
    created.data!.lessonPlan.status,
    "PENDING",
    "darhol PENDING qaytishi kerak",
  );

  return waitForGeneration<LessonPlanPayload["lessonPlan"]>(
    client,
    `/api/lesson-plans/${created.data!.lessonPlan.id}`,
    "lessonPlan",
  );
}

const PASSWORD = "juda-maxfiy-parol";

interface LessonPlanPayload {
  lessonPlan: {
    id: string;
    subject: string;
    grade: string;
    topic: string;
    durationMinutes: number;
    lessonType: string;
    language: string;
    status: "PENDING" | "READY" | "FAILED";
    errorMessage: string | null;
    aiModel: string | null;
    aiDurationMs: number | null;
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

interface ListPayload {
  items: Array<{ id: string; topic: string; status: string }>;
  nextCursor: string | null;
}

/** Ro'yxatdan o'tgan mijoz qaytaradi. */
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
  assert.equal(result.status, 201, "ro'yxatdan o'tish muvaffaqiyatli bo'lishi kerak");
  return client;
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    subject: "Matematika",
    grade: "7-sinf",
    topic: "Kasrlarni qo'shish va ayirish",
    durationMinutes: 45,
    lessonType: "NEW_TOPIC",
    language: "UZ",
    ...overrides,
  };
}

// Sinov foydalanuvchilari o'chirilsa, ularning dars ishlanmalari ham
// cascade bilan o'chadi.
before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

describe("dars ishlanmasi generatsiyasi", () => {
  it("to'liq ishlanma yaratadi va READY qiladi", async () => {
    const client = await signedInClient("lp-ok");

    const plan = await createAndWait(client, validInput());

    assert.equal(plan.status, "READY");
    assert.equal(plan.errorMessage, null);
    assert.equal(plan.subject, "Matematika");
    assert.equal(plan.topic, "Kasrlarni qo'shish va ayirish");

    // Kuzatuv maydonlari to'ldirilishi kerak (Step 5 o'lchovlari uchun).
    assert.equal(plan.aiModel, "mock-lesson-model");
    assert.ok(
      plan.aiDurationMs !== null && plan.aiDurationMs >= 0,
      "aiDurationMs to'ldirilishi kerak",
    );

    // Kontent tuzilishi
    const content = plan.content!;
    assert.ok(content.objective.length > 10);
    assert.ok(content.outcomes.length >= 2);
    assert.ok(content.resources.length >= 1);
    assert.ok(content.stages.length >= 3);

    // Har bir bosqichda o'qituvchi VA o'quvchi faoliyati bo'lishi kerak.
    for (const stage of content.stages) {
      assert.ok(stage.name.length > 0);
      assert.ok(stage.durationMinutes > 0);
      assert.ok(stage.teacherActivity.length > 0);
      assert.ok(stage.studentActivity.length > 0);
    }
  });

  it("bosqichlar yig'indisi dars davomiyligiga mos keladi", async () => {
    const client = await signedInClient("lp-vaqt");

    for (const durationMinutes of [40, 90]) {
      const plan = await createAndWait(
        client,
        validInput({ durationMinutes, topic: `Mavzu ${durationMinutes}` }),
      );

      assert.equal(plan.status, "READY");
      const stages = plan.content!.stages;
      const total = stages.reduce((sum, stage) => sum + stage.durationMinutes, 0);

      assert.equal(
        total,
        durationMinutes,
        `${durationMinutes} daqiqalik dars uchun yig'indi ${total} chiqdi`,
      );
    }
  });

  it("AI xatosida FAILED qiladi va tushunarli xabar saqlaydi", async () => {
    const client = await signedInClient("lp-xato");

    // Bu mavzu soxta AI serverini 500 qaytarishga majbur qiladi.
    const plan = await createAndWait(
      client,
      validInput({ topic: `Mavzu ${MARKER_SERVER_ERROR}` }),
    );

    // Fon rejimida xato POST javobida KELMAYDI — u yozuvga yoziladi.
    assert.equal(plan.status, "FAILED");
    assert.ok(plan.errorMessage !== null, "errorMessage saqlanishi kerak");
    // errorMessage to'g'ridan-to'g'ri UI'da ko'rinadi — unda texnik
    // tafsilot bo'lmasligi kerak.
    assert.ok(!plan.errorMessage!.includes("mock"));
    assert.ok(!plan.errorMessage!.includes("500"));
    assert.equal(plan.content, null);

    // Yozuv ro'yxatda ham FAILED bo'lib turishi kerak.
    const list = await client.request<ListPayload>("/api/lesson-plans");
    assert.ok(list.data!.items.some((item) => item.status === "FAILED"));
  });

  it("AI sxemaga mos kelmaydigan javob bersa ham FAILED qiladi", async () => {
    const client = await signedInClient("lp-format");

    const plan = await createAndWait(
      client,
      validInput({ topic: `Mavzu ${MARKER_BAD_SHAPE}` }),
    );

    assert.equal(plan.status, "FAILED", "sxemaga mos kelmagan javob FAILED bo'ladi");
    assert.ok(plan.errorMessage !== null);
  });

  it("noto'g'ri kirish ma'lumotini 400 bilan rad etadi", async () => {
    const client = await signedInClient("lp-validatsiya");

    const result = await client.request("/api/lesson-plans", {
      method: "POST",
      body: { subject: "M", grade: "", topic: "ab", durationMinutes: 500 },
    });

    assert.equal(result.status, 400);
    assert.equal(result.error!.code, "validation_error");
    const fields = result.error!.fieldErrors!;
    assert.ok(fields.subject);
    assert.ok(fields.grade);
    assert.ok(fields.topic);
    assert.ok(fields.durationMinutes);
  });

  it("kirmagan foydalanuvchini 401 bilan rad etadi", async () => {
    const anonymous = new TestClient();

    const result = await anonymous.request("/api/lesson-plans", {
      method: "POST",
      body: validInput(),
    });

    assert.equal(result.status, 401);
    assert.equal(result.error!.code, "unauthorized");
  });
});

describe("qayta generatsiya", () => {
  it("FAILED yozuvni O'RNIDA tuzatadi, yangi yozuv yaratmaydi", async () => {
    const client = await signedInClient("lp-qayta");

    // 1. Ataylab yiqitamiz.
    const failed = await createAndWait(
      client,
      validInput({ topic: `Kasrlar ${MARKER_SERVER_ERROR}` }),
    );
    assert.equal(failed.status, "FAILED");
    const failedId = failed.id;

    const listBefore = await client.request<ListPayload>("/api/lesson-plans");
    assert.equal(listBefore.data!.items.length, 1);

    // 2. Qayta generatsiya PARAMETRLARNI YOZUVDAN oladi, ya'ni mavzu hali
    //    ham belgi bilan. Demak yana yiqilishi kerak.
    //
    //    DIQQAT: fon rejimida `regenerate` ning O'ZI muvaffaqiyatli (202) —
    //    generatsiya xatosi keyinroq yozuvga tushadi.
    const accepted = await client.request(`/api/lesson-plans/${failedId}/regenerate`, {
      method: "POST",
    });
    assert.equal(accepted.status, 202, "qayta generatsiya qabul qilinadi");

    const retried = await waitForGeneration<LessonPlanPayload["lessonPlan"]>(
      client,
      `/api/lesson-plans/${failedId}`,
      "lessonPlan",
    );
    assert.equal(retried.status, "FAILED", "bir xil parametr bilan yana yiqiladi");

    // 3. Eng muhimi: yangi yozuv YARATILMAGAN bo'lishi kerak.
    const listAfter = await client.request<ListPayload>("/api/lesson-plans");
    assert.equal(
      listAfter.data!.items.length,
      1,
      "qayta urinish yangi yozuv yaratmasligi kerak",
    );
    assert.equal(listAfter.data!.items[0].id, failedId);
  });

  it("muvaffaqiyatli qayta generatsiya READY qiladi va xatoni tozalaydi", async () => {
    const client = await signedInClient("lp-qayta-ok");

    // Muvaffaqiyatli yozuv yaratamiz, keyin qayta generatsiya qilamiz.
    const created = await createAndWait(client, validInput());
    const planId = created.id;

    const accepted = await client.request<LessonPlanPayload>(
      `/api/lesson-plans/${planId}/regenerate`,
      { method: "POST" },
    );
    assert.equal(accepted.status, 202);
    assert.equal(accepted.data!.lessonPlan.status, "PENDING");

    const regenerated = await waitForGeneration<LessonPlanPayload["lessonPlan"]>(
      client,
      `/api/lesson-plans/${planId}`,
      "lessonPlan",
    );

    assert.equal(regenerated.id, planId, "bir xil yozuv");
    assert.equal(regenerated.status, "READY");
    assert.equal(regenerated.errorMessage, null);
    assert.ok(regenerated.content !== null);
  });
});

describe("bir vaqtda ikki generatsiya", () => {
  it("PENDING yozuvni QAYTA generatsiya qilishga ruxsat bermaydi (409)", async () => {
    // Foydalanuvchi «Qayta urinish» tugmasini ikki marta bossa, ilgari
    // ikkita fon ishi ishga tushib, AI ikki marta chaqirilardi.
    const client = await signedInClient("lp-poyga");

    // `MARKER_SLOW` soxta AI javobini ataylab kechiktiradi, shunda yozuv
    // PENDING holatida yetarlicha uzoq turadi. Aks holda soxta AI ~10ms
    // da javob berib, sinov vaqtga bog'liq (flaky) bo'lib qolardi.
    const created = await client.request<LessonPlanPayload>("/api/lesson-plans", {
      method: "POST",
      body: validInput({ topic: `Kasrlar ${MARKER_SLOW}` }),
    });
    const planId = created.data!.lessonPlan.id;

    // Yozuv hali PENDING (fon ishi endi boshlandi) — darhol qayta
    // generatsiyaga urinamiz.
    const second = await client.request(`/api/lesson-plans/${planId}/regenerate`, {
      method: "POST",
    });

    assert.equal(second.status, 409, "ikkinchi so'rov rad etilishi kerak");
    assert.equal(second.error!.code, "conflict");

    // Birinchi generatsiya buzilmasligi kerak.
    const final = await waitForGeneration<LessonPlanPayload["lessonPlan"]>(
      client,
      `/api/lesson-plans/${planId}`,
      "lessonPlan",
    );
    assert.equal(final.status, "READY");
  });
});

describe("ro'yxat", () => {
  it("faqat O'Z yozuvlarini qaytaradi", async () => {
    const first = await signedInClient("lp-royxat-1");
    const second = await signedInClient("lp-royxat-2");

    await createAndWait(first, validInput({ topic: "Birinchi foydalanuvchi mavzusi" }));
    await createAndWait(second, validInput({ topic: "Ikkinchi foydalanuvchi mavzusi" }));

    const firstList = await first.request<ListPayload>("/api/lesson-plans");
    const secondList = await second.request<ListPayload>("/api/lesson-plans");

    assert.equal(firstList.data!.items.length, 1);
    assert.equal(firstList.data!.items[0].topic, "Birinchi foydalanuvchi mavzusi");

    assert.equal(secondList.data!.items.length, 1);
    assert.equal(secondList.data!.items[0].topic, "Ikkinchi foydalanuvchi mavzusi");
  });

  it("eng yangisi birinchi turadi", async () => {
    const client = await signedInClient("lp-tartib");

    for (const topic of ["Birinchi mavzu", "Ikkinchi mavzu", "Uchinchi mavzu"]) {
      await createAndWait(client, validInput({ topic }));
    }

    const list = await client.request<ListPayload>("/api/lesson-plans");
    assert.deepEqual(
      list.data!.items.map((item) => item.topic),
      ["Uchinchi mavzu", "Ikkinchi mavzu", "Birinchi mavzu"],
    );
  });

  it("holat bo'yicha filtrlaydi", async () => {
    const client = await signedInClient("lp-filtr");

    await createAndWait(client, validInput({ topic: "Muvaffaqiyatli mavzu" }));
    await createAndWait(client, validInput({ topic: `Yiqilgan ${MARKER_SERVER_ERROR}` }));

    const ready = await client.request<ListPayload>("/api/lesson-plans?status=READY");
    assert.equal(ready.data!.items.length, 1);
    assert.equal(ready.data!.items[0].topic, "Muvaffaqiyatli mavzu");

    const failed = await client.request<ListPayload>("/api/lesson-plans?status=FAILED");
    assert.equal(failed.data!.items.length, 1);
  });

  it("kirmagan foydalanuvchini 401 bilan rad etadi", async () => {
    const anonymous = new TestClient();
    const result = await anonymous.request("/api/lesson-plans");
    assert.equal(result.status, 401);
  });
});

describe("egalik tekshiruvi", () => {
  it("BOSHQA foydalanuvchi yozuvini o'qib bo'lmaydi (404)", async () => {
    const owner = await signedInClient("lp-ega");
    const stranger = await signedInClient("lp-begona");

    const created = await createAndWait(
      owner,
      validInput({ topic: "Maxfiy dars mavzusi" }),
    );
    const planId = created.id;

    // Egasi o'qiy oladi.
    const byOwner = await owner.request<LessonPlanPayload>(`/api/lesson-plans/${planId}`);
    assert.equal(byOwner.status, 200);

    // Begona — yo'q.
    const byStranger = await stranger.request(`/api/lesson-plans/${planId}`);
    assert.equal(byStranger.status, 404, "403 emas, 404 bo'lishi kerak");
    // Javobda yozuv mazmuni sizib chiqmasligi kerak.
    assert.ok(!JSON.stringify(byStranger).includes("Maxfiy dars mavzusi"));
  });

  it("BOSHQA foydalanuvchi yozuvini o'chirib bo'lmaydi", async () => {
    const owner = await signedInClient("lp-ega-ochirish");
    const stranger = await signedInClient("lp-begona-ochirish");

    const created = await createAndWait(owner, validInput());
    const planId = created.id;

    const attempt = await stranger.request(`/api/lesson-plans/${planId}`, {
      method: "DELETE",
    });
    assert.equal(attempt.status, 404);

    // Yozuv joyida qolishi kerak.
    const stillThere = await owner.request(`/api/lesson-plans/${planId}`);
    assert.equal(stillThere.status, 200, "yozuv o'chirilmagan bo'lishi kerak");
  });

  it("BOSHQA foydalanuvchi yozuvini qayta generatsiya qilib bo'lmaydi", async () => {
    const owner = await signedInClient("lp-ega-qayta");
    const stranger = await signedInClient("lp-begona-qayta");

    const created = await createAndWait(owner, validInput());

    const attempt = await stranger.request(`/api/lesson-plans/${created.id}/regenerate`, {
      method: "POST",
    });
    assert.equal(attempt.status, 404);
  });

  it("mavjud bo'lmagan id uchun 404", async () => {
    const client = await signedInClient("lp-yoq");
    const result = await client.request("/api/lesson-plans/umuman-mavjud-emas");
    assert.equal(result.status, 404);
  });
});

describe("o'chirish", () => {
  it("egasi o'z yozuvini o'chiradi", async () => {
    const client = await signedInClient("lp-ochirish");

    const created = await createAndWait(client, validInput());
    const planId = created.id;

    const deleted = await client.request(`/api/lesson-plans/${planId}`, {
      method: "DELETE",
    });
    assert.equal(deleted.status, 200);

    // Endi topilmasligi kerak.
    const gone = await client.request(`/api/lesson-plans/${planId}`);
    assert.equal(gone.status, 404);

    const list = await client.request<ListPayload>("/api/lesson-plans");
    assert.equal(list.data!.items.length, 0);
  });

  it("ikki marta o'chirishga urinsa 404", async () => {
    const client = await signedInClient("lp-ikki-ochirish");

    const created = await createAndWait(client, validInput());
    const planId = created.id;

    await client.request(`/api/lesson-plans/${planId}`, { method: "DELETE" });
    const second = await client.request(`/api/lesson-plans/${planId}`, {
      method: "DELETE",
    });

    assert.equal(second.status, 404);
  });
});

describe("ko'p tillilik", () => {
  it("tanlangan tilda generatsiya qiladi", async () => {
    const client = await signedInClient("lp-tillar");

    for (const language of ["UZ", "RU", "EN"]) {
      const plan = await createAndWait(
        client,
        validInput({ language, topic: `Mavzu ${language}` }),
      );

      assert.equal(plan.language, language);
      assert.equal(plan.status, "READY");
    }
  });
});

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("Word eksporti", () => {
  it("tayyor ishlanmani .docx qilib beradi", async () => {
    const client = await signedInClient("lp-word");
    const plan = await createAndWait(client, validInput({ topic: "Kasrlar" }));

    const response = await client.fetchRaw(`/api/lesson-plans/${plan.id}/export`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), DOCX_MIME);

    const disposition = response.headers.get("content-disposition")!;
    assert.match(disposition, /^attachment;/);
    assert.match(disposition, /\.docx/);
    // O'zbekcha nom uchun ikkala shakl ham bo'lishi kerak.
    assert.match(disposition, /filename="/);
    assert.match(disposition, /filename\*=UTF-8''/);

    // Shaxsiy hujjat keshlanmasligi kerak.
    assert.match(response.headers.get("cache-control")!, /no-store/);

    // Haqiqiy .docx — ZIP arxivi ("PK" bilan boshlanadi).
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");
    assert.ok(buffer.length > 2000, `hujjat juda kichik: ${buffer.length}`);
    assert.equal(Number(response.headers.get("content-length")), buffer.length);
  });

  it("BOSHQA foydalanuvchi eksport qila OLMAYDI", async () => {
    const owner = await signedInClient("lp-word-ega");
    const stranger = await signedInClient("lp-word-begona");

    const plan = await createAndWait(owner, validInput({ topic: "Maxfiy dars" }));

    const byOwner = await owner.fetchRaw(`/api/lesson-plans/${plan.id}/export`);
    assert.equal(byOwner.status, 200);

    // 404, 403 emas: begona yozuv BORLIGINI ham bildirmaymiz.
    const byStranger = await stranger.fetchRaw(`/api/lesson-plans/${plan.id}/export`);
    assert.equal(byStranger.status, 404);
  });

  it("kirmagan foydalanuvchini rad etadi", async () => {
    const client = await signedInClient("lp-word-anonim");
    const plan = await createAndWait(client, validInput());

    const response = await fetch(`${BASE_URL}/api/lesson-plans/${plan.id}/export`, {
      redirect: "manual",
    });
    assert.equal(response.status, 401);
  });

  it("XATO bilan tugagan ishlanmani eksport qilmaydi", async () => {
    const client = await signedInClient("lp-word-xato");

    const created = await client.request<LessonPlanPayload>("/api/lesson-plans", {
      method: "POST",
      body: validInput({ topic: `Fotosintez ${MARKER_SERVER_ERROR}` }),
    });
    const failed = await waitForGeneration<LessonPlanPayload["lessonPlan"]>(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );
    assert.equal(failed.status, "FAILED");

    const response = await client.fetchRaw(`/api/lesson-plans/${failed.id}/export`);
    assert.equal(response.status, 400);
  });
});
