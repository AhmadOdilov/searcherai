import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { TestClient, cleanupTestUsers, testEmail } from "./helpers/client";

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
