import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { TestClient, cleanupTestUsers, testEmail } from "./helpers/client";
import { MARKER_BAD_SHAPE, MARKER_SERVER_ERROR } from "./helpers/mock-ai";

/**
 * Dars ishlanmasi moduli — uchidan-uchgacha.
 *
 * AI soxta server bilan almashtirilgan (`helpers/mock-ai.ts`), lekin
 * qolgan hamma narsa haqiqiy: HTTP, sessiya, baza, zod tekshiruvi.
 */

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

    const result = await client.request<LessonPlanPayload>("/api/lesson-plans", {
      method: "POST",
      body: validInput(),
    });

    assert.equal(result.status, 201);
    const plan = result.data!.lessonPlan;

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
      const result = await client.request<LessonPlanPayload>("/api/lesson-plans", {
        method: "POST",
        body: validInput({ durationMinutes, topic: `Mavzu ${durationMinutes}` }),
      });

      assert.equal(result.status, 201);
      const stages = result.data!.lessonPlan.content!.stages;
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

    const result = await client.request("/api/lesson-plans", {
      method: "POST",
      // Bu mavzu soxta AI serverini 500 qaytarishga majbur qiladi.
      body: validInput({ topic: `Mavzu ${MARKER_SERVER_ERROR}` }),
    });

    // So'rov xato bilan tugaydi...
    assert.equal(result.ok, false);
    assert.equal(result.status, 502, "server xatosi 502 bo'lib qaytishi kerak");
    // ...lekin foydalanuvchiga texnik tafsilot ketmasligi kerak.
    assert.ok(!result.error!.message.includes("500"));
    assert.ok(!result.error!.message.includes("mock"));

    // ...va yozuv ro'yxatda FAILED holatida qolishi kerak — foydalanuvchi
    // uni ko'rib "qayta urinish" bosadi.
    const list = await client.request<ListPayload>("/api/lesson-plans");
    const failed = list.data!.items.find((item) => item.status === "FAILED");
    assert.ok(failed, "FAILED yozuv ro'yxatda bo'lishi kerak");

    const detail = await client.request<LessonPlanPayload>(
      `/api/lesson-plans/${failed.id}`,
    );
    assert.equal(detail.data!.lessonPlan.status, "FAILED");
    assert.ok(
      detail.data!.lessonPlan.errorMessage !== null,
      "errorMessage saqlanishi kerak",
    );
    // errorMessage to'g'ridan-to'g'ri UI'da ko'rinadi — unda texnik
    // tafsilot bo'lmasligi kerak.
    assert.ok(!detail.data!.lessonPlan.errorMessage!.includes("mock"));
    assert.equal(detail.data!.lessonPlan.content, null);
  });

  it("AI sxemaga mos kelmaydigan javob bersa ham FAILED qiladi", async () => {
    const client = await signedInClient("lp-format");

    const result = await client.request("/api/lesson-plans", {
      method: "POST",
      body: validInput({ topic: `Mavzu ${MARKER_BAD_SHAPE}` }),
    });

    assert.equal(result.ok, false);

    const list = await client.request<ListPayload>("/api/lesson-plans");
    const failed = list.data!.items.find((item) => item.status === "FAILED");
    assert.ok(failed, "sxemaga mos kelmagan javob FAILED bo'lishi kerak");
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
    await client.request("/api/lesson-plans", {
      method: "POST",
      body: validInput({ topic: `Kasrlar ${MARKER_SERVER_ERROR}` }),
    });

    const listBefore = await client.request<ListPayload>("/api/lesson-plans");
    assert.equal(listBefore.data!.items.length, 1);
    const failedId = listBefore.data!.items[0].id;
    assert.equal(listBefore.data!.items[0].status, "FAILED");

    // 2. Mavzuni tuzatib qayta urinish uchun — belgi olib tashlanishi kerak,
    //    lekin qayta generatsiya PARAMETRLARNI YOZUVDAN oladi, ya'ni mavzu
    //    hali ham belgi bilan. Demak yana yiqilishi kerak.
    const retryFails = await client.request(`/api/lesson-plans/${failedId}/regenerate`, {
      method: "POST",
    });
    assert.equal(retryFails.ok, false, "bir xil parametr bilan yana yiqiladi");

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
    const created = await client.request<LessonPlanPayload>("/api/lesson-plans", {
      method: "POST",
      body: validInput(),
    });
    const planId = created.data!.lessonPlan.id;

    const regenerated = await client.request<LessonPlanPayload>(
      `/api/lesson-plans/${planId}/regenerate`,
      { method: "POST" },
    );

    assert.equal(regenerated.status, 200);
    assert.equal(regenerated.data!.lessonPlan.id, planId, "bir xil yozuv");
    assert.equal(regenerated.data!.lessonPlan.status, "READY");
    assert.equal(regenerated.data!.lessonPlan.errorMessage, null);
    assert.ok(regenerated.data!.lessonPlan.content !== null);
  });
});

