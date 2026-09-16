import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import JSZip from "jszip";
import {
  TestClient,
  cleanupTestUsers,
  clearAiPrompts,
  readAiPrompts,
  testEmail,
  waitForGeneration,
} from "./helpers/client";
import { text } from "./helpers/messages";

/**
 * Prezentatsiyani TAHRIRLASH — uchidan-uchgacha.
 *
 * ── Bu sinov nimaga javob beradi ──────────────────────────────────────────
 * Mahsulotning asosiy savoli: «o'qituvchi AI bergan natijani o'zi
 * tahrirlab, AI'ga QAYTA PUL TO'LAMASDAN yangi fayl olа oladimi?»
 *
 * Shuning uchun bu yerda faqat HTTP status tekshirilmaydi: soxta AI
 * serveriga yuborilgan promptlar SANALADI. Tahrir paytida ularning soni
 * o'zgarmasligi kerak — aks holda tejash haqidagi va'da yolg'on bo'lardi.
 */

const PASSWORD = "juda-maxfiy-parol";

interface PresentationPayload {
  presentation: {
    id: string;
    title: string | null;
    status: "PENDING" | "READY" | "FAILED";
    slideCount: number | null;
    fileSize: number | null;
    errorMessage: string | null;
    content: {
      title: string;
      slides: Array<{
        type: string;
        heading: string;
        bullets: string[];
        speakerNotes?: string;
        hidden?: boolean;
      }>;
    } | null;
  };
}

after(async () => {
  await cleanupTestUsers();
});

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

async function createReady(
  client: TestClient,
  topic = "Fotosintez",
): Promise<PresentationPayload["presentation"]> {
  const created = await client.request<PresentationPayload>("/api/presentations", {
    method: "POST",
    body: { mode: "standalone", topic },
  });
  assert.equal(created.status, 202);

  const ready = await waitForGeneration<PresentationPayload["presentation"]>(
    client,
    `/api/presentations/${created.data!.presentation.id}`,
    "presentation",
  );
  assert.equal(ready.status, "READY");
  assert.ok(ready.content, "generatsiya mazmunsiz tugadi");
  return ready;
}

/** Slaydlar ichidagi matnni .pptx faylidan o'qiydi. */
async function slideTextOf(client: TestClient, id: string): Promise<string> {
  const response = await client.fetchRaw(`/api/presentations/${id}/download`);
  assert.equal(response.status, 200);

  const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
  const slideFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );

  const parts = await Promise.all(
    slideFiles.map((name) => zip.file(name)!.async("string")),
  );
  return parts.join("\n");
}

