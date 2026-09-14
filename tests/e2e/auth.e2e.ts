import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { BASE_URL, TestClient, cleanupTestUsers, testEmail } from "./helpers/client";
import { text } from "./helpers/messages";

/**
 * Autentifikatsiya oqimi — uchidan-uchgacha, haqiqiy server va baza bilan.
 *
 * Sinov foydalanuvchilari `e2e-test-` prefiksli email bilan yaratiladi va
 * oxirida o'chiriladi.
 */

const SESSION_COOKIE = "searcher_session";
const PASSWORD = "juda-maxfiy-parol";

interface UserPayload {
  user: { id: string; email: string; fullName: string; role: string; language: string };
}

after(async () => {
  await cleanupTestUsers();
});

describe("ro'yxatdan o'tish", () => {
  it("yangi foydalanuvchi yaratadi va darhol sessiya beradi", async () => {
    const client = new TestClient();
    const email = testEmail("register-ok");

    const result = await client.request<UserPayload>("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Aziza Karimova" },
    });

    assert.equal(result.status, 201);
    assert.equal(result.ok, true);
    assert.equal(result.data!.user.email, email);
    assert.equal(result.data!.user.fullName, "Aziza Karimova");
    assert.equal(result.data!.user.role, "TEACHER", "standart rol o'qituvchi");
    assert.ok(
      client.hasCookie(SESSION_COOKIE),
      "ro'yxatdan o'tgandan keyin sessiya cookie'si berilishi kerak",
    );

    // Sessiya darhol ishlashi kerak — qaytadan kirish talab qilinmaydi.
    const me = await client.request<UserPayload>("/api/auth/me");
    assert.equal(me.data!.user.email, email);
  });

  it("band emailni rad etadi (409) va tushunarli xabar beradi", async () => {
    const email = testEmail("band");

    const first = new TestClient();
    const created = await first.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Birinchi" },
    });
    assert.equal(created.status, 201);

    const second = new TestClient();
    const duplicate = await second.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Ikkinchi" },
    });

    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.error!.code, "conflict");
    assert.match(duplicate.error!.message, /allaqachon/);
    assert.equal(
      second.hasCookie(SESSION_COOKIE),
      false,
      "muvaffaqiyatsiz ro'yxatda sessiya berilmasligi kerak",
    );
  });

  it("katta-kichik harf farqiga qaramay bitta hisob deb qaraydi", async () => {
    // "Aziza@..." va "aziza@..." ikkita hisob bo'lib qolmasligi kerak.
    const base = testEmail("harf");
    const upper = base.toUpperCase();

    const first = new TestClient();
    const created = await first.request("/api/auth/register", {
      method: "POST",
      body: { email: base, password: PASSWORD, fullName: "Aziza" },
    });
    assert.equal(created.status, 201);

    const second = new TestClient();
    const duplicate = await second.request("/api/auth/register", {
      method: "POST",
      body: { email: upper, password: PASSWORD, fullName: "Aziza" },
    });

    assert.equal(duplicate.status, 409, "katta harfli email ham band bo'lishi kerak");
  });

  it("noto'g'ri ma'lumotni maydonlar bo'yicha rad etadi (400)", async () => {
    const client = new TestClient();

    const result = await client.request("/api/auth/register", {
      method: "POST",
      body: { email: "email-emas", password: "qisqa", fullName: "" },
    });

    assert.equal(result.status, 400);
    assert.equal(result.error!.code, "validation_error");
    const fields = result.error!.fieldErrors!;
    assert.ok(fields.email, "email xatosi bo'lishi kerak");
    assert.ok(fields.password, "parol xatosi bo'lishi kerak");
    assert.ok(fields.fullName, "ism xatosi bo'lishi kerak");
  });

  it("so'rovdagi role ni E'TIBORSIZ qoldiradi", async () => {
    const client = new TestClient();
    const email = testEmail("rol-hujumi");

    const result = await client.request<UserPayload>("/api/auth/register", {
      method: "POST",
      body: {
        email,
        password: PASSWORD,
        fullName: "Hujumchi",
        role: "ADMIN",
      },
    });

    assert.equal(result.status, 201);
    assert.equal(
      result.data!.user.role,
      "TEACHER",
      "so'rov orqali ADMIN bo'lib olish mumkin bo'lmasligi kerak",
    );
  });
});

