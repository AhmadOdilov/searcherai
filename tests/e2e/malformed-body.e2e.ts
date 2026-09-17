import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { TestClient, cleanupTestUsers, testEmail } from "./helpers/client";

/**
 * So'rov TANASIDAGI nol bayt — bazaga YETIB BORMASLIGI kerak.
 *
 * ── Nega bu alohida sinov, `malformed-identifiers.e2e.ts` bori turib ─────
 * O'sha sinov MANZILDAGI nol baytni qoplaydi va himoyasi
 * `assertNoNullBytes(request)` — u faqat `url.pathname` va
 * `searchParams` ga qaraydi. So'rov TANASI o'sha tekshiruvdan butunlay
 * chetda qoladi.
 *
 * Natijada Phase 6 da tuzatilgan nuqson ikkinchi eshikdan qaytib
 * kirgan edi: JSON tanasidagi `"\u0000"` zod sxemasidan o'tib
 * (`z.string()` uchun nol bayt oddiy belgi), Prisma orqali Postgres'ga
 * borardi va o'sha yerdan
 *
 *   22021: invalid byte sequence for encoding "UTF8": 0x00
 *
 * qaytardi. `withErrorHandling` buni tanimay 500 berardi.
 *
 * ── Nega bu MANZILDAGIDAN OG'IRROQ ───────────────────────────────────────
 * Manzil tekshiruvi kirgan foydalanuvchini talab qilardi. Bu yerda esa
 * `POST /api/auth/register` — KIRISHSIZ ochiq route. Ya'ni istalgan
 * tashqi mehmon hisobsiz-nimasiz xohlagancha 500 yasay olardi:
 *
 *  · 500 "server buzildi" degani, holbuki buzuq narsa — so'rov. Mijoz
 *    ham, monitoring ham qayta urinadi, chunki 500 vaqtinchalik
 *    nosozlik deb o'qiladi;
 *  · xato jurnali begona 500 lar bilan to'lib, HAQIQIY nosozliklarni
 *    ko'mib tashlaydi.
 *
 * ── Nega sinov HTTP orqali ───────────────────────────────────────────────
 * Tekshirilayotgan narsa funksiyaning o'zi emas, balki himoya har bir
 * JSON tanasi o'qiladigan yo'lda HAQIQATAN turgani. Buni faqat haqiqiy
 * so'rov ko'rsata oladi.
 */

const PASSWORD = "juda-maxfiy-parol";

/** Nol bayt — ATAYLAB qochirilgan ketma-ketlik bilan. Manba fayli matn bo'lib qolsin. */
const NUL = "\u0000";

let client: TestClient;

before(async () => {
  await cleanupTestUsers();

  client = new TestClient();
  const registered = await client.request("/api/auth/register", {
    method: "POST",
    body: {
      email: testEmail("buzuq-tana"),
      password: PASSWORD,
      fullName: "Sinov O'qituvchi",
    },
  });
  assert.equal(registered.status, 201);
});

after(async () => {
  await cleanupTestUsers();
});

/**
 * Nol bayt tushishi mumkin bo'lgan tanali route'lar.
 *
 * Ro'yxatga FAQAT nol bayt qo'yiladi, qolgan maydonlar HAQIQIY qiymat
 * bilan to'ldiriladi. Sabab: agar so'rov boshqa sababdan ham yiqilsa
 * (yetishmayotgan maydon), sinov nol baytni emas, o'sha ikkinchi
 * xatoni tekshirib qolardi va himoya yo'qolganda ham yashil bo'lardi.
 */
