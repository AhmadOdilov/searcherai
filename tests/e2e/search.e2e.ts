import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { TestClient, cleanupTestUsers, findAiPrompt, testEmail } from "./helpers/client";
import {
  MARKER_BAD_SHAPE,
  MARKER_NOT_JSON,
  MARKER_SERVER_ERROR,
} from "./helpers/mock-ai.ts";
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
  const { client } = await signedInClientWithEmail(suffix);
  return client;
}

/** Kvota yozuvlarini tekshirish uchun email ham kerak bo'ladi. */
async function signedInClientWithEmail(
  suffix: string,
): Promise<{ client: TestClient; email: string }> {
  const client = new TestClient();
  const email = testEmail(suffix);
  const result = await client.request("/api/auth/register", {
    method: "POST",
    body: {
      email,
      password: PASSWORD,
      fullName: "Sinov O'qituvchi",
    },
  });
  assert.equal(result.status, 201);
  return { client, email };
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

  it("TOKEN o'lchovi kvota yozuviga YOZILADI", async () => {
    /*
      Generatsiya modullari o'lchovni allaqachon yozardi, qidiruv va
      rasm tahlili esa yozmasdi: `AiRequest` dagi "search" qatorlari
      bo'sh model va bo'sh token bilan turardi. Ya'ni eng ko'p
      chaqiriladigan ikki yo'lning narxi noma'lum edi.
    */
    const { client, email } = await signedInClientWithEmail("qidiruv-token");

    const result = await client.request("/api/search", {
      method: "POST",
      body: { question: "Fotosintez nima va u qanday kechadi?" },
    });
    assert.equal(result.status, 200);

    const { prisma } = await import("../../lib/db");
    const row = await prisma.aiRequest.findFirstOrThrow({
      where: { user: { email }, route: "search" },
      select: { model: true, inputTokens: true, outputTokens: true },
    });

    assert.ok(row.model !== null, "model yozilmadi");
    assert.ok(
      row.inputTokens !== null && row.inputTokens > 0,
      `kirish tokenlari yozilmadi: ${row.inputTokens}`,
    );
    assert.ok(
      row.outputTokens !== null && row.outputTokens > 0,
      `chiqish tokenlari yozilmadi: ${row.outputTokens}`,
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Kvota qaytarilishi
// ════════════════════════════════════════════════════════════════════════════

/**
 * Foydalanuvchining joriy oynadagi kvota yozuvlari soni.
 *
 * `consumeAiQuota()` aynan shu sonni sanaydi (60 s oyna), ya'ni bu
 * o'lchov "o'qituvchi yana nechta so'rov yubora oladi" degan savolga
 * to'g'ridan-to'g'ri javob beradi.
 */
async function quotaUsed(email: string): Promise<number> {
  const { prisma } = await import("../../lib/db");
  return prisma.aiRequest.count({
    where: { user: { email }, createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
}

/**
 * Kvota shartnomasi — generatsiya modullari va rasm tahlilidagi bilan
 * bir xil (`tests/e2e/generation-lifecycle.e2e.ts`, `vision.e2e.ts`).
 *
 * Bandlik AI chaqiruvidan OLDIN olinadi (parallel so'rovlar chegarani
 * chetlab o'tmasligi uchun), shuning uchun MUVAFFAQIYATSIZLIKDA u
 * qaytarilishi shart: javob kelmagan bo'lsa, o'qituvchi daqiqalik
 * uchta so'rovidan bittasini bekorga yo'qotmasligi kerak.
 *
 * ── Nega TIMEOUT uchun alohida sinov yo'q ─────────────────────────────────
 * Timeout `generateJson()` dan `AiError({ kind: "aborted" })` bo'lib
 * chiqadi — ya'ni provayder xatosi va sxema xatosi bilan AYNI yo'ldan,
 * `runSearch()` ni rad etish orqali. Uni sinash uchun `AI_TIMEOUT_MS`
 * ni butun to'plam uchun tushirish kerak bo'lardi (soxta serverning
 * kechikishi 3 s, chegara esa 15 s) — bu qolgan sinovlarni
 * beqarorlashtirardi. Shu sababli shu yerda uchta BOSHQA-BOSHQA xato
 * turi qamrab olingan, ularning hammasi o'sha yo'ldan o'tadi.
 */
describe("qidiruv — kvota qaytarilishi", () => {
  it("MUVAFFAQIYATLI qidiruv kvotani SARFLAYDI", async () => {
    /*
      Teskari tomoni ham muhim: qaytarish mantig'i muvaffaqiyatli
      so'rovni ham o'chirib yuborsa, cheklov umuman ishlamay qolardi.
    */
    const { client, email } = await signedInClientWithEmail("kvota-qidiruv-ok");

    const result = await client.request("/api/search", {
      method: "POST",
      body: { question: "Bug'lanish va kondensatsiya qanday farq qiladi?" },
    });

    assert.equal(result.status, 200);
    assert.equal(await quotaUsed(email), 1, "muvaffaqiyatda kvota sarflanmadi");
  });

  it("PROVAYDER XATOSIDA kvota QAYTARILADI", async () => {
    /*
      Eng og'rituvchi holat: provayder uzilgan paytda o'qituvchi uch
      marta urinadi, uchalasi ham yiqiladi va u BIR DAQIQAGA
      bloklanadi — o'z aybisiz.
    */
    const { client, email } = await signedInClientWithEmail("kvota-qidiruv-provayder");

    const result = await client.request("/api/search", {
      method: "POST",
      body: { question: `Fotosintez qanday kechadi? ${MARKER_SERVER_ERROR}` },
    });

    assert.equal(result.ok, false);
    assert.equal(await quotaUsed(email), 0, "provayder xatosida kvota qaytarilmadi");
  });

  it("SXEMA XATOSIDA kvota QAYTARILADI", async () => {
    const { client, email } = await signedInClientWithEmail("kvota-qidiruv-sxema");

    const result = await client.request("/api/search", {
      method: "POST",
      body: { question: `Fotosintez qanday kechadi? ${MARKER_BAD_SHAPE}` },
    });

    assert.equal(result.ok, false);
    assert.equal(await quotaUsed(email), 0, "sxema xatosida kvota qaytarilmadi");
  });

  it("JSON BO'LMAGAN javobda ham kvota QAYTARILADI", async () => {
    const { client, email } = await signedInClientWithEmail("kvota-qidiruv-json");

    const result = await client.request("/api/search", {
      method: "POST",
      body: { question: `Fotosintez qanday kechadi? ${MARKER_NOT_JSON}` },
    });

    assert.equal(result.ok, false);
    assert.equal(await quotaUsed(email), 0, "buzuq javobda kvota qaytarilmadi");
  });
});