describe("kirish", () => {
  /** Sinov uchun foydalanuvchi yaratadi. */
  async function createUser(suffix: string): Promise<string> {
    const email = testEmail(suffix);
    const client = new TestClient();
    const result = await client.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Sinov Foydalanuvchi" },
    });
    assert.equal(result.status, 201);
    return email;
  }

  it("to'g'ri parol bilan kiradi", async () => {
    const email = await createUser("login-ok");

    const client = new TestClient();
    const result = await client.request<UserPayload>("/api/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });

    assert.equal(result.status, 200);
    assert.equal(result.data!.user.email, email);
    assert.ok(client.hasCookie(SESSION_COOKIE));
  });

  it("noto'g'ri parolni rad etadi (401)", async () => {
    const email = await createUser("login-xato-parol");

    const client = new TestClient();
    const result = await client.request("/api/auth/login", {
      method: "POST",
      body: { email, password: "butunlay-boshqa-parol" },
    });

    assert.equal(result.status, 401);
    assert.equal(result.error!.code, "unauthorized");
    assert.equal(client.hasCookie(SESSION_COOKIE), false);
  });

  it("mavjud bo'lmagan email uchun AYNAN shu xabarni qaytaradi", async () => {
    // Muhim: "email topilmadi" va "parol xato" bir xil javob berishi kerak,
    // aks holda hujumchi qaysi emaillar ro'yxatda borligini aniqlaydi.
    const email = await createUser("login-bir-xil-xabar");

    const wrongPassword = new TestClient();
    const wrongPasswordResult = await wrongPassword.request("/api/auth/login", {
      method: "POST",
      body: { email, password: "xato-parol" },
    });

    const noSuchUser = new TestClient();
    const noSuchUserResult = await noSuchUser.request("/api/auth/login", {
      method: "POST",
      body: { email: testEmail("umuman-yoq"), password: "xato-parol" },
    });

    assert.equal(wrongPasswordResult.status, noSuchUserResult.status);
    assert.equal(
      wrongPasswordResult.error!.message,
      noSuchUserResult.error!.message,
      "ikki holat bir xil xabar qaytarishi kerak (hisob sanashdan himoya)",
    );
  });

  it("bo'sh parolni validatsiyada rad etadi (400)", async () => {
    const client = new TestClient();
    const result = await client.request("/api/auth/login", {
      method: "POST",
      body: { email: "a@b.uz", password: "" },
    });

    assert.equal(result.status, 400);
    assert.ok(result.error!.fieldErrors!.password);
  });
});

