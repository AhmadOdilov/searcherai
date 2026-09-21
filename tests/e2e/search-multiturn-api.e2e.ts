import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { TestClient, cleanupTestUsers, testEmail } from "./helpers/client";

/**
 * Ko'p bosqichli suhbat MAHSULOT darajasida ishlaydimi?
 *
 * ── Nega bu test kerak ────────────────────────────────────────────────────
 * `scripts/evaluate-v5-multiturn.ts` kutubxona qatlamida 100% ko'rsatadi,
 * chunki u `MultiTurnService` ni TO'G'RIDAN-TO'G'RI chaqiradi. Bu esa
 * mahsulotda xususiyat ishlayotganini isbotlamaydi — V6 auditida aynan shu
 * sabab «Multi-turn API integratsiyasi» qamrovdan TASHQARIDA deb yozilgan
 * edi.
 *
 * Ushbu test HTTP yo'nalishi orqali o'tadi va endi ULANGAN xatti-harakatni
 * tekshiradi: `/api/search` suhbat kontekstini bazadan o'qiydi
 * (`lib/search/conversation-store.ts`).
 *
 * Shartnomaning ikkala yarmi ham qattiq tekshiriladi:
 *   · suhbat SO'RALGANDA kontekst meros olinadi;
 *   · so'ralmaganda hech narsa saqlanmaydi va hech narsa meros olinmaydi
 *     (bu maxfiylik qarori, tasodif emas — `docs/MULTI_TURN_V3_SPEC.md` §2.2).
 *
 * ── Kvota haqida ──────────────────────────────────────────────────────────
 * Bitta foydalanuvchi daqiqada 3 ta AI so'rovi qila oladi (`lib/ai/rate-limit.ts`).
 * Shuning uchun har bir holat ALOHIDA foydalanuvchi bilan ishlaydi va hech
 * biri 3 tadan ortiq qidiruv yubormaydi.
 */

const PASSWORD = "juda-maxfiy-parol";
const OPENING_QUESTION = "8-sinf matematika kvadrat tenglamalar nima?";

interface SearchPayload {
  conversationId?: string;
  answer: { answer: string; keyPoints: string[]; classroomIdeas: string[] };
  understanding?: {
    detectedSubject?: string;
    detectedGrade?: string;
    extractedTopic: string;
  };
}

async function signedInClient(suffix: string): Promise<TestClient> {
  const client = new TestClient();
  const result = await client.request("/api/auth/register", {
    method: "POST",
    body: { email: testEmail(suffix), password: PASSWORD, fullName: "Sinov O'qituvchi" },
  });
  assert.equal(result.status, 201);
  return client;
}

/** Suhbat ochadigan birinchi savol — identifikatorni qaytaradi. */
async function openConversation(
  client: TestClient,
): Promise<{ conversationId: string; topic: string }> {
  const opening = await client.request<SearchPayload>("/api/search", {
    method: "POST",
    body: { question: OPENING_QUESTION, language: "UZ", startConversation: true },
  });
  assert.equal(opening.status, 200);

  const conversationId = opening.data!.conversationId;
  assert.ok(
    typeof conversationId === "string" && conversationId.length > 0,
    "suhbat so'ralgan, lekin identifikator qaytmadi",
  );

  const topic = opening.data!.understanding?.extractedTopic ?? "";
  assert.match(topic, /kvadrat|tenglama/i, "birinchi bosqichda mavzu aniqlanishi kerak");

  return { conversationId, topic };
}

before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

