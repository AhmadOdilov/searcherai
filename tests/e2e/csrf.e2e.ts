import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE_URL, TestClient, cleanupTestUsers, testEmail } from "./helpers/client";
import { text } from "./helpers/messages";

/**
 * CSRF himoyasi — `Origin` sarlavhasi tekshiruvi.
 *
 * ── Nega e2e, birlik sinovi emas ──────────────────────────────────────────
 * Tekshiruv `withErrorHandling` ichida turadi, ya'ni u HAR BIR route'ga
 * avtomatik qo'llanadi. Aynan shu narsani tasdiqlash kerak: funksiya
 * to'g'ri ishlashi emas, balki u HAQIQATAN har bir so'rov yo'lida
 * ekani.
 */

const PASSWORD = "juda-maxfiy-parol";

/** E2E serveri shu manzilda; `APP_URL` esa boshqa (localhost:3000). */
const FOREIGN_ORIGIN = "https://yomon-sayt.example";

async function signedInCookie(suffix: string): Promise<string> {
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

  const jar = (client as unknown as { cookies: Map<string, string> }).cookies;
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

describe("CSRF — begona Origin", () => {
  it("begona saytdan kelgan POST rad etiladi (403)", async () => {
    const cookie = await signedInCookie("csrf-post");

    // Cookie HAQIQIY — ya'ni hujum aynan shunday ko'rinadi: brauzer
    // foydalanuvchining sessiyasini begona sahifadagi formaga qo'shadi.
    const response = await fetch(`${BASE_URL}/api/lesson-plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: FOREIGN_ORIGIN,
      },
      body: JSON.stringify({
        subject: "Matematika",
        grade: "7-sinf",
        topic: "Begona saytdan yuborilgan so'rov",
        durationMinutes: 45,
        lessonType: "NEW_TOPIC",
        language: "UZ",
      }),
    });

    assert.equal(response.status, 403);

    const json = (await response.json()) as {
      error: { code: string; message: string };
    };
    assert.equal(json.error.code, "forbidden");
    assert.equal(json.error.message, text("uz", "errors.domain.crossOriginRejected"));
    // Foydalanuvchiga texnik tafsilot (origin, kutilgan qiymat) ketmaydi.
    assert.ok(!/csrf|origin=|expected=/i.test(json.error.message));
  });

  it("begona Origin bilan DELETE ham rad etiladi", async () => {
    const cookie = await signedInCookie("csrf-delete");

    const response = await fetch(`${BASE_URL}/api/lesson-plans/qandaydir-id`, {
      method: "DELETE",
      headers: { cookie, origin: FOREIGN_ORIGIN },
    });

    // 403 — 404 EMAS: tekshiruv route mantig'idan OLDIN ishlaydi.
    assert.equal(response.status, 403);
  });

  it("begona Origin bilan PUT ham rad etiladi", async () => {
    const cookie = await signedInCookie("csrf-put");

    const response = await fetch(`${BASE_URL}/api/user/language`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: FOREIGN_ORIGIN,
      },
      body: JSON.stringify({ locale: "ru" }),
    });

    assert.equal(response.status, 403);
  });

  it("GET so'rovlarga TEGILMAYDI", async () => {
    /*
      GET hech narsani o'zgartirmaydi. Uni ham tekshirsak, boshqa
      saytdagi oddiy havola bilan kirishni ham buzardik.
    */
    const cookie = await signedInCookie("csrf-get");

    const response = await fetch(`${BASE_URL}/api/lesson-plans`, {
      headers: { cookie, origin: FOREIGN_ORIGIN },
    });

    assert.equal(response.status, 200);
  });
});

describe("CSRF — ruxsat etilgan so'rovlar", () => {
  it("Origin SARLAVHASI YO'Q so'rov o'tadi", async () => {
    /*
      `Origin` ni faqat brauzer qo'yadi. U yo'q bo'lsa — so'rov `curl`,
      mobil ilova yoki server-to-server chaqiruvdan kelgan, ya'ni CSRF
      tushunchasi umuman qo'llanmaydi (hujumning kuchi begona sahifa
      foydalanuvchi cookie'sidan foydalana olishida edi).

      Butun e2e to'plami aynan shunday ishlaydi — `fetch` Node'da
      `Origin` qo'ymaydi.
    */
    const client = new TestClient();
    const result = await client.request("/api/auth/register", {
      method: "POST",
      body: {
        email: testEmail("csrf-originsiz"),
        password: PASSWORD,
        fullName: "Sinov O'qituvchi",
      },
    });

    assert.equal(result.status, 201);
  });

  it("TO'G'RI Origin bilan so'rov o'tadi", async () => {
    const cookie = await signedInCookie("csrf-togri");

    // `APP_URL` sinov muhitida qanday bo'lsa, Origin ham shunday.
    const expectedOrigin = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;

    const response = await fetch(`${BASE_URL}/api/lesson-plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: expectedOrigin,
      },
      body: JSON.stringify({
        subject: "Matematika",
        grade: "7-sinf",
        topic: "O'z saytimizdan yuborilgan so'rov",
        durationMinutes: 45,
        lessonType: "NEW_TOPIC",
        language: "UZ",
      }),
    });

    assert.equal(response.status, 202, "o'z domenidan kelgan so'rov o'tishi kerak");
  });
});