describe("ro'yxat", () => {
  it("faqat O'Z yozuvlarini qaytaradi", async () => {
    const first = await signedInClient("lp-royxat-1");
    const second = await signedInClient("lp-royxat-2");

    await first.request("/api/lesson-plans", {
      method: "POST",
      body: validInput({ topic: "Birinchi foydalanuvchi mavzusi" }),
    });
    await second.request("/api/lesson-plans", {
      method: "POST",
      body: validInput({ topic: "Ikkinchi foydalanuvchi mavzusi" }),
    });

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
      await client.request("/api/lesson-plans", {
        method: "POST",
        body: validInput({ topic }),
      });
    }

    const list = await client.request<ListPayload>("/api/lesson-plans");
    assert.deepEqual(
      list.data!.items.map((item) => item.topic),
      ["Uchinchi mavzu", "Ikkinchi mavzu", "Birinchi mavzu"],
    );
  });

  it("holat bo'yicha filtrlaydi", async () => {
    const client = await signedInClient("lp-filtr");

    await client.request("/api/lesson-plans", {
      method: "POST",
      body: validInput({ topic: "Muvaffaqiyatli mavzu" }),
    });
    await client.request("/api/lesson-plans", {
      method: "POST",
      body: validInput({ topic: `Yiqilgan ${MARKER_SERVER_ERROR}` }),
    });

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

    const created = await owner.request<LessonPlanPayload>("/api/lesson-plans", {
      method: "POST",
      body: validInput({ topic: "Maxfiy dars mavzusi" }),
    });
    const planId = created.data!.lessonPlan.id;

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

    const created = await owner.request<LessonPlanPayload>("/api/lesson-plans", {
      method: "POST",
      body: validInput(),
    });
    const planId = created.data!.lessonPlan.id;

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

    const created = await owner.request<LessonPlanPayload>("/api/lesson-plans", {
      method: "POST",
      body: validInput(),
    });

    const attempt = await stranger.request(
      `/api/lesson-plans/${created.data!.lessonPlan.id}/regenerate`,
      { method: "POST" },
    );
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

    const created = await client.request<LessonPlanPayload>("/api/lesson-plans", {
      method: "POST",
      body: validInput(),
    });
    const planId = created.data!.lessonPlan.id;

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

    const created = await client.request<LessonPlanPayload>("/api/lesson-plans", {
      method: "POST",
      body: validInput(),
    });
    const planId = created.data!.lessonPlan.id;

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
      const result = await client.request<LessonPlanPayload>("/api/lesson-plans", {
        method: "POST",
        body: validInput({ language, topic: `Mavzu ${language}` }),
      });

      assert.equal(result.status, 201);
      assert.equal(result.data!.lessonPlan.language, language);
      assert.equal(result.data!.lessonPlan.status, "READY");
    }
  });
});
