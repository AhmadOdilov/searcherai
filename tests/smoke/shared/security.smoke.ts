import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  BASE_URL,
  TestClient,
  cleanupTestUsers,
  testEmail,
} from "../../e2e/helpers/client.ts";

/**
 * Xavfsizlik chegaralari — HAQIQIY production artefaktida.
 *
 * ── Nega bu e2e to'plamining takrori emas ─────────────────────────────────
 * `tests/e2e` xuddi shu chegaralarni tekshiradi, lekin `next dev` ga
 * qarshi. Bu yerdagi bir nechta tasdiq dev'da UMUMAN ishlamaydi:
 *
 *  · `Secure` cookie bayrog'i faqat `NODE_ENV=production` da qo'yiladi
 *    (`lib/auth/session.ts`), ya'ni dev'da bu tasdiq yolg'on yashil
 *    bo'lardi;
 *  · CSP dev'da ATAYLAB bo'shroq — `'unsafe-eval'` va style uchun
 *    `'unsafe-inline'` ochiq (`lib/security/csp.ts`). "unsafe-eval yo'q"
 *    ni faqat production build'da tekshirish mumkin.
 *
 * Qolgan tasdiqlar ikkala muhitda ham bir xil ishlaydi va ular bu yerda
 * ATAYLAB takrorlanadi: smoke to'plami "artefakt yaxlitmi?" degan
 * savolga o'zi javob berishi kerak, boshqa to'plam yashil bo'lishiga
 * tayanmasdan.
 */

const PASSWORD = "juda-maxfiy-parol";
const FOREIGN_ORIGIN = "https://yomon-sayt.example";

let owner: TestClient;
let stranger: TestClient;
let ownerRecordId: string;

async function register(client: TestClient, suffix: string): Promise<void> {
  const result = await client.request("/api/auth/register", {
    method: "POST",
    body: { email: testEmail(suffix), password: PASSWORD, fullName: "Smoke O'qituvchi" },
  });
  assert.equal(result.status, 201, "ro'yxatdan o'tish ishlamadi");
}

before(async () => {
  await cleanupTestUsers();

  owner = new TestClient();
  stranger = new TestClient();
  await register(owner, "smoke-ega");
  await register(stranger, "smoke-begona");

  // Egalik tekshiruvlari uchun bitta haqiqiy yozuv kerak.
  const created = await owner.request<{ lessonPlan: { id: string } }>(
    "/api/lesson-plans",
    {
      method: "POST",
      body: {
        subject: "Matematika",
        grade: "7-sinf",
        topic: "Egalik tekshiruvi uchun mavzu",
        durationMinutes: 45,
        lessonType: "NEW_TOPIC",
        language: "UZ",
      },
    },
  );
  assert.equal(created.status, 202);
  ownerRecordId = created.data!.lessonPlan.id;
});

after(async () => {
  await cleanupTestUsers();
});

describe("production javob sarlavhalari", () => {
  it("CSP nonce bilan keladi", async () => {
    const response = await fetch(`${BASE_URL}/login`);
    const csp = response.headers.get("content-security-policy");

    assert.ok(csp, "CSP sarlavhasi yo'q");
    assert.match(csp, /nonce-/, "CSP'da nonce yo'q");
  });

  it("CSP'da `unsafe-eval` YO'Q", async () => {
    /*
      Dev serverida u bor (React xato izlarini tiklash uchun `eval`
      ishlatadi). Aynan shu sabab bu tasdiq faqat production
      artefaktida ma'noga ega.
    */
    const response = await fetch(`${BASE_URL}/login`);
    const csp = response.headers.get("content-security-policy") ?? "";

    assert.ok(!csp.includes("unsafe-eval"), `CSP: ${csp}`);
  });

  it("`script-src` da `unsafe-inline` YO'Q", async () => {
    const response = await fetch(`${BASE_URL}/login`);
    const csp = response.headers.get("content-security-policy") ?? "";
    const scriptSrc = /script-src([^;]*)/.exec(csp)?.[1] ?? "";

    assert.ok(!scriptSrc.includes("unsafe-inline"), `script-src: ${scriptSrc}`);
  });

  it("HTML'dagi HAR BIR <script> nonce ko'taradi", async () => {
    /*
      CSP'ning o'zi to'g'ri bo'lib, sahifadagi skript nonce'siz qolsa —
      ilova brauzerda JIM ishlamay qoladi. Buni faqat render qilingan
      HTML'ni ko'rib aniqlash mumkin.
    */
    const response = await fetch(`${BASE_URL}/login`);
    const html = await response.text();
    const tags = html.match(/<script\b[^>]*>/g) ?? [];

    assert.ok(tags.length > 0, "sahifada umuman skript yo'q — kutilmagan holat");
    const missing = tags.filter((tag) => !tag.includes("nonce="));
    assert.equal(missing.length, 0, `nonce'siz skript: ${missing[0]}`);
  });

  it("xavfsizlik sarlavhalari o'z joyida", async () => {
    const response = await fetch(`${BASE_URL}/login`);

    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(
      response.headers.get("referrer-policy"),
      "strict-origin-when-cross-origin",
    );
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
    assert.equal(response.headers.get("cross-origin-resource-policy"), "same-site");
    assert.equal(response.headers.get("x-powered-by"), null, "server nomi oshkor");
  });
});

