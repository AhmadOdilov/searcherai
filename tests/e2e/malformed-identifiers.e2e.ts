import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { TestClient, cleanupTestUsers, testEmail } from "./helpers/client";

/**
 * Buzuq identifikatorlar — so'rov bazaga YETIB BORMASLIGI kerak.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * Yo'l bo'lagidagi `%00` brauzerdan NOL BAYT bo'lib keladi va u
 * `params.id` ga o'zgarishsiz tushardi. Prisma uni Postgres'ga uzatar,
 * Postgres esa `22021: invalid byte sequence for encoding "UTF8"`
 * xatosini qaytarardi. `withErrorHandling` buni "kutilmagan xatolik"
 * deb hisoblab, foydalanuvchiga 500 berardi.
 *
 * Audit paytida bu 12 ta route'da ham takrorlandi (dars ishlanmasi,
 * prezentatsiya, kalendar reja × GET/DELETE/regenerate/yuklab olish),
 * shuningdek ro'yxatlardagi `cursor` so'rov parametrida.
 *
 * ── Nega bu MUHIM, garchi ma'lumot sizmasa ham ────────────────────────────
 * Javob tanasi hech narsa oshkor qilmasdi (umumiy xabar), lekin:
 *  · 500 — "biz buzildik" degani; to'g'ri javob 400 "so'rov buzuq";
 *  · kirgan istalgan foydalanuvchi xohlagancha 500 yasab, xato
 *    loglarini to'ldirib, haqiqiy nosozliklarni ko'mib tashlashi mumkin;
 *  · nol bayt bazagacha yetib borgani — tekshiruv chegarasi noto'g'ri
 *    joyda turganining belgisi.
 *
 * ── Nega sinov AYNAN shu yerda ────────────────────────────────────────────
 * Himoya `withErrorHandling` ichida, ya'ni HAR BIR route'ga avtomatik
 * qo'llanadi (CSRF tekshiruvi kabi). Tekshirilishi kerak bo'lgan narsa
 * funksiyaning o'zi emas, balki u haqiqatan har bir so'rov yo'lida
 * ekani — buni faqat haqiqiy HTTP orqali ko'rsatish mumkin.
 */

const PASSWORD = "juda-maxfiy-parol";

let client: TestClient;

before(async () => {
  await cleanupTestUsers();

  client = new TestClient();
  const registered = await client.request("/api/auth/register", {
    method: "POST",
    body: {
      email: testEmail("buzuq-id"),
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
 * Nol bayt tushishi mumkin bo'lgan BARCHA yo'llar.
 *
 * Ro'yxat to'liq: uchala modul × o'qish, o'chirish, qayta generatsiya va
 * fayl olish. Bittasi qolib ketsa, himoya "deyarli hamma joyda" bo'lib
 * qolardi — bu esa himoya emas.
 */
const ROUTES: Array<{ method: string; path: string }> = [
  { method: "GET", path: "/api/lesson-plans/%00" },
  { method: "GET", path: "/api/lesson-plans/%00/export" },
  { method: "DELETE", path: "/api/lesson-plans/%00" },
  { method: "POST", path: "/api/lesson-plans/%00/regenerate" },
  { method: "GET", path: "/api/presentations/%00" },
  { method: "GET", path: "/api/presentations/%00/download" },
  { method: "DELETE", path: "/api/presentations/%00" },
  { method: "POST", path: "/api/presentations/%00/regenerate" },
  { method: "GET", path: "/api/calendar-plans/%00" },
  { method: "GET", path: "/api/calendar-plans/%00/download" },
  { method: "DELETE", path: "/api/calendar-plans/%00" },
  { method: "POST", path: "/api/calendar-plans/%00/regenerate" },
];

describe("buzuq identifikator — yo'l bo'lagida nol bayt", () => {
  for (const route of ROUTES) {
    it(`${route.method} ${route.path} — 500 EMAS`, async () => {
      const result = await client.request(route.path, { method: route.method });

      assert.notEqual(
        result.status,
        500,
        `nol bayt bazagacha yetib bordi: ${route.method} ${route.path}`,
      );
      assert.equal(result.status, 400, "buzuq so'rov 400 bo'lishi kerak");
      assert.equal(result.error?.code, "validation_error");
    });
  }

  it("nol bayt yo'l bo'lagining O'RTASIDA bo'lsa ham to'siladi", async () => {
    /*
      Hujumchi `%00` ni yakka bo'lak qilib yubormaydi — uni haqiqiy
      ko'rinishdagi identifikatorga yashiradi. Tekshiruv butun yo'lga
      qaralishi kerak, faqat bo'lak to'liq mos kelishiga emas.
    */
    const result = await client.request("/api/lesson-plans/abc%00def");

    assert.equal(result.status, 400);
    assert.equal(result.error?.code, "validation_error");
  });

  it("javob ichki tafsilot (SQL, Prisma, kod) OSHKOR QILMAYDI", async () => {
    const response = await client.fetchRaw("/api/presentations/%00");
    const body = await response.text();

    assert.ok(
      !/prisma|invalid byte sequence|22021|findFirst|at \w+ \(/i.test(body),
      `javob ichki tafsilot oshkor qildi: ${body.slice(0, 200)}`,
    );
  });
});

describe("buzuq identifikator — so'rov parametrida nol bayt", () => {
  /*
    `cursor` to'g'ridan-to'g'ri Prisma'ning `cursor: { id }` iga tushadi,
    ya'ni yo'l bo'lagi bilan bir xil yo'ldan bazaga boradi. Uni alohida
    tekshiramiz: himoya yo'lni tekshirib, so'rov qismini unutgan
    bo'lishi mumkin.
  */
  for (const path of [
    "/api/lesson-plans?cursor=%00",
    "/api/presentations?cursor=abc%00def",
    "/api/calendar-plans?cursor=%00",
  ]) {
    it(`GET ${path} — 500 EMAS`, async () => {
      const result = await client.request(path);

      assert.notEqual(result.status, 500, `nol bayt bazagacha yetib bordi: ${path}`);
      assert.equal(result.status, 400);
    });
  }
});

describe("to'g'ri so'rovlar BUZILMAYDI", () => {
  /*
    Himoya haddan tashqari qattiq bo'lib qolmasin. Bu sinovlar filtr
    juda keng yozilganini (masalan foizli belgilarni umuman rad
    etishni) darhol ko'rsatadi.
  */
  it("mavjud bo'lmagan oddiy id — o'zgarishsiz 404", async () => {
    const result = await client.request("/api/lesson-plans/mavjud-emas-id");
    assert.equal(result.status, 404);
  });

  it("kirill va bo'shliqli id — 404, 400 emas", async () => {
    // Foizli kodlash bor, lekin nol bayt yo'q.
    const result = await client.request(
      "/api/lesson-plans/%D0%BC%D0%B0%D0%B2%D0%B7%D1%83",
    );
    assert.equal(result.status, 404);
  });

  it("oddiy cursor bilan ro'yxat ishlaydi", async () => {
    const result = await client.request("/api/lesson-plans?cursor=mavjud-emas-id");
    assert.equal(result.status, 200);
  });

  it("cursorsiz ro'yxat ishlaydi", async () => {
    const result = await client.request("/api/lesson-plans");
    assert.equal(result.status, 200);
  });
});