describe("prezentatsiyani tahrirlash — asosiy oqim", () => {
  it("TAHRIR AI'ni QAYTA CHAQIRMAYDI", async () => {
    /*
      Mahsulotning butun va'dasi shu bitta tekshiruvda. Ilgari natijani
      o'zgartirishning yagona yo'li «qaytadan tayyorlash» edi va u
      har safar yangi AI so'rovi yuborardi.
    */
    const client = await signedInClient("pr-tahrir-ai");
    const created = await createReady(client, "AI chaqirilmasin");

    await clearAiPrompts();
    const before = (await readAiPrompts()).length;

    const edited = {
      ...created.content!,
      title: "Qo'lda tuzatilgan sarlavha",
    };

    const patched = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      { method: "PATCH", body: { content: edited } },
    );

    assert.equal(patched.status, 200);

    const after = (await readAiPrompts()).length;
    assert.equal(after, before, "tahrir paytida AI'ga so'rov yuborildi");
  });

  it("tahrirlangan matn YUKLAB OLINGAN faylga tushadi", async () => {
    const client = await signedInClient("pr-tahrir-fayl");
    const created = await createReady(client, "Faylga tushsin");

    const marker = "QOLDA-YOZILGAN-BAND-1742";
    const edited = {
      ...created.content!,
      slides: created.content!.slides.map((slide, index) =>
        index === 1 ? { ...slide, bullets: [marker] } : slide,
      ),
    };

    const patched = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      { method: "PATCH", body: { content: edited } },
    );
    assert.equal(patched.status, 200);

    const xml = await slideTextOf(client, created.id);
    assert.ok(xml.includes(marker), "tahrirlangan band .pptx faylida topilmadi");
  });

  it("slayd qo'shish faylda ham ko'rinadi", async () => {
    const client = await signedInClient("pr-tahrir-qoshish");
    const created = await createReady(client, "Slayd qo'shish");
    const oldCount = created.content!.slides.length;

    const edited = {
      ...created.content!,
      slides: [
        ...created.content!.slides,
        { type: "content", heading: "Yangi qo'shilgan slayd", bullets: ["Band"] },
      ],
    };

    const patched = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      { method: "PATCH", body: { content: edited } },
    );

    assert.equal(patched.status, 200);
    assert.equal(patched.data!.presentation.slideCount, oldCount + 1);
  });

  it("YASHIRILGAN slayd faylga tushmaydi, lekin yozuvda qoladi", async () => {
    const client = await signedInClient("pr-tahrir-yashirish");
    const created = await createReady(client, "Yashirish");

    const marker = "YASHIRILGAN-MATN-9931";
    const slides = created.content!.slides.map((slide, index) =>
      index === 1 ? { ...slide, heading: marker, hidden: true } : slide,
    );

    const patched = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      { method: "PATCH", body: { content: { ...created.content!, slides } } },
    );

    assert.equal(patched.status, 200);
    // Yozuvda saqlanadi — o'qituvchi fikridan qaytsa tiklay oladi.
    assert.ok(
      patched.data!.presentation.content!.slides.some((s) => s.hidden === true),
      "yashirilgan belgisi yozuvda saqlanmadi",
    );
    assert.equal(
      patched.data!.presentation.slideCount,
      created.content!.slides.length - 1,
    );

    const xml = await slideTextOf(client, created.id);
    assert.ok(!xml.includes(marker), "yashirilgan slayd faylga tushib qoldi");
  });

  it("sarlavha o'zgarishi RO'YXATDA ham ko'rinadi", async () => {
    // `title` ustuni alohida saqlanadi — tahrirda u ham yangilanishi kerak.
    const client = await signedInClient("pr-tahrir-royxat");
    const created = await createReady(client, "Ro'yxat sarlavhasi");

    const newTitle = "Butunlay yangi nom";
    await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: { ...created.content!, title: newTitle } },
    });

    const reloaded = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
    );
    assert.equal(reloaded.data!.presentation.title, newTitle);
  });

  it("fayl hajmi tahrirdan keyin YANGILANADI", async () => {
    const client = await signedInClient("pr-tahrir-hajm");
    const created = await createReady(client, "Hajm");

    const slides = [
      ...created.content!.slides,
      ...Array.from({ length: 5 }, (_, index) => ({
        type: "content" as const,
        heading: `Qo'shimcha ${index + 1}`,
        bullets: ["Uzunroq matn ".repeat(10).trim()],
      })),
    ];

    const patched = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      { method: "PATCH", body: { content: { ...created.content!, slides } } },
    );

    assert.equal(patched.status, 200);
    assert.ok(
      patched.data!.presentation.fileSize! > created.fileSize!,
      "fayl qayta yasalmagan — hajm o'zgarmadi",
    );
  });
});

describe("muharrir sahifasi", () => {
  /*
    API sinovlari oqimning yarmini tekshiradi. Bu blok qolgan yarmini:
    muharrir SAHIFASI haqiqatan render bo'ladimi, egalik server tomonida
    to'sadimi va tayyor bo'lmagan yozuv qayerga yuboriladimi.
  */

  it("egasiga ochiladi va slaydlar matni sahifada bo'ladi", async () => {
    const client = await signedInClient("pr-sahifa-ega");
    const created = await createReady(client, "Sahifa ochilsin");

    const response = await client.fetchRaw(`/dashboard/presentations/${created.id}/edit`);
    assert.equal(response.status, 200);

    const html = await response.text();
    // Birinchi slaydning sarlavhasi muharrirda ko'rinishi kerak.
    const heading = created.content!.slides[0].heading;
    assert.ok(
      html.includes(heading) || html.includes(heading.replaceAll("'", "&#x27;")),
      "slayd sarlavhasi muharrir sahifasida topilmadi",
    );
  });

  it("BOSHQA foydalanuvchiga MAZMUN berilmaydi", async () => {
    /*
      ── Nega bu yerda HOLAT KODI tekshirilmaydi ────────────────────────
      Dashboard sohasida `loading.tsx` bor, ya'ni Next javobni OQIM bilan
      yuboradi: sarlavha va "Yuklanmoqda" darhol ketadi (HTTP 200), sahifa
      mazmuni esa keyin qo'shiladi. `notFound()` shu bosqichda chaqirilsa,
      holat kodi allaqachon yuborilgan bo'ladi va uni o'zgartirib bo'lmaydi.

      Bu Phase 2 dan OLDIN ham shunday edi — barcha tafsilot sahifalarida.
      API esa to'g'ri 404 qaytaradi (yuqoridagi sinovlarga qarang).

      Xavfsizlik nuqtai nazaridan muhimi holat kodi emas, MAZMUN: begona
      foydalanuvchi yozuvning birorta bo'lagini ham olmasligi kerak.
      Aynan shu tekshiriladi.
    */
    const owner = await signedInClient("pr-sahifa-ega2");
    const stranger = await signedInClient("pr-sahifa-begona");

    const marker = "BEGONAGA-KORINMASIN-7741";
    const created = await createReady(owner, marker);

    const response = await stranger.fetchRaw(
      `/dashboard/presentations/${created.id}/edit`,
    );
    const html = await response.text();

    assert.ok(
      !html.includes(marker) && !html.includes(created.content!.slides[0].heading),
      "begona foydalanuvchiga yozuv mazmuni ko'rsatildi",
    );
    assert.ok(
      html.includes(text("uz", "notFoundPage.title")) ||
        html.includes(text("uz", "notFoundPage.title").replaceAll("'", "&#x27;")),
      "«topilmadi» ekrani ko'rsatilmadi",
    );
  });

  it("kirmagan foydalanuvchi /login ga yo'naltiriladi", async () => {
    const owner = await signedInClient("pr-sahifa-kirmagan");
    const created = await createReady(owner, "Kirish talab qilinadi");

    const anonymous = new TestClient();
    const visited = await anonymous.visit(`/dashboard/presentations/${created.id}/edit`);

    assert.equal(visited.status, 307);
    assert.ok(visited.location?.includes("/login"));
  });

  it("tafsilot sahifasida TAHRIRLASH havolasi bor", async () => {
    // Muharrir mavjud bo'lib, unga yo'l ko'rinmasligi — eng oson
    // sodir bo'ladigan nosozlik.
    const client = await signedInClient("pr-sahifa-havola");
    const created = await createReady(client, "Havola bo'lsin");

    const response = await client.fetchRaw(`/dashboard/presentations/${created.id}`);
    const html = await response.text();

    assert.match(
      html,
      new RegExp(`href="/dashboard/presentations/${created.id}/edit"`),
      "tafsilot sahifasida tahrirlash havolasi yo'q",
    );
  });
});