describe("sessiya cookie'si", () => {
  it("Secure, HttpOnly va SameSite bayroqlari bilan qo'yiladi", async () => {
    /*
      `Secure` FAQAT `NODE_ENV=production` da qo'yiladi. Dev serverida bu
      tasdiq hech qachon yiqilmasdi — ya'ni himoya jim yo'qolsa ham
      sezilmasdi.
    */
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: testEmail("smoke-cookie"),
        password: PASSWORD,
        fullName: "Smoke Cookie",
      }),
    });
    assert.equal(response.status, 201);

    const [cookie] = response.headers.getSetCookie();
    assert.ok(cookie, "set-cookie yo'q");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=lax/i);
  });
});

describe("CSRF", () => {
  it("begona Origin rad etiladi", async () => {
    const response = await fetch(`${BASE_URL}/api/user/language`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: owner.cookieHeader(),
        origin: FOREIGN_ORIGIN,
      },
      body: JSON.stringify({ locale: "ru" }),
    });

    assert.equal(response.status, 403);
  });

  it("buzuq Origin rad etiladi", async () => {
    for (const origin of ["null", "not a url", `${BASE_URL}.yomon-sayt.example`]) {
      const response = await fetch(`${BASE_URL}/api/user/language`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookieHeader(),
          origin,
        },
        body: JSON.stringify({ locale: "ru" }),
      });

      assert.equal(response.status, 403, `Origin "${origin}" o'tkazib yuborildi`);
    }
  });

  it("o'z Origin'i o'tadi", async () => {
    const response = await fetch(`${BASE_URL}/api/user/language`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: owner.cookieHeader(),
        origin: new URL(BASE_URL).origin,
      },
      body: JSON.stringify({ locale: "uz" }),
    });

    assert.equal(response.status, 200);
  });
});

