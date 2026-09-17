import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { TestClient, cleanupTestUsers, testEmail } from "./helpers/client";
import { text } from "./helpers/messages";

/**
 * AI so'rovlari tezligi cheklovi — uchidan-uchgacha.
 *
 * ── Nega bu sinov muhim ───────────────────────────────────────────────────
 * Bu cheklov PUL yo'qotishdan himoya qiladi. U jim ishlamay qolsa,
 * hech qanday xato ko'rinmaydi — faqat oy oxirida hisobdagi summa
 * ko'rinadi. Shuning uchun chegara ikki tomondan tekshiriladi:
 * pastda ishlashi VA yuqorida to'xtatishi.
 */

const PASSWORD = "juda-maxfiy-parol";

/** `lib/ai/rate-limit.ts` dagi qiymat bilan bir xil bo'lishi kerak. */
const MAX_REQUESTS = 3;

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

function lessonPlanInput(topic: string) {
  return {
    subject: "Matematika",
    grade: "7-sinf",
    topic,
    durationMinutes: 45,
    lessonType: "NEW_TOPIC",
    language: "UZ",
  };
}

before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

describe("AI tezlik cheklovi", () => {
  it("chegaragacha bo'lgan so'rovlar O'TADI", async () => {
    const client = await signedInClient("kvota-past");

    for (let index = 0; index < MAX_REQUESTS; index++) {
      const result = await client.request("/api/lesson-plans", {
        method: "POST",
        body: lessonPlanInput(`Kasrlar ${index}`),
      });
      assert.equal(result.status, 202, `${index + 1}-so'rov o'tishi kerak edi`);
    }
  });

  it("chegaradan oshganda 429 va TUSHUNARLI xabar qaytadi", async () => {
    const client = await signedInClient("kvota-oshdi");

    for (let index = 0; index < MAX_REQUESTS; index++) {
      await client.request("/api/lesson-plans", {
        method: "POST",
        body: lessonPlanInput(`Kasrlar ${index}`),
      });
    }

    const blocked = await client.request("/api/lesson-plans", {
      method: "POST",
      body: lessonPlanInput("Bu so'rov rad etilishi kerak"),
    });

    assert.equal(blocked.status, 429);
    assert.equal(blocked.error!.code, "too_many_requests");
    assert.equal(blocked.error!.message, text("uz", "errors.domain.tooManyAiRequests"));
    // Foydalanuvchiga texnik tafsilot ko'rsatilmaydi.
    assert.ok(!/rate limit|user=|route=/i.test(blocked.error!.message));
  });

  it("kvota BARCHA AI modullariga umumiy", async () => {
    // Modul almashtirib chegarani chetlab o'tib bo'lmasligi kerak.
    const client = await signedInClient("kvota-umumiy");

    await client.request("/api/lesson-plans", {
      method: "POST",
      body: lessonPlanInput("Kasrlar"),
    });
    await client.request("/api/calendar-plans", {
      method: "POST",
      body: {
        subject: "Matematika",
        grade: "7-sinf",
        period: "1-chorak",
        startDate: "2026-09-01",
        weeks: 2,
        hoursPerWeek: 2,
        language: "UZ",
      },
    });
    await client.request("/api/search", {
      method: "POST",
      body: { question: "Kasrlarni qanday tushuntiraman?" },
    });

    // To'rtinchisi — boshqa modul bo'lsa ham rad etiladi.
    const blocked = await client.request("/api/presentations", {
      method: "POST",
      body: { mode: "standalone", topic: "Fotosintez", language: "UZ" },
    });

    assert.equal(
      blocked.status,
      429,
      "modul almashtirish chegarani aylanib o'tmasligi kerak",
    );
  });

  it("QAYTA generatsiya ham kvotadan yeydi", async () => {
    // «Qayta urinish» tugmasi ham AI chaqiradi — u ham hisoblanishi kerak.
    const client = await signedInClient("kvota-qayta");

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      { method: "POST", body: lessonPlanInput("Kasrlar") },
    );
    const planId = created.data!.lessonPlan.id;

    // Yana ikkita so'rov — kvota to'ladi (jami 3).
    await client.request("/api/search", {
      method: "POST",
      body: { question: "Birinchi qo'shimcha savol" },
    });
    await client.request("/api/search", {
      method: "POST",
      body: { question: "Ikkinchi qo'shimcha savol" },
    });

    const blocked = await client.request(`/api/lesson-plans/${planId}/regenerate`, {
      method: "POST",
    });
    assert.equal(blocked.status, 429);
  });

  it("kvota FOYDALANUVCHI bo'yicha — boshqa o'qituvchiga ta'sir qilmaydi", async () => {
    /*
      Eng muhim tekshiruv: cheklov global bo'lsa, bitta faol
      foydalanuvchi butun maktabni bloklardi. Login cheklovida aynan
      shunday muammo bo'lgan edi (hamma bitta NAT IP ostida).
    */
    const first = await signedInClient("kvota-birinchi");
    const second = await signedInClient("kvota-ikkinchi");

    for (let index = 0; index < MAX_REQUESTS + 1; index++) {
      await first.request("/api/lesson-plans", {
        method: "POST",
        body: lessonPlanInput(`Kasrlar ${index}`),
      });
    }

    const byFirst = await first.request("/api/lesson-plans", {
      method: "POST",
      body: lessonPlanInput("Yana bitta"),
    });
    assert.equal(byFirst.status, 429, "birinchi foydalanuvchi bloklangan bo'lishi kerak");

    const bySecond = await second.request("/api/lesson-plans", {
      method: "POST",
      body: lessonPlanInput("Boshqa o'qituvchining darsi"),
    });
    assert.equal(bySecond.status, 202, "ikkinchi foydalanuvchi erkin bo'lishi kerak");
  });

  it("NOTO'G'RI so'rov kvotani YEMAYDI", async () => {
    /*
      Validatsiya kvotadan OLDIN ishlaydi. Aks holda formani noto'g'ri
      to'ldirgan o'qituvchi uch marta xato qilib, keyin "juda tez-tez
      so'ramoqchisiz" xabarini olardi — bu mutlaqo tushunarsiz bo'lardi.
    */
    const client = await signedInClient("kvota-notogri");

    for (let index = 0; index < 5; index++) {
      const invalid = await client.request("/api/lesson-plans", {
        method: "POST",
        body: { subject: "", grade: "", topic: "" },
      });
      assert.equal(invalid.status, 400);
    }

    const valid = await client.request("/api/lesson-plans", {
      method: "POST",
      body: lessonPlanInput("Kasrlar"),
    });
    assert.equal(valid.status, 202, "noto'g'ri so'rovlar kvotani yegan");
  });

  it("kirmagan foydalanuvchi kvotaga umuman yetib bormaydi", async () => {
    const anonymous = new TestClient();
    const result = await anonymous.request("/api/search", {
      method: "POST",
      body: { question: "Fotosintez nima?" },
    });

    // 401 — 429 emas: kirish tekshiruvi birinchi turadi.
    assert.equal(result.status, 401);
  });

  it("PARALLEL so'rovlar ham chegarani chetlab o'ta olmaydi", async () => {
    /*
      Yuqoridagi sinovlar so'rovlarni KETMA-KET yuboradi va shu holatda
      chegara to'g'ri ishlaydi. Lekin `consumeAiQuota()` avval SANAYDI,
      keyin yozadi — ikkisi orasida oyna bor.

      Bir vaqtda kelgan so'rovlar hammasi "hali uchta emas" holatini
      ko'radi va chegaradan ko'prog'i o'tib ketadi. Auditda o'nta
      parallel so'rovdan UCHTA emas, BESHTASI qabul qilingan edi.

      Bu xavfsizlik chegarasi emas — u PUL chegarasi. Chetlab o'tilsa,
      hech qanday xato ko'rinmaydi, faqat provayder hisobidagi summa
      o'sadi. Aynan shuning uchun sinov kerak: nosozlik jim.
    */
    const client = await signedInClient("kvota-parallel");

    const statuses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        client
          .request("/api/lesson-plans", {
            method: "POST",
            body: lessonPlanInput(`Parallel ${index}`),
          })
          .then((result) => result.status),
      ),
    );

    const accepted = statuses.filter((status) => status === 202).length;

    assert.ok(
      accepted <= MAX_REQUESTS,
      `parallel so'rovlar chegarani chetlab o'tdi: ${accepted} ta qabul qilindi ` +
        `(chegara ${MAX_REQUESTS})`,
    );
    /*
      Teskari tomon: himoya "hammasini rad et" bo'lib qolmasin. Kamida
      bittasi o'tishi SHART, aks holda chegara ishlayotgandek ko'rinib,
      aslida ilovani buzgan bo'lardi.
    */
    assert.ok(accepted >= 1, "parallel so'rovlarning hammasi rad etildi");
  });
});
