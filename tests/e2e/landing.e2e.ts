import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { BASE_URL, TestClient, cleanupTestUsers, testEmail } from "./helpers/client";
import { htmlIncludes, text } from "./helpers/messages";

/**
 * Bosh sahifa (tanishtiruv sahifasi) — uchidan-uchgacha.
 *
 * Ikki holat tekshiriladi, ikkalasi ham teng muhim:
 *  1. KIRMAGAN odam — sahifa to'liq render bo'ladi (sarlavha, to'rtta
 *     funksiya, uch qadam, ikkala tugma);
 *  2. KIRGAN odam — sahifa umuman ko'rsatilmaydi, `/dashboard` ga
 *     yo'naltiriladi.
 */

const PASSWORD = "juda-maxfiy-parol";

after(async () => {
  await cleanupTestUsers();
});

async function fetchLanding(): Promise<{ status: number; html: string }> {
  const response = await fetch(`${BASE_URL}/`, { redirect: "manual" });
  return { status: response.status, html: await response.text() };
}

describe("bosh sahifa — kirmagan foydalanuvchi", () => {
  it("sarlavha va ikkala tugma ko'rinadi", async () => {
    const { status, html } = await fetchLanding();

    assert.equal(status, 200, "kirmagan odamga sahifa ochilishi kerak");
    assert.ok(htmlIncludes(html, text("uz", "landing.headline.lead")), "sarlavha yo'q");
    assert.ok(
      htmlIncludes(html, text("uz", "landing.headline.accent")),
      "sarlavhaning rangli qismi yo'q",
    );
    assert.ok(htmlIncludes(html, text("uz", "landing.start")), "«Boshlash» tugmasi yo'q");
    assert.ok(htmlIncludes(html, text("uz", "landing.login")), "«Kirish» tugmasi yo'q");

    // Tugmalar aynan ro'yxatdan o'tish va kirish sahifalariga olib borsin.
    assert.match(html, /href="\/register"/);
    assert.match(html, /href="\/login"/);
  });

  it("to'rtta asosiy funksiya sanab o'tilgan", async () => {
    const { html } = await fetchLanding();

    for (const key of ["lessonPlans", "presentations", "calendarPlans", "search"]) {
      assert.ok(
        htmlIncludes(html, text("uz", `landing.features.${key}.title`)),
        `${key} funksiyasi sahifada yo'q`,
      );
    }
  });

  it("«kimlar uchun» bo'limi aniq holatlar bilan ko'rsatilgan", async () => {
    /*
      Bosh sahifaning eng muhim vazifasi — odam o'zini TANISHI.
      Umumiy "hamma uchun" degan gap emas, aniq vaziyatlar.
    */
    const { html } = await fetchLanding();

    assert.ok(
      htmlIncludes(html, text("uz", "landing.audienceIntro")),
      "kimlar uchun ekani aytilmagan",
    );

    for (const item of ["busy", "calendar", "slides", "openLesson"]) {
      assert.ok(
        htmlIncludes(html, text("uz", `landing.audience.${item}.title`)),
        `${item} holati sahifada yo'q`,
      );
    }
  });

  it("«nima uchun aynan Searcher AI» afzalliklari va jamoa nomi bor", async () => {
    const { html } = await fetchLanding();

    for (const item of ["curriculum", "fast", "bilingual"]) {
      assert.ok(
        htmlIncludes(html, text("uz", `landing.why.${item}.title`)),
        `${item} afzalligi sahifada yo'q`,
      );
    }

    assert.ok(htmlIncludes(html, text("uz", "landing.team")), "jamoa nomi yo'q");
  });

  it("«qanday ishlaydi» uchta qadam bilan tushuntirilgan", async () => {
    const { html } = await fetchLanding();

    for (const step of ["input", "generate", "download"]) {
      assert.ok(
        htmlIncludes(html, text("uz", `landing.steps.${step}.title`)),
        `${step} qadami sahifada yo'q`,
      );
    }
  });
});

describe("bosh sahifa — kirgan foydalanuvchi", () => {
  it("/dashboard ga yo'naltiriladi", async () => {
    /*
      Kirgan o'qituvchiga tanishtiruv sahifasi keraksiz: u har safar
      ortiqcha bir bosish qo'shadi. Yo'naltirish `proxy.ts` da —
      `/login` va `/register` bilan bir xil qoida.
    */
    const client = new TestClient();
    const registered = await client.request("/api/auth/register", {
      method: "POST",
      body: {
        email: testEmail("landing-yonaltirish"),
        password: PASSWORD,
        fullName: "Sinov O'qituvchi",
      },
    });
    assert.equal(registered.status, 201);

    const visited = await client.visit("/");

    assert.equal(visited.status, 307, "yo'naltirish bo'lishi kerak");
    assert.ok(
      visited.location?.endsWith("/dashboard"),
      `kutilgan /dashboard, kelgan: ${visited.location}`,
    );
  });
});