describe("chiqish", () => {
  it("sessiyani bekor qiladi va cookie'ni tozalaydi", async () => {
    const email = testEmail("logout");
    const client = new TestClient();

    await client.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Chiquvchi" },
    });

    // Chiqishdan oldin: kirgan
    const before = await client.request<UserPayload>("/api/auth/me");
    assert.ok(before.data!.user);

    const logout = await client.request("/api/auth/logout", { method: "POST" });
    assert.equal(logout.status, 200);
    assert.equal(client.hasCookie(SESSION_COOKIE), false, "cookie tozalanishi kerak");

    // Chiqishdan keyin: kirmagan
    const after = await client.request<{ user: null }>("/api/auth/me");
    assert.equal(after.data!.user, null);
  });

  it("sessiyasi YO'Q token bilan /dashboard HALQAGA tushmaydi", async () => {
    /*
      Cookie imzosi yaroqli, lekin bazadagi sessiya o'chirilgan —
      boshqa qurilmadan chiqilgan yoki sessiya tozalangan holat.

      Ilgari bu yerda cheksiz halqa bor edi: maket `/login` ga
      yuborardi, proxy esa tokenni ko'rib `/dashboard` ga qaytarardi.
      Foydalanuvchi bo'sh ekranni ko'rardi.
    */
    const email = testEmail("halqa");
    const client = new TestClient();
    await client.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Halqa" },
    });

    // Tokenni chiqishdan OLDIN nusxalaymiz.
    const cookies = (client as unknown as { cookies: Map<string, string> }).cookies;
    const rawCookie = cookies.get(SESSION_COOKIE)!;
    const stale = new TestClient();
    (stale as unknown as { cookies: Map<string, string> }).cookies.set(
      SESSION_COOKIE,
      rawCookie,
    );

    await client.request("/api/auth/logout", { method: "POST" });

    /*
      1-qadam: /dashboard cookie'ni tozalaydigan manzilga yuboradi.

      DIQQAT: bu yerda HTTP 307 kutilmaydi. Maketdagi `redirect()`
      javob oqimi boshlangandan keyin ishlaydi, shuning uchun Next.js
      uni sarlavhaga emas, javob TANASIGA yozadi va brauzer o'sha
      manzilga o'zi o'tadi. Ya'ni tekshiruv tanadan qidiriladi.
    */
    const dashboard = await stale.fetchRaw("/dashboard");
    const body = await dashboard.text();
    assert.ok(
      body.includes("/session-expired"),
      "maket cookie'ni tozalaydigan manzilga yo'naltirmagan",
    );

    /*
      2-qadam: u cookie'ni o'chiradi va /login ga yuboradi.

      `visit()` emas, `fetchRaw()`: birinchisi javobdagi cookie'larni
      saqlamaydi, ya'ni tozalanganini ko'rsata olmaydi.
    */
    const expired = await stale.fetchRaw("/session-expired");
    assert.equal(expired.status, 307);
    assert.ok(
      expired.headers.get("location")?.endsWith("/login"),
      expired.headers.get("location") ?? "yo'q",
    );
    assert.equal(
      stale.hasCookie(SESSION_COOKIE),
      false,
      "eskirgan cookie o'chirilishi kerak",
    );

    // 3-qadam: endi kirish sahifasi HAQIQATAN ochiladi, halqa yo'q.
    const login = await stale.visit("/login");
    assert.equal(login.status, 200, "kirish sahifasi ochilishi kerak");
  });

  it("KIRGAN foydalanuvchini /session-expired tizimdan chiqarmaydi", async () => {
    // Boshqa saytdagi <img src="/session-expired"> hujumi ishlamasin.
    const client = new TestClient();
    await client.request("/api/auth/register", {
      method: "POST",
      body: { email: testEmail("chiqarmaydi"), password: PASSWORD, fullName: "Faol" },
    });

    const visited = await client.fetchRaw("/session-expired");

    assert.equal(visited.status, 307);
    assert.ok(
      visited.headers.get("location")?.endsWith("/dashboard"),
      visited.headers.get("location") ?? "yo'q",
    );
    assert.equal(
      client.hasCookie(SESSION_COOKIE),
      true,
      "faol sessiya cookie'si saqlanishi kerak",
    );
  });

  it("chiqqandan keyin ESKI cookie ham ishlamaydi", async () => {
    // Eng muhim tekshiruv: JWT imzosi hali yaroqli, lekin bazadagi sessiya
    // o'chirilgan — demak o'g'irlangan token ham foyda bermaydi.
    const email = testEmail("eski-token");
    const client = new TestClient();

    await client.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Eski token" },
    });

    // Cookie qiymatini qo'lda saqlab olamiz.
    const stolen = new TestClient();
    const meBefore = await client.request<UserPayload>("/api/auth/me");
    assert.ok(meBefore.data!.user);

    // Tokenni "o'g'irlaymiz" — chiqishdan OLDIN.
    const rawCookie = (client as unknown as { cookies: Map<string, string> }).cookies.get(
      SESSION_COOKIE,
    );
    assert.ok(rawCookie, "cookie mavjud bo'lishi kerak");
    (stolen as unknown as { cookies: Map<string, string> }).cookies.set(
      SESSION_COOKIE,
      rawCookie,
    );

    // O'g'irlangan token hozir ishlaydi.
    const stolenWorks = await stolen.request<UserPayload>("/api/auth/me");
    assert.ok(stolenWorks.data!.user, "o'g'irlangan token hozircha ishlaydi");

    // Asl foydalanuvchi chiqadi.
    await client.request("/api/auth/logout", { method: "POST" });

    // Endi o'g'irlangan token ham ishlamasligi kerak.
    const stolenAfter = await stolen.request<{ user: null }>("/api/auth/me");
    assert.equal(
      stolenAfter.data!.user,
      null,
      "chiqishdan keyin token nusxasi ham kuchdan qolishi kerak",
    );
  });
});

