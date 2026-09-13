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
});