describe("multi-turn API — suhbat konteksti", () => {
  it("MODIFIKATOR so'rov oldingi mavzu va fanni meros oladi", async () => {
    const client = await signedInClient("mt-api-modifier");
    const { conversationId } = await openConversation(client);

    // Keyingi bosqich — faqat modifikator, mavzu aytilmagan.
    const second = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "endi buni oddiyroq tushuntir", language: "UZ", conversationId },
    });
    assert.equal(second.status, 200);

    assert.match(
      second.data!.understanding?.extractedTopic ?? "",
      /kvadrat tenglama/i,
      "kontekst uzatilgani uchun mavzu saqlanishi kerak",
    );
    assert.equal(second.data!.understanding?.detectedSubject, "Matematika");
    assert.equal(second.data!.understanding?.detectedGrade, "8-sinf");

    // Suhbat davom etadi: identifikator o'zgarmaydi.
    assert.equal(second.data!.conversationId, conversationId);
  });

  it("to'rtala modifikator turi ham kontekstni meros oladi", async () => {
    /*
      Talab qilingan to'rt modifikator: «oddiyroq tushuntir», «misol ber»,
      «rus tilida ayt», «qisqartir». Har biri suhbat ichida yuboriladi va
      oldingi mavzuni meros olishi kerak.

      Har bir modifikator ALOHIDA foydalanuvchi bilan: AI kvotasi
      foydalanuvchi bo'yicha daqiqada 3 ta so'rov, bu yerda esa har bir
      holat 2 ta so'rov yuboradi.
    */
    const modifiers = ["oddiyroq tushuntir", "misol ber", "rus tilida ayt", "qisqartir"];
    const lost: string[] = [];

    for (const [index, modifier] of modifiers.entries()) {
      const client = await signedInClient(`mt-api-mod-${index}`);
      const { conversationId } = await openConversation(client);

      const res = await client.request<SearchPayload>("/api/search", {
        method: "POST",
        body: { question: modifier, language: "UZ", conversationId },
      });
      assert.equal(res.status, 200, modifier);

      const topic = res.data!.understanding?.extractedTopic ?? "";
      if (!/kvadrat tenglama/i.test(topic))
        lost.push(`${modifier} -> ${topic || "(bo'sh)"}`);
    }

    assert.deepEqual(
      lost,
      [],
      "har bir modifikator oldingi mavzuni meros olishi kerak edi",
    );
  });

  it("fan ham meros olinadi — boshqa fandagi suhbatda", async () => {
    const client = await signedInClient("mt-api-subject");

    const opening = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: {
        question: "6-sinf ona tili so'z turkumlari haqida",
        language: "UZ",
        startConversation: true,
      },
    });
    assert.equal(opening.status, 200);
    const conversationId = opening.data!.conversationId;
    assert.ok(typeof conversationId === "string");

    const follow = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "misol ber", language: "UZ", conversationId },
    });
    assert.equal(follow.status, 200);
    assert.equal(follow.data!.understanding?.detectedSubject, "Ona tili");
  });
});

describe("multi-turn API — suhbatsiz rejim standart bo'lib qoladi", () => {
  it("suhbat so'ralmasa identifikator qaytmaydi va kontekst saqlanmaydi", async () => {
    const client = await signedInClient("mt-api-stateless");

    const first = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: OPENING_QUESTION, language: "UZ" },
    });
    assert.equal(first.status, 200);
    assert.equal(
      first.data!.conversationId,
      undefined,
      "so'ralmagan suhbat ochilmasligi kerak — saqlash ATAYLAB tanlanadigan holat",
    );

    const second = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "endi buni oddiyroq tushuntir", language: "UZ" },
    });
    assert.equal(second.status, 200);
    assert.doesNotMatch(
      second.data!.understanding?.extractedTopic ?? "",
      /kvadrat tenglama/i,
      "identifikatorsiz so'rov mustaqil ishlanishi kerak",
    );
  });
});

describe("multi-turn API — egalik va o'chirish", () => {
  it("boshqa foydalanuvchining suhbati 404 beradi (IDOR)", async () => {
    const owner = await signedInClient("mt-api-owner");
    const { conversationId } = await openConversation(owner);

    const intruder = await signedInClient("mt-api-intruder");
    const stolen = await intruder.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "misol ber", language: "UZ", conversationId },
    });

    /*
      404, 403 emas: «bunday suhbat bor, lekin sizniki emas» degan javob
      identifikator taxmin qilgan odamga boshqa o'qituvchining faoliyatini
      bildirardi.
    */
    assert.equal(stolen.status, 404);
  });

  it("mavjud bo'lmagan identifikator 404 beradi va kvotani yemaydi", async () => {
    const client = await signedInClient("mt-api-missing");

    for (let i = 0; i < 4; i++) {
      const res = await client.request<SearchPayload>("/api/search", {
        method: "POST",
        body: { question: "misol ber", language: "UZ", conversationId: "yoq-bunday-id" },
      });
      /*
        To'rt marta — kvota chegarasi (daqiqada 3) dan ko'p. Hammasi 404
        bo'lishi kerak: suhbat AI chaqiruvidan OLDIN tekshiriladi, ya'ni
        noto'g'ri identifikator o'qituvchining kvotasini yemaydi.
      */
      assert.equal(res.status, 404, `${i + 1}-urinish`);
    }
  });

  it("o'chirilgan suhbat davom ettirilmaydi", async () => {
    const client = await signedInClient("mt-api-delete");
    const { conversationId } = await openConversation(client);

    const deleted = await client.request<{ deleted: boolean }>(
      `/api/search/conversations/${conversationId}`,
      { method: "DELETE" },
    );
    assert.equal(deleted.status, 200);

    const follow = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "misol ber", language: "UZ", conversationId },
    });
    assert.equal(follow.status, 404);
  });
});
