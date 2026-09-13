import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { TestClient, cleanupTestUsers, findAiPrompt, testEmail } from "./helpers/client";
import { MARKER_BAD_SHAPE, MARKER_SERVER_ERROR } from "./helpers/mock-ai.ts";
import { text } from "./helpers/messages";

/**
 * AI qidiruv — uchidan-uchgacha.
 *
 * AI soxta server bilan almashtirilgan, qolgan hamma narsa haqiqiy:
 * route, tekshiruv, sessiya.
 *
 * ── Nega bu modulda "kutish" sinovi yo'q ──────────────────────────────────
 * Qolgan uch modul fon rejimida ishlaydi va `waitForGeneration` bilan
 * kuzatiladi. Qidiruv esa SINXRON: javob bir so'rovda qaytadi.
 */

const PASSWORD = "juda-maxfiy-parol";

interface SearchPayload {
  answer: {
    answer: string;
    keyPoints: string[];
    classroomIdeas: string[];
    caution?: string;
  };
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

before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

describe("qidiruv — muvaffaqiyatli yo'l", () => {
  it("savolga javob qaytaradi", async () => {
    const client = await signedInClient("qidiruv-asosiy");

    const result = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "Fotosintezni qanday tushuntiraman?", language: "UZ" },
    });

    assert.equal(result.status, 200, "sinxron javob kutilgan (202 emas)");
    const answer = result.data!.answer;

    assert.ok(answer.answer.length > 40);
    assert.ok(answer.keyPoints.length >= 3);
    assert.ok(answer.classroomIdeas.length >= 2);
  });

  it("fan va sinf BERILMASA ham ishlaydi", async () => {
    const client = await signedInClient("qidiruv-kontekstsiz");

    const result = await client.request<SearchPayload>("/api/search", {
      method: "POST",
      body: { question: "Kasrlar mavzusini qanday boshlasam bo'ladi?" },
    });

    assert.equal(result.status, 200);
    assert.ok(result.data!.answer.keyPoints.length >= 3);
  });

  it("fan va sinf berilsa ular AI so'roviga tushadi", async () => {
    const client = await signedInClient("qidiruv-kontekst");

    await client.request("/api/search", {
      method: "POST",
      body: {
        question: "Fotosintezni qanday tushuntiraman?",
        subject: "Biologiya",
        grade: "6-sinf",
        language: "UZ",
      },
    });

    // Soxta AI barcha promptlarni saqlaydi — kontekst yetib borganini
    // aynan shu yerdan tekshiramiz.
    const prompt = await findAiPrompt("Biologiya");
    assert.ok(prompt.user.includes("6-sinf"), "sinf promptga tushmagan");
  });
});

describe("qidiruv — xatolar", () => {
  it("kirmagan foydalanuvchini rad etadi", async () => {
    const anonymous = new TestClient();
    const result = await anonymous.request("/api/search", {
      method: "POST",
      body: { question: "Fotosintez nima?" },
    });

    assert.equal(result.status, 401);
  });

  it("juda qisqa savolni rad etadi va MAYDON xatosini qaytaradi", async () => {
    const client = await signedInClient("qidiruv-qisqa");

    const result = await client.request("/api/search", {
      method: "POST",
      body: { question: "a" },
    });

    assert.equal(result.status, 400);
    // Foydalanuvchi qaysi maydonni tuzatishini bilishi kerak.
    assert.ok(result.error!.fieldErrors?.question !== undefined);
    assert.equal(
      result.error!.fieldErrors!.question[0],
      text("uz", "errors.validation.questionTooShort"),
    );
  });

  it("AI yiqilsa TUSHUNARLI xato qaytaradi", async () => {
    const client = await signedInClient("qidiruv-ai-xato");

    const result = await client.request("/api/search", {
      method: "POST",
      body: { question: `Fotosintez nima? ${MARKER_SERVER_ERROR}` },
    });

    assert.equal(result.ok, false);
    // Foydalanuvchiga texnik matn ko'rsatilmaydi.
    assert.ok(!/AiError|status.?5\d\d|stack/i.test(result.error!.message));
    assert.ok(result.error!.message.length > 10);
  });

  it("AI sxemaga mos kelmaydigan javob bersa ham yiqilmaydi", async () => {
    const client = await signedInClient("qidiruv-sxema");

    const result = await client.request("/api/search", {
      method: "POST",
      body: { question: `Fotosintez nima? ${MARKER_BAD_SHAPE}` },
    });

    assert.equal(result.ok, false);
    assert.ok(!/zod|schema|parse/i.test(result.error!.message));
  });
});
