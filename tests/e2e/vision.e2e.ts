import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  TestClient,
  cleanupTestUsers,
  findAiPrompt,
  testEmail,
  waitForGeneration,
} from "./helpers/client";
import { text } from "./helpers/messages";

/**
 * Rasm tahlili — uchidan-uchgacha.
 *
 * AI soxta server bilan almashtirilgan; rasm validatsiyasi, kvota,
 * egalik va xato holatlari haqiqiy.
 */

const PASSWORD = "juda-maxfiy-parol";

interface VisionPayload {
  analysis: {
    description: string;
    subject: string;
    grade: string;
    topic: string;
    keyContent: string[];
    usable: boolean;
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

/** Haqiqiy PNG imzosi bilan boshlanadigan kichik rasm. */
function pngDataUri(sizeBytes = 512): string {
  const buffer = Buffer.alloc(sizeBytes, 0);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

describe("rasm tahlili — muvaffaqiyatli yo'l", () => {
  it("rasmni tahlil qilib natija qaytaradi", async () => {
    const client = await signedInClient("vision-asosiy");

    const result = await client.request<VisionPayload>("/api/vision-analyze", {
      method: "POST",
      body: { image: pngDataUri(), language: "UZ" },
    });

    assert.equal(result.status, 200, "sinxron javob kutilgan");
    const analysis = result.data!.analysis;

    assert.ok(analysis.description.length > 30);
    assert.ok(analysis.keyContent.length >= 2);
    assert.equal(analysis.usable, true);
    assert.ok(analysis.topic.length > 0);
  });

  it("JPEG ham qabul qilinadi", async () => {
    const client = await signedInClient("vision-jpeg");

    const buffer = Buffer.alloc(512, 0);
    buffer.set([0xff, 0xd8, 0xff, 0xe0], 0);

    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: `data:image/jpeg;base64,${buffer.toString("base64")}` },
    });

    assert.equal(result.status, 200);
  });

  it("fan va sinf berilsa ular AI so'roviga tushadi", async () => {
    const client = await signedInClient("vision-kontekst");

    await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: pngDataUri(), subject: "Geografiya", grade: "8-sinf" },
    });

    const prompt = await findAiPrompt("Geografiya");
    assert.ok(prompt.user.includes("8-sinf"), "sinf promptga tushmagan");

    // Rasmning O'ZI matn promptida bo'lmasligi kerak — u alohida
    // kanal orqali ketadi.
    assert.ok(!prompt.user.includes("base64"), "rasm matn promptiga tushib qolgan");

    // Lekin rasm HAQIQATAN yuborilgan bo'lishi kerak: busiz model
    // faqat matnli ishoralarga qarab "tahlil" qilardi.
    assert.equal(prompt.imageCount, 1, "rasm AI so'roviga biriktirilmagan");
  });
});

describe("rasm tahlili — tekshiruvlar", () => {
  it("kirmagan foydalanuvchini rad etadi", async () => {
    const anonymous = new TestClient();
    const result = await anonymous.request("/api/vision-analyze", {
      method: "POST",
      body: { image: pngDataUri() },
    });

    assert.equal(result.status, 401);
  });

  it("NOTO'G'RI formatni rad etadi (PDF)", async () => {
    const client = await signedInClient("vision-format");

    // "%PDF" bilan boshlanadi — rasm emas.
    const pdf = Buffer.from("%PDF-1.7 soxta hujjat", "utf8");
    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: `data:image/png;base64,${pdf.toString("base64")}` },
    });

    assert.equal(result.status, 400);
    assert.equal(
      result.error!.message,
      text("uz", "errors.validation.imageFormatNotSupported"),
    );
  });

  it("YOLG'ON e'lon qilingan turga aldanmaydi", async () => {
    /*
      Eng muhim tekshiruv: so'rovda "image/png" deb yozilgan, lekin
      ichida bajariladigan fayl. `mimeType` foydalanuvchi yozadigan
      qiymat — unga ishonib bo'lmaydi.
    */
    const client = await signedInClient("vision-yolgon");

    const executable = Buffer.alloc(256, 0);
    executable.set([0x4d, 0x5a, 0x90, 0x00], 0); // "MZ" — .exe

    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: `data:image/png;base64,${executable.toString("base64")}` },
    });

    assert.equal(result.status, 400);
  });

  it("JUDA KATTA rasmni rad etadi", async () => {
    const client = await signedInClient("vision-katta");

    // 5 MB chegarasidan oshadi, lekin 8 MB satr chegarasidan past —
    // ya'ni bayt bo'yicha tekshiruv ishlashi kerak.
    const big = Buffer.alloc(5 * 1024 * 1024 + 1024, 0);
    big.set([0x89, 0x50, 0x4e, 0x47], 0);

    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: `data:image/png;base64,${big.toString("base64")}` },
    });

    assert.equal(result.status, 400);
    assert.equal(result.error!.message, text("uz", "errors.validation.imageTooLarge"));
  });

  it("data URI bo'lmagan satrni rad etadi", async () => {
    const client = await signedInClient("vision-notogri-uri");

    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: "shunchaki matn, rasm emas" },
    });

    assert.equal(result.status, 400);
  });

  it("BO'SH rasmni rad etadi", async () => {
    const client = await signedInClient("vision-bosh");

    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: "" },
    });

    assert.equal(result.status, 400);
    assert.ok(result.error!.fieldErrors?.image !== undefined);
  });
});

