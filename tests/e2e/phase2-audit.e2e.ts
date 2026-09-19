import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  BASE_URL,
  TestClient,
  cleanupTestUsers,
  clearAiPrompts,
  readAiPrompts,
  testEmail,
  waitForGeneration,
} from "./helpers/client";

/**
 * PHASE 2.1 — production'dan oldingi yakuniy audit.
 *
 * ── Bu fayl nima uchun ALOHIDA ────────────────────────────────────────────
 * `presentation-editing.e2e.ts` va `content-editing.e2e.ts` har bir
 * modulning O'Z oqimini tekshiradi. Bu yerda esa modullar KESIB o'tadigan
 * savollar: hujum yuklamalari, bir vaqtda kelgan so'rovlar, ma'lumot
 * yo'qolishi va fayl butunligi.
 *
 * Har bir sinov REAL dalil beradi: yuklab olingan fayl qayta ochiladi,
 * AI'ga yuborilgan so'rovlar sanaladi, katakcha formulasi o'qiladi.
 */

const PASSWORD = "juda-maxfiy-parol";

interface PresentationPayload {
  presentation: {
    id: string;
    title: string | null;
    status: "PENDING" | "READY" | "FAILED";
    slideCount: number | null;
    fileSize: number | null;
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

interface CalendarPayload {
  calendarPlan: {
    id: string;
    status: string;
    rowCount: number | null;
    content: {
      title: string;
      weeks: Array<{
        weekNumber: number;
        dateRange: string;
        topics: Array<{ name: string; hours: number; note?: string }>;
      }>;
    } | null;
  };
}

interface LessonPayload {
  lessonPlan: {
    id: string;
    status: string;
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

after(async () => {
  await cleanupTestUsers();
});

async function signedInClient(suffix: string): Promise<TestClient> {
  const client = new TestClient();
  const result = await client.request("/api/auth/register", {
    method: "POST",
    body: { email: testEmail(suffix), password: PASSWORD, fullName: "Audit O'qituvchi" },
  });
  assert.equal(result.status, 201);
  return client;
}

async function createPresentation(
  client: TestClient,
  topic = "Audit mavzusi",
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
  return ready;
}

async function createCalendar(
  client: TestClient,
): Promise<CalendarPayload["calendarPlan"]> {
  const created = await client.request<CalendarPayload>("/api/calendar-plans", {
    method: "POST",
    body: {
      subject: "Matematika",
      grade: "7-sinf",
      period: "Audit chorak",
      startDate: "2026-09-14",
      weeks: 3,
      hoursPerWeek: 2,
    },
  });
  assert.equal(created.status, 202);

  return waitForGeneration<CalendarPayload["calendarPlan"]>(
    client,
    `/api/calendar-plans/${created.data!.calendarPlan.id}`,
    "calendarPlan",
  );
}

async function createLessonPlan(
  client: TestClient,
): Promise<LessonPayload["lessonPlan"]> {
  const created = await client.request<LessonPayload>("/api/lesson-plans", {
    method: "POST",
    body: {
      subject: "Biologiya",
      grade: "7-sinf",
      topic: "Audit darsi",
      durationMinutes: 45,
    },
  });
  assert.equal(created.status, 202);

  return waitForGeneration<LessonPayload["lessonPlan"]>(
    client,
    `/api/lesson-plans/${created.data!.lessonPlan.id}`,
    "lessonPlan",
  );
}

/** .pptx dagi barcha slayd XML'ini qaytaradi. */
async function pptxSlideXml(client: TestClient, id: string): Promise<string[]> {
  const response = await client.fetchRaw(`/api/presentations/${id}/download`);
  assert.equal(response.status, 200, "yuklab olish ishlamadi");

  const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const n = (s: string) => Number(/slide(\d+)\.xml/.exec(s)![1]);
      return n(a) - n(b);
    });

  return Promise.all(names.map((name) => zip.file(name)!.async("string")));
}

// ════════════════════════════════════════════════════════════════════════════
// 4. AI CHAQIRUVI — bosqichma-bosqich sanash
// ════════════════════════════════════════════════════════════════════════════

describe("AUDIT: AI chaqiruvi bosqichma-bosqich", () => {
  /*
    Prezentatsiya quvuri IKKI marta AI'ga boradi — skelet (har slaydning
    vazifasi) va mazmun (matn), `lib/presentations/pipeline.ts`. Ilgari
    bitta chaqiruv edi va shu test uni 1 deb qulflagandi.

    Testning ASOSIY sharti o'zgarmadi: generatsiyadan KEYIN AI boshqa
    umuman chaqirilmaydi — tahrir ham, yuklab olish ham mavjud mazmun
    bilan ishlaydi.
  */
  const PRESENTATION_AI_CALLS = 2;

  it("prezentatsiya: generatsiya=2 (skelet+mazmun), tahrir=0, yana tahrir=0, yuklab olish=0", async () => {
    const client = await signedInClient("audit-ai-pr");

    await clearAiPrompts();
    const created = await createPresentation(client, "AI sanog'i");

    const afterGenerate = (await readAiPrompts()).length;
    assert.equal(
      afterGenerate,
      PRESENTATION_AI_CALLS,
      `generatsiyada ${afterGenerate} ta so'rov ketdi`,
    );

    // ── Tahrir 1 ──
    await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: { ...created.content!, title: "Birinchi tahrir" } },
    });
    assert.equal(
      (await readAiPrompts()).length,
      PRESENTATION_AI_CALLS,
      "tahrirda AI chaqirildi",
    );

    // ── Tahrir 2 ──
    await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: { ...created.content!, title: "Ikkinchi tahrir" } },
    });
    assert.equal(
      (await readAiPrompts()).length,
      PRESENTATION_AI_CALLS,
      "ikkinchi tahrirda AI chaqirildi",
    );

    // ── Yuklab olish ──
    const download = await client.fetchRaw(`/api/presentations/${created.id}/download`);
    assert.equal(download.status, 200);
    assert.equal(
      (await readAiPrompts()).length,
      PRESENTATION_AI_CALLS,
      "yuklab olishda AI chaqirildi",
    );
  });

  it("kalendar reja: generatsiya=1, tahrir=0, yana tahrir=0, yuklab olish=0", async () => {
    const client = await signedInClient("audit-ai-cal");

    await clearAiPrompts();
    const plan = await createCalendar(client);
    assert.equal(plan.status, "READY");

    const afterGenerate = (await readAiPrompts()).length;
    assert.equal(afterGenerate, 1, `generatsiyada ${afterGenerate} ta so'rov ketdi`);

    for (const title of ["Birinchi tahrir", "Ikkinchi tahrir"]) {
      await client.request(`/api/calendar-plans/${plan.id}`, {
        method: "PATCH",
        body: { content: { ...plan.content!, title } },
      });
    }
    assert.equal((await readAiPrompts()).length, 1, "tahrirda AI chaqirildi");

    const download = await client.fetchRaw(`/api/calendar-plans/${plan.id}/download`);
    assert.equal(download.status, 200);
    assert.equal((await readAiPrompts()).length, 1, "yuklab olishda AI chaqirildi");
  });

  it("dars ishlanmasi: generatsiya=1, tahrir=0, yana tahrir=0, eksport=0", async () => {
    const client = await signedInClient("audit-ai-lp");

    await clearAiPrompts();
    const plan = await createLessonPlan(client);
    assert.equal(plan.status, "READY");

    const afterGenerate = (await readAiPrompts()).length;
    assert.equal(afterGenerate, 1, `generatsiyada ${afterGenerate} ta so'rov ketdi`);

    for (const objective of ["Birinchi tahrirlangan maqsad", "Ikkinchi tahrir matni"]) {
      await client.request(`/api/lesson-plans/${plan.id}`, {
        method: "PATCH",
        body: { content: { ...plan.content!, objective } },
      });
    }
    assert.equal((await readAiPrompts()).length, 1, "tahrirda AI chaqirildi");

    const exported = await client.fetchRaw(`/api/lesson-plans/${plan.id}/export`);
    assert.equal(exported.status, 200);
    assert.equal((await readAiPrompts()).length, 1, "eksportda AI chaqirildi");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11. MA'LUMOT YO'QOLISHI
// ════════════════════════════════════════════════════════════════════════════

describe("AUDIT: ma'lumot yo'qolishi", () => {
  it("ketma-ket ikki tahrir — IKKALASI ham faylda qoladi", async () => {
    const client = await signedInClient("audit-yoqolish");
    const created = await createPresentation(client, "Ketma-ket tahrir");

    const MARKER_A = "TAHRIR-A-MARKER-4471";
    const MARKER_B = "TAHRIR-B-MARKER-8823";

    // ── Tahrir A: birinchi slaydning sarlavhasi ──
    const afterA = {
      ...created.content!,
      slides: created.content!.slides.map((slide, index) =>
        index === 0 ? { ...slide, heading: MARKER_A } : slide,
      ),
    };
    const patchA = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      { method: "PATCH", body: { content: afterA } },
    );
    assert.equal(patchA.status, 200);

    // ── Tahrir B: ikkinchi slaydning bandi — A ning USTIGA yozmaydi ──
    const current = patchA.data!.presentation.content!;
    const afterB = {
      ...current,
      slides: current.slides.map((slide, index) =>
        index === 1 ? { ...slide, bullets: [MARKER_B] } : slide,
      ),
    };
    const patchB = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      { method: "PATCH", body: { content: afterB } },
    );
    assert.equal(patchB.status, 200);

    const xml = (await pptxSlideXml(client, created.id)).join("\n");
    assert.ok(xml.includes(MARKER_A), "TAHRIR A faylda yo'q — ma'lumot yo'qoldi");
    assert.ok(xml.includes(MARKER_B), "TAHRIR B faylda yo'q — ma'lumot yo'qoldi");
  });

  it("15 slayd: tartib almashtirish, yashirish, nusxa va o'chirish — yo'qotishsiz", async () => {
    /*
      Auditdagi eng muhim regressiya sinovi. Ilgari `generatePptx`
      slaydlarni 10 tada kesardi — 10 dan keyingi hamma narsa JIM
      yo'qolardi.
    */
    const client = await signedInClient("audit-15-slayd");
    const created = await createPresentation(client, "O'n besh slayd");

    // 15 ta aniq belgilangan slayd quramiz.
    const slides = Array.from({ length: 15 }, (_, index) => ({
      type: index === 0 ? ("title" as const) : ("content" as const),
      heading: `SLAYD-BELGI-${String(index + 1).padStart(2, "0")}`,
      bullets: index === 0 ? [] : [`Band ${index + 1}`],
    }));

    const built = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      { method: "PATCH", body: { content: { title: "15 slayd", slides } } },
    );
    assert.equal(built.status, 200);
    assert.equal(built.data!.presentation.slideCount, 15, "15 slayd saqlanmadi");

    let xml = (await pptxSlideXml(client, created.id)).join("\n");
    for (let index = 1; index <= 15; index++) {
      const marker = `SLAYD-BELGI-${String(index).padStart(2, "0")}`;
      assert.ok(xml.includes(marker), `${marker} faylda yo'q — 10 ta kesish qaytdi`);
    }

    // ── Tartib almashtirish + yashirish + nusxa + o'chirish ──
    const current = built.data!.presentation.content!.slides;
    const reordered = [
      current[4], // 5-slayd birinchi o'ringa
      ...current.slice(0, 4),
      { ...current[5], hidden: true }, // 6-slayd yashirildi
      { ...current[6], bullets: [...current[6].bullets] }, // nusxa asli
      { ...current[6], heading: "NUSXA-SLAYD", bullets: [...current[6].bullets] },
      ...current.slice(7, 14), // 15-slayd (indeks 14) O'CHIRILDI
    ];

    const edited = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      { method: "PATCH", body: { content: { title: "15 slayd", slides: reordered } } },
    );
    assert.equal(edited.status, 200);

    const pages = await pptxSlideXml(client, created.id);
    xml = pages.join("\n");

    // Yashirilgani va o'chirilgani YO'Q, qolgani BOR.
    assert.ok(!xml.includes("SLAYD-BELGI-06"), "yashirilgan slayd faylga tushdi");
    assert.ok(!xml.includes("SLAYD-BELGI-15"), "o'chirilgan slayd faylda qoldi");
    assert.ok(xml.includes("NUSXA-SLAYD"), "nusxa olingan slayd faylda yo'q");
    for (const index of [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14]) {
      const marker = `SLAYD-BELGI-${String(index).padStart(2, "0")}`;
      assert.ok(xml.includes(marker), `${marker} yo'qoldi`);
    }

    // Tartib HAQIQATAN o'zgarganini tekshiramiz: birinchi slayd — 5-si.
    assert.ok(
      pages[0].includes("SLAYD-BELGI-05"),
      "tartib almashtirish faylda aks etmadi",
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. XAVFSIZLIK — in'yeksiya va buzuq yuklamalar
// ════════════════════════════════════════════════════════════════════════════

describe("AUDIT: in'yeksiya yuklamalari", () => {
  it("XML/HTML/skript matni .pptx ni BUZMAYDI", async () => {
    /*
      Office formatlari — XML. Tozalanmagan `<`, `&`, `]]>` fayl
      tuzilmasini buzishi mumkin edi. pptxgenjs matnni escape qiladi;
      bu sinov shuni ISBOTLAYDI — fayl qayta ochiladi.
    */
    const client = await signedInClient("audit-inyeksiya-pptx");
    const created = await createPresentation(client, "In'yeksiya sinovi");

    const payloads = [
      "<script>alert(1)</script>",
      "]]><!--<x>--><a:t>buzilgan</a:t>",
      "Matematikada 5 < 7 & 8 > 3",
      '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>',
      "&#x27;&amp;&lt;&gt;",
    ];

    const slides = payloads.map((payload, index) => ({
      type: "content" as const,
      heading: `In'yeksiya ${index + 1}`,
      bullets: [payload],
    }));

    const patched = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      { method: "PATCH", body: { content: { title: "In'yeksiya", slides } } },
    );
    assert.equal(patched.status, 200, "yuklama saqlanmadi");

    // Fayl QAYTA OCHILADI — buzilmaganini shu isbotlaydi.
    const pages = await pptxSlideXml(client, created.id);
    assert.equal(pages.length, payloads.length, "slaydlar soni mos emas — fayl buzuq");

    const xml = pages.join("\n");
    // Xom `<script>` XML'da TEG bo'lib turmasligi kerak (escape qilingan).
    assert.ok(!/<script>/i.test(xml), "skript tegi escape qilinmagan");
    // Lekin matn sifatida saqlanishi kerak.
    assert.ok(xml.includes("&lt;script&gt;"), "matn yo'qolib ketdi");
  });

  it("XLSX FORMULA in'yeksiyasi katakchada formula bo'lib QOLMAYDI", async () => {
    /*
      `=HYPERLINK(...)`, `@SUM(...)`, `+cmd|...` kabi matnlar Excel'da
      FORMULA sifatida bajarilishi mumkin (CSV/XLSX injection). Katakcha
      `value` sifatida oddiy matn yozilsa, ExcelJS uni formula deb
      belgilamaydi — bu sinov shuni tekshiradi.
    */
    const client = await signedInClient("audit-inyeksiya-xlsx");
    const plan = await createCalendar(client);
    assert.equal(plan.status, "READY");

    const payloads = [
      '=HYPERLINK("http://yomon.example","Bosing")',
      "@SUM(A1:A9)",
      "+1+1",
      "-1+1",
      "=cmd|'/c calc'!A1",
    ];

    const weeks = plan.content!.weeks.map((week, index) => ({
      ...week,
      topics:
        index === 0
          ? payloads.map((payload) => ({ name: payload, hours: 1 }))
          : week.topics,
    }));

    const patched = await client.request(`/api/calendar-plans/${plan.id}`, {
      method: "PATCH",
      body: { content: { ...plan.content!, weeks } },
    });
    assert.equal(patched.status, 200);

    const response = await client.fetchRaw(`/api/calendar-plans/${plan.id}/download`);
    assert.equal(response.status, 200);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const sheet = workbook.worksheets[0];

    const formulaCells: string[] = [];
    const foundPayloads = new Set<string>();

    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        const raw = cell.value;
        const asText =
          typeof raw === "object" && raw !== null && "formula" in raw
            ? `=${(raw as { formula: string }).formula}`
            : String(raw ?? "");

        if (typeof raw === "object" && raw !== null && "formula" in raw) {
          formulaCells.push(`R${rowNumber}C${colNumber}:${asText}`);
        }
        for (const payload of payloads) {
          if (asText === payload) foundPayloads.add(payload);
        }
      });
    });

    // Yuklamalar MATN sifatida saqlangan bo'lishi kerak.
    assert.equal(
      foundPayloads.size,
      payloads.length,
      `yuklamalar matn sifatida topilmadi: ${payloads.filter((p) => !foundPayloads.has(p)).join(", ")}`,
    );

    // Faylda FAQAT bizning "Jami" SUM formulamiz bo'lishi kerak.
    assert.equal(
      formulaCells.length,
      1,
      `kutilmagan formula katakchalari: ${formulaCells.join(" | ")}`,
    );
    assert.match(formulaCells[0], /SUM\(/, "Jami katakchasi SUM formulasi emas");
  });

  it("DOCX ga XML in'yeksiyasi hujjatni BUZMAYDI", async () => {
    const client = await signedInClient("audit-inyeksiya-docx");
    const plan = await createLessonPlan(client);
    assert.equal(plan.status, "READY");

    const payload = "</w:t></w:r></w:p><w:p><w:r><w:t>BUZILGAN-XML";
    const patched = await client.request(`/api/lesson-plans/${plan.id}`, {
      method: "PATCH",
      body: { content: { ...plan.content!, objective: `Maqsad: ${payload}` } },
    });
    assert.equal(patched.status, 200);

    const response = await client.fetchRaw(`/api/lesson-plans/${plan.id}/export`);
    assert.equal(response.status, 200);

    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    const documentXml = zip.file("word/document.xml");
    assert.ok(documentXml, "document.xml yo'q — hujjat buzuq");

    const xml = await documentXml.async("string");

    /*
      ── Nega bu yerda oddiy `includes` YETARLI EMAS ─────────────────────
      Dastlab bu sinov `!xml.includes("BUZILGAN-XML</w:t></w:r></w:p><w:p>")`
      deb yozilgan edi va u NOTO'G'RI yiqildi: matn tugagach kutubxonaning
      O'ZI run va paragrafni yopadi, ya'ni aynan shu ketma-ketlik
      MUTLAQO SOG'LOM hujjatda ham paydo bo'ladi.

      Haqiqiy xavfsizlik xususiyati boshqacha: yuklama `<w:t>` matn
      tugunidan CHIQIB KETMASLIGI kerak. Quyida barcha matn tugunlari
      ajratib olinadi va yuklama ularning BIRI ichida, to'liq escape
      qilingan holda turganini tekshiriladi.
    */
    const textNodes = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(
      (match) => match[1],
    );
    assert.ok(textNodes.length > 0, "hujjatda matn tugunlari yo'q");

    const escaped = payload
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

    const holder = textNodes.find((node) => node.includes(escaped));
    assert.ok(
      holder !== undefined,
      "yuklama escape qilingan holda matn tugunida topilmadi — XML'dan chiqib ketgan",
    );

    // Matn tugunining ichida XOM teg umuman bo'lmasligi kerak.
    assert.ok(!/<[a-zA-Z/]/.test(holder!), `matn tugunida xom teg qoldi: ${holder}`);

    // Hujjat tuzilmasi butun: bitta `<w:body>`, paragraflar muvozanatda.
    assert.equal(
      (xml.match(/<w:body>/g) ?? []).length,
      1,
      "w:body soni 1 emas — tuzilma buzuq",
    );
    assert.equal(
      (xml.match(/<w:p[ >]/g) ?? []).length,
      (xml.match(/<\/w:p>/g) ?? []).length,
      "paragraf teglari muvozanatda emas — XML buzilgan",
    );
  });
});