describe("himoyalangan sahifalar (proxy)", () => {
  it("kirmagan foydalanuvchini /dashboard dan /login ga yo'naltiradi", async () => {
    const client = new TestClient();

    const response = await client.visit("/dashboard");

    assert.equal(response.status, 307);
    const location = new URL(response.location!, "http://127.0.0.1");
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("next"), "/dashboard");
  });

  it("kirgan foydalanuvchiga /dashboard ni ko'rsatadi", async () => {
    const email = testEmail("dashboard");
    const client = new TestClient();
    await client.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Dashboard" },
    });

    const response = await client.visit("/dashboard");

    assert.equal(response.status, 200);
    assert.equal(response.location, null);
  });

  it("kirgan foydalanuvchini /login dan /dashboard ga qaytaradi", async () => {
    const email = testEmail("login-redirect");
    const client = new TestClient();
    await client.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Redirect" },
    });

    const response = await client.visit("/login");

    assert.equal(response.status, 307);
    assert.equal(new URL(response.location!, "http://127.0.0.1").pathname, "/dashboard");
  });

  it("kirmagan foydalanuvchi uchun /api/auth/me 200 va user: null qaytaradi", async () => {
    // API redirect QILMASLIGI kerak — JSON qaytarishi kerak.
    const client = new TestClient();
    const result = await client.request<{ user: null }>("/api/auth/me");

    assert.equal(result.status, 200);
    assert.equal(result.data!.user, null);
  });
});

describe("kirish urinishlari cheklovi", () => {
  /*
    DIQQAT: barcha e2e sinovlari BITTA IP dan (127.0.0.1) keladi, ya'ni
    IP hisoblagichi butun to'plam davomida to'planib boradi. Shuning uchun
    bu yerda faqat EMAIL o'lchovi tekshiriladi — u har bir sinovda toza
    boshlanadi (yangi email).

    IP chegarasi ataylab ancha yuqori (30): bitta maktabdagi o'qituvchilar
    bitta tashqi manzil ortida ishlaydi va bittasining xatosi butun
    maktabni bloklamasligi kerak.
  */
  it("5 ta xato urinishdan keyin 429 qaytaradi", async () => {
    const email = testEmail("rate-limit");
    const client = new TestClient();

    await client.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Cheklov Sinovi" },
    });

    // 5 ta xato urinish — hammasi 401 bo'lishi kerak.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const result = await client.request("/api/auth/login", {
        method: "POST",
        body: { email, password: "butunlay-boshqa-parol" },
      });
      assert.equal(result.status, 401, `${attempt}-urinish 401 bo'lishi kerak`);
    }

    // 6-urinish — endi bloklanadi.
    const blocked = await client.request("/api/auth/login", {
      method: "POST",
      body: { email, password: "butunlay-boshqa-parol" },
    });
    assert.equal(blocked.status, 429, "6-urinishda 429 kutilgan");
    assert.equal(blocked.error!.code, "too_many_requests");

    // MUHIM: to'g'ri parol ham bloklanadi — aks holda cheklov ma'nosiz
    // bo'lardi (hujumchi to'g'ri parolni topgan zahoti kirardi).
    const evenCorrect = await client.request("/api/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    assert.equal(evenCorrect.status, 429);
  });

  it("muvaffaqiyatli kirish hisoblagichni TOZALAYDI", async () => {
    const email = testEmail("rate-clear");
    const client = new TestClient();

    await client.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Tozalash Sinovi" },
    });

    // Chegaraga yetmasdan bir nechta xato urinish.
    for (let attempt = 0; attempt < 3; attempt++) {
      await client.request("/api/auth/login", {
        method: "POST",
        body: { email, password: "xato" },
      });
    }

    // To'g'ri parol bilan kiramiz — hisoblagich tozalanishi kerak.
    const success = await client.request("/api/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    assert.equal(success.status, 200);

    // Endi yana 5 ta xato urinish qilsak ham, 5-tasigacha 401 bo'lishi
    // kerak — ya'ni hisoblagich noldan boshlangan.
    for (let attempt = 1; attempt <= 5; attempt++) {
      const result = await client.request("/api/auth/login", {
        method: "POST",
        body: { email, password: "xato" },
      });
      assert.equal(
        result.status,
        401,
        `tozalashdan keyin ${attempt}-urinish 401 bo'lishi kerak`,
      );
    }
  });
});