describe("egalik va topilmaslik", () => {
  it("begona foydalanuvchi yozuvni O'QIY olmaydi (404)", async () => {
    const result = await stranger.request(`/api/lesson-plans/${ownerRecordId}`);
    assert.equal(result.status, 404);
  });

  it("begona foydalanuvchi faylni YUKLAB OLA olmaydi (404)", async () => {
    const result = await stranger.request(`/api/lesson-plans/${ownerRecordId}/export`);
    assert.equal(result.status, 404);
  });

  it("begona foydalanuvchi O'CHIRA olmaydi (404) va yozuv joyida qoladi", async () => {
    const attempt = await stranger.request(`/api/lesson-plans/${ownerRecordId}`, {
      method: "DELETE",
    });
    assert.equal(attempt.status, 404);

    const stillThere = await owner.request(`/api/lesson-plans/${ownerRecordId}`);
    assert.equal(stillThere.status, 200, "yozuv begona so'rovdan keyin yo'qoldi");
  });

  it("mavjud bo'lmagan yozuv — 404", async () => {
    const result = await owner.request("/api/lesson-plans/umuman-mavjud-emas");
    assert.equal(result.status, 404);
  });

  it("yo'l chetlab o'tishga urinish — 404, 500 emas", async () => {
    for (const id of ["..%2F..%2Fetc%2Fpasswd", "..%5C..%5Cwindows", "%2e%2e%2f%2e%2e"]) {
      const result = await owner.request(`/api/lesson-plans/${id}/export`);
      assert.equal(result.status, 404, `id="${id}" kutilmagan javob berdi`);
    }
  });

  it("nol baytli identifikator — 400, HECH QACHON 500 emas", async () => {
    // Phase 6 dagi regressiya: `%00` bazagacha borib 500 qaytarardi.
    for (const path of [
      "/api/lesson-plans/%00",
      "/api/presentations/%00/download",
      "/api/calendar-plans/%00",
      "/api/lesson-plans?cursor=%00",
    ]) {
      const result = await owner.request(path);
      assert.notEqual(result.status, 500, `${path} 500 qaytardi`);
      assert.equal(result.status, 400, `${path} kutilmagan javob berdi`);
    }
  });

  it("so'rov TANASIDAGI nol bayt — 400, HECH QACHON 500 emas", async () => {
    /*
      Phase 8 dagi regressiya: manzil tekshirilardi, tana esa YO'Q.
      JSON ichidagi nol bayt zod sxemasidan o'tib Postgres'ga borar va
      `22021` xatosi 500 bo'lib qaytardi.

      Eng og'ir yo'l — `register`: u KIRISHSIZ ochiq, ya'ni istalgan
      mehmon hisobsiz 500 yasay olardi.
    */
    const nul = "\u0000";

    const anonymous = new TestClient();
    const registered = await anonymous.request("/api/auth/register", {
      method: "POST",
      body: {
        email: testEmail("smoke-nol-bayt"),
        password: PASSWORD,
        fullName: `Ism${nul}`,
      },
    });
    assert.notEqual(registered.status, 500, "kirishsiz route 500 qaytardi");
    assert.equal(registered.status, 400, "nol baytli ism 400 bo'lishi kerak");

    const created = await owner.request("/api/lesson-plans", {
      method: "POST",
      body: {
        subject: `Matematika${nul}`,
        grade: "7-sinf",
        topic: "Nol bayt sinovi",
        durationMinutes: 45,
        lessonType: "NEW_TOPIC",
        language: "UZ",
      },
    });
    assert.notEqual(created.status, 500, "tanadagi nol bayt bazagacha bordi");
    assert.equal(created.status, 400);
  });

  it("PARALLEL so'rovlar AI kvotasini chetlab o'ta olmaydi", async () => {
    /*
      Bu sinov ATAYLAB smoke to'plamida: `next dev` da u HECH QACHON
      yiqilmaydi. Dev serveri so'rovlarni sekinroq ishlaydi va poyga
      oynasi ochilmaydi — ya'ni e2e qatlamida tasdiq yolg'on yashil
      bo'lardi.

      Production artefaktida esa auditda o'nta parallel so'rovdan
      uchta emas, 4 / 4 / 9 tasi qabul qilingan edi (`consumeAiQuota()`
      avval sanab, keyin yozardi).

      Chegara PUL chegarasi: chetlab o'tilsa hech qanday xato
      ko'rinmaydi, faqat provayder hisobi o'sadi.
    */
    const MAX_AI_REQUESTS = 3;

    const burst = new TestClient();
    await register(burst, "smoke-kvota-parallel");

    const statuses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        burst
          .request("/api/lesson-plans", {
            method: "POST",
            body: {
              subject: "Matematika",
              grade: "7-sinf",
              topic: `Parallel kvota ${index}`,
              durationMinutes: 45,
              lessonType: "NEW_TOPIC",
              language: "UZ",
            },
          })
          .then((result) => result.status),
      ),
    );

    const accepted = statuses.filter((status) => status === 202).length;

    assert.ok(
      accepted <= MAX_AI_REQUESTS,
      `kvota chetlab o'tildi: ${accepted} ta qabul qilindi (chegara ${MAX_AI_REQUESTS})`,
    );
    // Teskari tomon: hammasi rad etilib qolmasin.
    assert.ok(accepted >= 1, "parallel so'rovlarning hammasi rad etildi");
  });

  it("kirmagan foydalanuvchi API'ga kira olmaydi", async () => {
    const anonymous = new TestClient();

    for (const path of [
      "/api/lesson-plans",
      "/api/presentations",
      "/api/calendar-plans",
    ]) {
      const result = await anonymous.request(path);
      assert.equal(result.status, 401, `${path} kirishsiz ochiq qoldi`);
    }

    /*
      Holatni o'zgartiradigan yo'llar ham — o'z metodlari bilan.

      `PUT /api/user/language` bu ro'yxatda ATAYLAB YO'Q: u mehmonlar
      uchun ham ochiq bo'lishi kerak (kirish sahifasidagi til
      almashtirgich) va bazaga faqat `if (user)` sharti bilan yozadi.
    */
    const mutations: Array<{ method: string; path: string }> = [
      { method: "PATCH", path: "/api/user/profile" },
      { method: "DELETE", path: "/api/user/sessions" },
      { method: "DELETE", path: "/api/user/account" },
    ];
    for (const mutation of mutations) {
      const result = await anonymous.request(mutation.path, {
        method: mutation.method,
        body: {},
      });
      assert.equal(
        result.status,
        401,
        `${mutation.method} ${mutation.path} kirishsiz ochiq qoldi`,
      );
    }
  });
});