describe("prezentatsiyani tahrirlash — tekshiruvlar", () => {
  it("BUZUQ mazmunni rad etadi", async () => {
    const client = await signedInClient("pr-tahrir-buzuq");
    const created = await createReady(client);

    const result = await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: { title: "x", slides: [{ type: "video" }] } },
    });

    assert.equal(result.status, 400);
  });

  it("BO'SH slaydlar ro'yxatini rad etadi", async () => {
    const client = await signedInClient("pr-tahrir-bosh");
    const created = await createReady(client);

    const result = await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: { title: "Sarlavha", slides: [] } },
    });

    assert.equal(result.status, 400, "slaydsiz prezentatsiya qabul qilindi");
  });

  it("JUDA UZUN bandni rad etadi", async () => {
    const client = await signedInClient("pr-tahrir-uzun");
    const created = await createReady(client);

    const slides = created.content!.slides.map((slide, index) =>
      index === 0 ? { ...slide, bullets: ["x".repeat(500)] } : slide,
    );

    const result = await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: { ...created.content!, slides } },
    });

    assert.equal(result.status, 400);
  });

  it("NOTANISH maydonli tanani rad etadi", async () => {
    const client = await signedInClient("pr-tahrir-notanish");
    const created = await createReady(client);

    const result = await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: created.content, status: "READY" },
    });

    assert.equal(result.status, 400, "notanish maydon o'tkazib yuborildi");
  });

  it("kirmagan foydalanuvchini rad etadi", async () => {
    const client = await signedInClient("pr-tahrir-kirmagan");
    const created = await createReady(client);

    const anonymous = new TestClient();
    const result = await anonymous.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: created.content },
    });

    assert.equal(result.status, 401);
  });

  it("mavjud bo'lmagan yozuv uchun 404", async () => {
    const client = await signedInClient("pr-tahrir-yoq");

    const result = await client.request("/api/presentations/aaaaaaaaaaaaaaaaaaaaaaaa", {
      method: "PATCH",
      body: { content: { title: "Sarlavha", slides: [] } },
    });

    assert.ok(result.status === 404 || result.status === 400);
  });
});

describe("prezentatsiyani tahrirlash — egalik", () => {
  it("BOSHQA foydalanuvchi tahrirlay olmaydi (404)", async () => {
    /*
      Eng muhim xavfsizlik tekshiruvi: PATCH yozuvni O'ZGARTIRADI.
      403 emas, 404 — begona yozuvning mavjudligini ham oshkor qilmaymiz.
    */
    const owner = await signedInClient("pr-tahrir-ega");
    const stranger = await signedInClient("pr-tahrir-begona");

    const created = await createReady(owner, "Begona tegmasin");
    const original = created.content!.title;

    const attempt = await stranger.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: {
        content: { ...created.content!, title: "Buzib yuborildi" },
      },
    });

    assert.equal(attempt.status, 404, "403 emas, 404 bo'lishi kerak");

    // Yozuv TEGILMAGAN bo'lishi kerak.
    const reloaded = await owner.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
    );
    assert.equal(reloaded.data!.presentation.content!.title, original);
  });
});