describe("ro'yxatdan o'tish cheklovi", () => {
  /**
   * Chegara `REGISTER_MAX_PER_IP` bilan sozlanadi va sinov muhitida
   * ataylab ko'tarilgan (global-server.ts). Shuning uchun bu yerda
   * hisoblagich HTTP so'rovlar bilan emas, to'g'ridan-to'g'ri baza
   * yozuvlari bilan to'ldiriladi — aks holda sinov 300 ta hisob
   * yaratishga majbur bo'lardi.
   */
  const LIMIT = Number(process.env.REGISTER_MAX_PER_IP ?? 10);

  /** Sinov o'zidan keyin hisoblagichni tozalaydi. */
  async function clearRegisterCounter(): Promise<void> {
    const { prisma } = await import("../../lib/db");
    await prisma.loginAttempt.deleteMany({ where: { kind: "register" } });
  }

  it("chegaradan oshganda 429 va TUSHUNARLI xabar qaytadi", async () => {
    const { prisma } = await import("../../lib/db");
    await clearRegisterCounter();

    /*
      Hisoblagichni to'ldiramiz.

      `x-forwarded-for` AYNAN shu sarlavha bo'lishi kerak: `clientIp()`
      avval uni o'qiydi va faqat topilmasa `x-real-ip` ga o'tadi. Next
      dev serveri `x-forwarded-for` ni o'zi qo'shadi, ya'ni `x-real-ip`
      hech qachon o'qilmasdi va sinov soxta IP o'rniga 127.0.0.1 ni
      to'ldirardi.
    */
    const ip = "203.0.113.77";
    await prisma.loginAttempt.createMany({
      data: Array.from({ length: LIMIT }, () => ({ identifier: ip, kind: "register" })),
    });

    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({
        email: testEmail("royxat-cheklov"),
        password: PASSWORD,
        fullName: "Sinov O'qituvchi",
      }),
    });

    assert.equal(response.status, 429);

    const json = (await response.json()) as {
      error: { code: string; message: string };
    };
    assert.equal(json.error.code, "too_many_requests");
    assert.equal(json.error.message, text("uz", "errors.domain.tooManyRegistrations"));
    // Foydalanuvchiga texnik tafsilot (IP, hisoblagich) ko'rsatilmaydi.
    assert.ok(!/rate limit|ip=|used=/i.test(json.error.message));

    await clearRegisterCounter();
  });

  it("chegaradan PASTDA ro'yxatdan o'tish ishlaydi", async () => {
    const { prisma } = await import("../../lib/db");
    await clearRegisterCounter();

    const ip = "203.0.113.78";
    // Chegaradan bitta kam — oxirgi joy bo'sh qoladi.
    await prisma.loginAttempt.createMany({
      data: Array.from({ length: LIMIT - 1 }, () => ({
        identifier: ip,
        kind: "register",
      })),
    });

    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({
        email: testEmail("royxat-oxirgi-joy"),
        password: PASSWORD,
        fullName: "Sinov O'qituvchi",
      }),
    });

    assert.equal(response.status, 201, "oxirgi bo'sh joy ishlatilishi kerak");

    await clearRegisterCounter();
  });

  it("muvaffaqiyatli KIRISH ro'yxat hisoblagichini tozalamaydi", async () => {
    /*
      Nozik joy: `clearLoginAttempts` identifikator bo'yicha o'chiradi.
      `kind` filtri bo'lmasa, ayni IP'dan muvaffaqiyatli kirish
      ro'yxatdan o'tish hisoblagichini ham nolga qaytarardi — ya'ni
      hujumchi o'nta hisob ochib, bittasiga kirib, yana o'ntasini
      ocha olardi.
    */
    const { prisma } = await import("../../lib/db");
    await clearRegisterCounter();

    const ip = "203.0.113.79";
    await prisma.loginAttempt.createMany({
      data: Array.from({ length: LIMIT }, () => ({ identifier: ip, kind: "register" })),
    });

    // Shu IP'dan muvaffaqiyatli kirish.
    const email = testEmail("royxat-kirish");
    const client = new TestClient();
    await client.request("/api/auth/register", {
      method: "POST",
      body: { email, password: PASSWORD, fullName: "Sinov O'qituvchi" },
    });

    await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email, password: PASSWORD }),
    });

    // Hisoblagich HALI ham to'la bo'lishi kerak.
    const remaining = await prisma.loginAttempt.count({
      where: { identifier: ip, kind: "register" },
    });
    assert.equal(remaining, LIMIT, "kirish ro'yxat hisoblagichini tozalab yubordi");

    await clearRegisterCounter();
  });
});