describe("ochiq yo'naltirish", () => {
  /*
    Bu yerda PROXY qatlami tekshiriladi: kirgan foydalanuvchi `/login` ga
    kelsa, `next` qiymatidan QAT'I NAZAR `/dashboard` ga qaytariladi.

    Kirish formasidagi klient tomoni (`safeInternalPath`) alohida
    qoplangan: `tests/safe-redirect.test.ts` (birlik) va
    `tests/browser/login-redirect.spec.ts` (haqiqiy brauzer). Bu yerda
    ular takrorlanmaydi — bu qatlam brauzersiz tekshiriladigan qismi.
  */
  const PAYLOADS = [
    "//begona.example",
    "/\\begona.example",
    "https://begona.example",
    "javascript:alert(1)",
    "/%5Cbegona.example",
  ];

  for (const payload of PAYLOADS) {
    it(`next=${payload} — tashqariga olib chiqmaydi`, async () => {
      const visited = await owner.visit(`/login?next=${encodeURIComponent(payload)}`);

      assert.equal(visited.status, 307);
      assert.ok(visited.location, "yo'naltirish manzili yo'q");
      const target = new URL(visited.location, BASE_URL);
      assert.equal(target.origin, new URL(BASE_URL).origin, "begona originga chiqdi");
      assert.equal(target.pathname, "/dashboard");
    });
  }
});

describe("sessiya bekor qilinishi", () => {
  it("chiqishdan keyin sessiya ishlamaydi", async () => {
    const client = new TestClient();
    await register(client, "smoke-chiqish");

    const before = await client.request("/api/lesson-plans");
    assert.equal(before.status, 200);

    const loggedOut = await client.request("/api/auth/logout", { method: "POST" });
    assert.equal(loggedOut.status, 200);

    const after = await client.request("/api/lesson-plans");
    assert.equal(after.status, 401, "chiqishdan keyin sessiya tirik qoldi");
  });

  it("parol o'zgarsa BOSHQA qurilmalardagi sessiya o'ladi", async () => {
    const email = testEmail("smoke-parol");

    const firstDevice = new TestClient();
    const registered = await firstDevice.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Smoke Parol" },
    });
    assert.equal(registered.status, 201);

    const secondDevice = new TestClient();
    const signedIn = await secondDevice.request("/api/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    assert.equal(signedIn.status, 200);

    // Ikkinchi qurilmadan parol o'zgartiriladi.
    const changed = await secondDevice.request("/api/user/password", {
      method: "PUT",
      body: { currentPassword: PASSWORD, newPassword: "yangi-juda-maxfiy-parol" },
    });
    assert.equal(changed.status, 200);

    const firstAfter = await firstDevice.request("/api/lesson-plans");
    assert.equal(firstAfter.status, 401, "eski qurilma sessiyasi tirik qoldi");

    // O'zgartirgan qurilma esa yangi cookie oldi va ishlashda davom etadi.
    const secondAfter = await secondDevice.request("/api/lesson-plans");
    assert.equal(secondAfter.status, 200);

    // Eski parol bilan kirib bo'lmaydi.
    const oldPassword = await new TestClient().request("/api/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    assert.equal(oldPassword.status, 401);
  });
});