const BODIES: Array<{ method: string; path: string; body: Record<string, unknown> }> = [
  {
    // KIRISHSIZ — eng og'ir holat.
    method: "POST",
    path: "/api/auth/register",
    body: { email: testEmail("nol-bayt"), password: PASSWORD, fullName: `Ism${NUL}` },
  },
  {
    method: "POST",
    path: "/api/lesson-plans",
    body: {
      subject: `Matematika${NUL}`,
      grade: "7-sinf",
      topic: "Oddiy kasrlar",
      durationMinutes: 45,
      lessonType: "NEW_TOPIC",
      language: "UZ",
    },
  },
  {
    method: "POST",
    path: "/api/lesson-plans",
    body: {
      subject: "Matematika",
      grade: "7-sinf",
      topic: `Oddiy${NUL}kasrlar`,
      durationMinutes: 45,
      lessonType: "NEW_TOPIC",
      language: "UZ",
    },
  },
  {
    method: "POST",
    path: "/api/presentations",
    body: {
      mode: "standalone",
      topic: `Fotosintez${NUL}`,
      language: "UZ",
      template: "klassik",
    },
  },
  {
    method: "POST",
    path: "/api/calendar-plans",
    body: {
      subject: `Matematika${NUL}`,
      grade: "7-sinf",
      period: "1-chorak",
      weeks: 8,
      hoursPerWeek: 4,
      startDate: "2026-09-01",
      language: "UZ",
    },
  },
  {
    method: "POST",
    path: "/api/search",
    body: { query: `fotosintez${NUL}`, language: "UZ" },
  },
  {
    method: "PATCH",
    path: "/api/user/profile",
    body: { fullName: `Ism${NUL}` },
  },
];

describe("buzuq tana — JSON ichida nol bayt", () => {
  for (const route of BODIES) {
    const field = Object.entries(route.body).find(
      ([, value]) => typeof value === "string" && value.includes(NUL),
    )?.[0];

    it(`${route.method} ${route.path} (${field}) — 500 EMAS`, async () => {
      const result = await client.request(route.path, {
        method: route.method,
        body: route.body,
      });

      assert.notEqual(
        result.status,
        500,
        `nol bayt bazagacha yetib bordi: ${route.method} ${route.path}`,
      );
      assert.equal(result.status, 400, "buzuq so'rov 400 bo'lishi kerak");
      assert.equal(result.error?.code, "validation_error");
    });
  }

  it("nol bayt CHUQUR joylashgan bo'lsa ham to'siladi", async () => {
    /*
      Tekshiruv faqat yuqori qavatdagi maydonlarga qarasa, ichma-ich
      obyektdagi nol bayt o'tib ketardi. Bugun bunday sxema yo'q, lekin
      himoya tananing SHAKLIGA bog'liq bo'lmasligi kerak.
    */
    const result = await client.request("/api/lesson-plans", {
      method: "POST",
      body: {
        subject: "Matematika",
        grade: "7-sinf",
        topic: "Oddiy kasrlar",
        durationMinutes: 45,
        lessonType: "NEW_TOPIC",
        language: "UZ",
        sourceMaterial: { nested: [{ deep: `matn${NUL}` }] },
      },
    });

    assert.notEqual(result.status, 500, "chuqurdagi nol bayt bazagacha bordi");
    assert.equal(result.status, 400);
  });
});

describe("haqiqiy Unicode esa O'TISHI kerak", () => {
  /*
    Teskari tomon. Himoyani "hamma g'alati belgini rad et" deb yozish
    oson, lekin bu o'zbek/rus matnini, emoji'ni va matematik
    belgilarni ham yo'q qilardi — ya'ni nuqsonni tuzatish o'rniga
    undan battarrog'ini yasardi.

    Faqat NOL BAYT imkonsiz belgi. Qolgani — oddiy matn.
  */
  it("emoji, kirill va matematik belgilar qabul qilinadi", async () => {
    const fresh = new TestClient();
    const registered = await fresh.request("/api/auth/register", {
      method: "POST",
      body: {
        email: testEmail("unicode"),
        password: PASSWORD,
        fullName: "Ўқитувчи Aʼzam ∑",
      },
    });
    assert.equal(registered.status, 201, "haqiqiy Unicode ism rad etildi");

    const created = await fresh.request("/api/lesson-plans", {
      method: "POST",
      body: {
        subject: "Matematika",
        grade: "7-sinf",
        topic: "Kasrlar 📐 ва дроби — ∑(a+b)",
        durationMinutes: 45,
        lessonType: "NEW_TOPIC",
        language: "UZ",
      },
    });

    assert.equal(created.status, 202, "haqiqiy Unicode mavzu rad etildi");
  });
});