describe("AUDIT: buzuq va zararli yuklamalar", () => {
  it("prototip ifloslantirish yuklamasi rad etiladi yoki zararsizlanadi", async () => {
    const client = await signedInClient("audit-proto");
    const created = await createPresentation(client);

    const result = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
      {
        method: "PATCH",
        body: {
          content: {
            title: "Prototip sinovi",
            slides: [{ type: "content", heading: "Sarlavha", bullets: ["Band"] }],
            __proto__: { buzilgan: true },
            constructor: { prototype: { buzilgan: true } },
          },
        },
      },
    );

    /*
      Ikki natija ham MAQBUL: sxema notanish maydonni tashlab yuboradi
      (`content` ichi `.strict()` emas) yoki rad etadi. MUHIMI —
      `Object.prototype` ifloslanmasligi.
    */
    assert.ok(
      result.status === 200 || result.status === 400,
      `kutilmagan holat: ${result.status}`,
    );
    assert.equal(
      ({} as Record<string, unknown>).buzilgan,
      undefined,
      "Object.prototype IFLOSLANDI",
    );

    if (result.status === 200) {
      const saved = result.data!.presentation.content as Record<string, unknown>;
      assert.equal(saved.buzilgan, undefined);
    }
  });

  it("null va noto'g'ri turlar rad etiladi", async () => {
    const client = await signedInClient("audit-turlar");
    const created = await createPresentation(client);

    const bad: Array<{ nom: string; content: unknown }> = [
      { nom: "content null", content: null },
      { nom: "content massiv", content: [] },
      { nom: "content satr", content: "matn" },
      { nom: "slides obyekt", content: { title: "Sarlavha", slides: {} } },
      { nom: "slides null", content: { title: "Sarlavha", slides: null } },
      {
        nom: "bullets satr",
        content: {
          title: "Sarlavha",
          slides: [{ type: "content", heading: "H", bullets: "matn" }],
        },
      },
      {
        nom: "title raqam",
        content: { title: 42, slides: [{ type: "content", heading: "H", bullets: [] }] },
      },
    ];

    for (const { nom, content } of bad) {
      const result = await client.request(`/api/presentations/${created.id}`, {
        method: "PATCH",
        body: { content },
      });
      assert.equal(result.status, 400, `"${nom}" rad etilmadi (${result.status})`);
    }
  });

  it("HADDAN TASHQARI katta yuklama rad etiladi", async () => {
    const client = await signedInClient("audit-katta");
    const created = await createPresentation(client);

    // 30 dan ko'p slayd.
    const tooManySlides = Array.from({ length: 40 }, () => ({
      type: "content" as const,
      heading: "Slayd",
      bullets: ["Band"],
    }));
    const manyResult = await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: { title: "Ko'p", slides: tooManySlides } },
    });
    assert.equal(manyResult.status, 400, "40 slayd qabul qilindi");

    // Juda uzun sarlavha.
    const longResult = await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: {
        content: {
          title: "x".repeat(5000),
          slides: [{ type: "content", heading: "H", bullets: [] }],
        },
      },
    });
    assert.equal(longResult.status, 400, "5000 belgili sarlavha qabul qilindi");

    // Bitta slaydda 8 dan ko'p band.
    const manyBullets = await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: {
        content: {
          title: "Sarlavha",
          slides: [
            {
              type: "content",
              heading: "H",
              bullets: Array.from({ length: 30 }, (_, i) => `Band ${i}`),
            },
          ],
        },
      },
    });
    assert.equal(manyBullets.status, 400, "30 ta band qabul qilindi");
  });

  it("noto'g'ri shakldagi id uchun xato qaytadi, 500 EMAS", async () => {
    const client = await signedInClient("audit-id");

    for (const id of ["", "  ", "../../etc/passwd", "'; DROP TABLE--", "x".repeat(500)]) {
      const result = await client.request(
        `/api/presentations/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: {
            content: {
              title: "Sarlavha",
              slides: [{ type: "content", heading: "H", bullets: [] }],
            },
          },
        },
      );
      /*
        Bo'sh id `/api/presentations/` ga aylanadi va Next uni
        `/api/presentations` ga 308 bilan yo'naltiradi (oxirgi "/" ni
        normallashtirish). U yerda PATCH ishlovchisi yo'q, ya'ni so'rov
        hech qachon soxta id bilan servisga yetmaydi.

        Tekshiruvning MOHIYATI — server ichki xato (5xx) bermasligi va
        so'rov jim muvaffaqiyat bilan tugamasligi.
      */
      assert.ok(
        result.status < 500,
        `id="${id.slice(0, 20)}" uchun ${result.status} — server ichki xatosi`,
      );
      assert.notEqual(
        result.status,
        200,
        `id="${id.slice(0, 20)}" uchun so'rov MUVAFFAQIYATLI tugadi`,
      );
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. AUTENTIFIKATSIYA VA SESSIYA
// ════════════════════════════════════════════════════════════════════════════

describe("AUDIT: autentifikatsiya", () => {
  it("kirmagan foydalanuvchi uchala PATCH'da ham 401", async () => {
    const owner = await signedInClient("audit-auth-ega");
    const presentation = await createPresentation(owner);
    const calendar = await createCalendar(owner);
    const lesson = await createLessonPlan(owner);

    const anonymous = new TestClient();

    for (const [path, content] of [
      [`/api/presentations/${presentation.id}`, presentation.content],
      [`/api/calendar-plans/${calendar.id}`, calendar.content],
      [`/api/lesson-plans/${lesson.id}`, lesson.content],
    ] as const) {
      const result = await anonymous.request(path, {
        method: "PATCH",
        body: { content },
      });
      assert.equal(result.status, 401, `${path} → ${result.status}`);
    }
  });

  it("BUZUQ sessiya cookie'si bilan 401", async () => {
    const owner = await signedInClient("audit-buzuq-sessiya");
    const created = await createPresentation(owner);

    const response = await fetch(`${BASE_URL}/api/presentations/${created.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: "searcher_session=buzuq.token.qiymati",
      },
      body: JSON.stringify({ content: created.content }),
      redirect: "manual",
    });

    assert.equal(response.status, 401);
  });

  it("CHIQIB KETGANDAN keyin tahrirlab bo'lmaydi", async () => {
    const client = await signedInClient("audit-chiqish");
    const created = await createPresentation(client);

    await client.request("/api/auth/logout", { method: "POST" });

    const result = await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: created.content },
    });
    assert.equal(result.status, 401, "chiqqandan keyin ham tahrirlash mumkin");
  });

  it("begona Origin bilan PATCH rad etiladi (CSRF)", async () => {
    const client = await signedInClient("audit-csrf");
    const created = await createPresentation(client);

    const jar = (client as unknown as { cookies: Map<string, string> }).cookies;
    const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

    const response = await fetch(`${BASE_URL}/api/presentations/${created.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: "https://yomon.example",
      },
      body: JSON.stringify({ content: created.content }),
      redirect: "manual",
    });

    assert.equal(response.status, 403, "begona Origin'dan PATCH o'tdi");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// BIR VAQTDA KELGAN SO'ROVLAR
// ════════════════════════════════════════════════════════════════════════════

describe("AUDIT: bir vaqtda kelgan tahrirlar", () => {
  it("bir vaqtda 5 ta PATCH — hammasi javob beradi, yozuv BUTUN qoladi", async () => {
    /*
      Oxirgi yozuvchi yutadi (last-write-wins) — bu MVP uchun to'g'ri
      qaror, chunki bitta o'qituvchi bitta yozuvni tahrirlaydi. Muhimi:
      hech biri 500 bermasin va natija YAROQLI bo'lsin (yarim yozilgan
      mazmun yoki buzuq fayl qolmasin).
    */
    const client = await signedInClient("audit-parallel");
    const created = await createPresentation(client, "Parallel tahrir");

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        client.request<PresentationPayload>(`/api/presentations/${created.id}`, {
          method: "PATCH",
          body: {
            content: {
              ...created.content!,
              title: `Parallel ${index}`,
            },
          },
        }),
      ),
    );

    for (const [index, result] of results.entries()) {
      assert.ok(
        result.status === 200 || result.status === 409,
        `${index}-so'rov ${result.status} qaytardi (500 bo'lmasligi kerak)`,
      );
    }

    // Yozuv o'qilishi va mazmuni YAROQLI bo'lishi kerak.
    const reloaded = await client.request<PresentationPayload>(
      `/api/presentations/${created.id}`,
    );
    assert.equal(reloaded.status, 200);
    assert.ok(reloaded.data!.presentation.content, "mazmun buzildi");
    assert.match(reloaded.data!.presentation.title!, /^Parallel \d$/);

    // Fayl ham yaroqli bo'lishi kerak.
    const pages = await pptxSlideXml(client, created.id);
    assert.ok(pages.length > 0, "parallel yozuvdan keyin fayl buzuq");
  });

  it("takroriy PATCH ketma-ket 10 marta — barqaror", async () => {
    const client = await signedInClient("audit-takror");
    const created = await createPresentation(client, "Takror");

    for (let index = 0; index < 10; index++) {
      const result = await client.request(`/api/presentations/${created.id}`, {
        method: "PATCH",
        body: { content: { ...created.content!, title: `Takror ${index}` } },
      });
      assert.equal(result.status, 200, `${index}-takrorda ${result.status}`);
    }

    const pages = await pptxSlideXml(client, created.id);
    assert.ok(pages.length > 0, "10 ta tahrirdan keyin fayl buzuq");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. FAYL BUTUNLIGI
// ════════════════════════════════════════════════════════════════════════════

describe("AUDIT: fayl butunligi", () => {
  it("PPTX — arxiv ochiladi, majburiy qismlar joyida", async () => {
    const client = await signedInClient("audit-fayl-pptx");
    const created = await createPresentation(client, "Butunlik");

    await client.request(`/api/presentations/${created.id}`, {
      method: "PATCH",
      body: { content: { ...created.content!, title: "Tahrirlangan butunlik" } },
    });

    const response = await client.fetchRaw(`/api/presentations/${created.id}/download`);
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type") ?? "",
      /presentationml\.presentation/,
      "MIME turi noto'g'ri",
    );

    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    for (const required of [
      "[Content_Types].xml",
      "ppt/presentation.xml",
      "_rels/.rels",
    ]) {
      assert.ok(zip.file(required), `${required} yo'q — .pptx buzuq`);
    }
  });

  it("XLSX — ish kitobi ochiladi, SUM formulasi joyida", async () => {
    const client = await signedInClient("audit-fayl-xlsx");
    const plan = await createCalendar(client);
    assert.equal(plan.status, "READY");

    const marker = "BUTUNLIK-MAVZUSI-3312";
    const weeks = plan.content!.weeks.map((week, index) =>
      index === 0 ? { ...week, topics: [{ name: marker, hours: 3 }] } : week,
    );
    const patched = await client.request(`/api/calendar-plans/${plan.id}`, {
      method: "PATCH",
      body: { content: { ...plan.content!, weeks } },
    });
    assert.equal(patched.status, 200);

    const response = await client.fetchRaw(`/api/calendar-plans/${plan.id}/download`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());

    assert.ok(workbook.worksheets.length > 0, "ish varag'i yo'q");
    const sheet = workbook.worksheets[0];

    let markerFound = false;
    let sumFormula: string | null = null;

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const raw = cell.value;
        if (String(raw ?? "").includes(marker)) markerFound = true;
        if (typeof raw === "object" && raw !== null && "formula" in raw) {
          sumFormula = (raw as { formula: string }).formula;
        }
      });
    });

    assert.ok(markerFound, "tahrirlangan mavzu katakchada yo'q");
    assert.ok(sumFormula, "«Jami» qatori formula EMAS — tayyor son yozilgan");
    assert.match(sumFormula!, /^SUM\(/, `kutilmagan formula: ${sumFormula}`);
  });

  it("DOCX — hujjat ochiladi, tahrirlangan matn joyida", async () => {
    const client = await signedInClient("audit-fayl-docx");
    const plan = await createLessonPlan(client);
    assert.equal(plan.status, "READY");

    const marker = "BUTUNLIK-MAQSADI-7788";
    await client.request(`/api/lesson-plans/${plan.id}`, {
      method: "PATCH",
      body: { content: { ...plan.content!, objective: marker } },
    });

    const response = await client.fetchRaw(`/api/lesson-plans/${plan.id}/export`);
    assert.equal(response.status, 200);

    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    assert.ok(zip.file("[Content_Types].xml"), "[Content_Types].xml yo'q");
    assert.ok(zip.file("word/document.xml"), "word/document.xml yo'q");

    const xml = await zip.file("word/document.xml")!.async("string");
    assert.ok(xml.includes(marker), "tahrirlangan maqsad hujjatda yo'q");
    assert.match(xml, /<w:document/, "document.xml ildiz tegi yo'q");
  });
});