describe("rasm tahlili — dars ishlanmasiga ulanish", () => {
  it("rasmdan olingan matn PROMPTGA qo'shiladi", async () => {
    const client = await signedInClient("vision-ulanish");

    const marker = "RASMDAN-OLINGAN-MATN";

    const created = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          topic: "Kasrlarni qo'shish",
          durationMinutes: 45,
          lessonType: "NEW_TOPIC",
          language: "UZ",
          sourceMaterial: `${marker}: umumiy maxrajga keltirish qoidasi.`,
        },
      },
    );
    assert.equal(created.status, 202);

    /*
      Generatsiya FON rejimida ishlaydi: 202 javobi AI chaqirilganini
      bildirmaydi. Promptni tekshirishdan oldin ish tugashini kutamiz —
      aks holda sinov vaqtga bog'liq (flaky) bo'lardi.
    */
    await waitForGeneration(
      client,
      `/api/lesson-plans/${created.data!.lessonPlan.id}`,
      "lessonPlan",
    );

    const prompt = await findAiPrompt(marker);
    assert.ok(
      prompt.user.includes("umumiy maxrajga keltirish"),
      "manba matni promptga tushmagan",
    );
  });

  it("manba matni BO'LMASA oqim o'zgarishsiz ishlaydi", async () => {
    // Eng muhim kafolat: yangi maydon eski oqimni buzmasligi kerak.
    const client = await signedInClient("vision-manbasiz");

    const result = await client.request<{ lessonPlan: { id: string } }>(
      "/api/lesson-plans",
      {
        method: "POST",
        body: {
          subject: "Matematika",
          grade: "7-sinf",
          topic: "Manbasiz oddiy dars",
          durationMinutes: 45,
          lessonType: "NEW_TOPIC",
          language: "UZ",
        },
      },
    );

    assert.equal(result.status, 202);

    await waitForGeneration(
      client,
      `/api/lesson-plans/${result.data!.lessonPlan.id}`,
      "lessonPlan",
    );

    const prompt = await findAiPrompt("Manbasiz oddiy dars");
    // Manba bo'limi umuman paydo bo'lmasligi kerak.
    assert.ok(
      !prompt.user.includes("MANBA MATERIALI"),
      "manba bo'limi bo'sh bo'lsa ham qo'shilgan",
    );
  });

  it("TOKEN o'lchovi kvota yozuviga YOZILADI", async () => {
    /*
      Rasm so'rovi eng qimmat chaqiruvlardan: bitta surat minglab
      token yeydi. Shunga qaramay o'lchov umuman yozilmasdi —
      `AiRequest` dagi "vision" qatorlari bo'sh model va bo'sh token
      bilan turardi.
    */
    const { client, email } = await signedInClientWithEmail("rasm-token");

    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: pngDataUri(), language: "UZ" },
    });
    assert.equal(result.status, 200);

    const { prisma } = await import("../../lib/db");
    const row = await prisma.aiRequest.findFirstOrThrow({
      where: { user: { email }, route: "vision" },
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
 * Soxta AI serveriga: keyingi RASM so'roviga xato qaytar.
 *
 * Nega belgi (marker) emas: belgilar prompt ichida uzatiladi, rasm
 * tahlilining promptida esa erkin matn yo'q — faqat fan va sinf, ikkalasi
 * ham enum. Batafsil: tests/e2e/helpers/mock-ai.ts → `failNextVision`.
 */
async function failNextVisionRequest(): Promise<void> {
  const baseUrl = process.env.AI_BASE_URL;
  if (baseUrl === undefined) {
    throw new Error("AI_BASE_URL sozlanmagan — globalSetup ishga tushmaganmi?");
  }
  const response = await fetch(`${baseUrl}/__vision-fail`, { method: "POST" });
  assert.equal(response.status, 204);
}

/**
 * Kvota shartnomasi — generatsiya modullaridagi bilan bir xil
 * (`tests/e2e/generation-lifecycle.e2e.ts` → "kvota qaytarilishi").
 *
 * Bandlik AI chaqiruvidan OLDIN olinadi (parallel so'rovlar chegarani
 * chetlab o'tmasligi uchun), shuning uchun MUVAFFAQIYATSIZLIKDA u
 * qaytarilishi shart. Aks holda rad etilgan so'rov o'qituvchining
 * daqiqalik uchta so'rovidan bittasini bekorga yeb qo'yadi.
 */
describe("rasm tahlili — kvota qaytarilishi", () => {
  it("MUVAFFAQIYATLI tahlil kvotani SARFLAYDI", async () => {
    /*
      Teskari tomoni ham muhim: qaytarish mantig'i muvaffaqiyatli
      so'rovni ham o'chirib yuborsa, cheklov umuman ishlamay qolardi.
    */
    const { client, email } = await signedInClientWithEmail("kvota-muvaffaqiyat");

    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: pngDataUri(), language: "UZ" },
    });

    assert.equal(result.status, 200);
    assert.equal(await quotaUsed(email), 1, "muvaffaqiyatda kvota sarflanmadi");
  });

  it("JUDA KATTA rasm kvotani YEMAYDI", async () => {
    /*
      Hajm tekshiruvi `analyzeImage()` ICHIDA, ya'ni bandlik
      olingandan KEYIN ishlaydi. AI esa umuman chaqirilmaydi —
      demak sarflanadigan narsa yo'q.
    */
    const { client, email } = await signedInClientWithEmail("kvota-katta");

    const big = Buffer.alloc(5 * 1024 * 1024 + 1024, 0);
    big.set([0x89, 0x50, 0x4e, 0x47], 0);

    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: `data:image/png;base64,${big.toString("base64")}` },
    });

    assert.equal(result.status, 400);
    assert.equal(await quotaUsed(email), 0, "rad etilgan so'rov kvotani yedi");
  });

  it("NOTO'G'RI FORMAT ham kvotani YEMAYDI", async () => {
    const { client, email } = await signedInClientWithEmail("kvota-format");

    const pdf = Buffer.from("%PDF-1.4 soxta hujjat");

    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: `data:image/png;base64,${pdf.toString("base64")}` },
    });

    assert.equal(result.status, 400);
    assert.equal(await quotaUsed(email), 0, "rad etilgan so'rov kvotani yedi");
  });

  it("PROVAYDER XATOSIDA kvota QAYTARILADI", async () => {
    /*
      Eng og'rituvchi holat: provayder uzilgan paytda o'qituvchi uch
      marta urinadi, uchalasi ham yiqiladi va u BIR DAQIQAGA
      bloklanadi — o'z aybisiz.
    */
    const { client, email } = await signedInClientWithEmail("kvota-provayder");

    await failNextVisionRequest();

    const result = await client.request("/api/vision-analyze", {
      method: "POST",
      body: { image: pngDataUri(), language: "UZ" },
    });

    assert.ok(
      result.status >= 500,
      `kutilgan provayder xatosi, kelgani: ${result.status}`,
    );
    assert.equal(await quotaUsed(email), 0, "provayder xatosida kvota qaytarilmadi");
  });
});
