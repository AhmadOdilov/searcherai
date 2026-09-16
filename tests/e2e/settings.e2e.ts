import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  TestClient,
  cleanupTestUsers,
  testEmail,
  waitForGeneration,
} from "./helpers/client";

/**
 * Hisob sozlamalari — uchidan-uchgacha.
 *
 * ── Eng muhim qismi: hisobni o'chirish ────────────────────────────────────
 * Bazadagi `onDelete: Cascade` yozuvlarni o'chiradi, lekin FAYL TIZIMINI
 * bilmaydi. Shuning uchun bu yerda faqat "hisob o'chdimi" emas,
 * FAYLLAR ham o'chganmi tekshiriladi — yo'llar yozuv bilan birga
 * yo'qolgach, ularni boshqa hech qachon topib bo'lmaydi.
 */

const PASSWORD = "juda-maxfiy-parol";
const NEW_PASSWORD = "yangi-maxfiy-parol";

after(async () => {
  await cleanupTestUsers();
});

async function signedInClient(
  suffix: string,
): Promise<{ client: TestClient; email: string; userId: string }> {
  const client = new TestClient();
  const email = testEmail(suffix);
  const result = await client.request("/api/auth/register", {
    method: "POST",
    body: { email, password: PASSWORD, fullName: "Sozlama Sinovi" },
  });
  assert.equal(result.status, 201);

  const { prisma } = await import("../../lib/db");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { client, email, userId: user.id };
}

/**
 * Sessiya hali KIMNIDIR tanitadimi.
 *
 * ── Nega holat kodi tekshirilmaydi ────────────────────────────────────────
 * `/api/auth/me` kirmagan foydalanuvchi uchun ham 200 qaytaradi, tanasi
 * esa `{ user: null }` bo'ladi. Bu ataylab: "kim ekanini so'rash"
 * muvaffaqiyatli bajarildi, javob esa "hech kim" (route izohiga qarang).
 *
 * Shuning uchun sessiya bekor qilinganini TANADAN bilish kerak.
 */
async function identifiesUser(client: TestClient): Promise<boolean> {
  const result = await client.request<{ user: unknown }>("/api/auth/me");
  return result.status === 200 && result.data?.user != null;
}

describe("profil ma'lumotlari", () => {
  it("ism va telefon saqlanadi", async () => {
    const { client, userId } = await signedInClient("profil-saqlash");

    const result = await client.request("/api/user/profile", {
      method: "PATCH",
      body: { fullName: "Yangi Ism Familiya", phone: "+998 90 123 45 67" },
    });
    assert.equal(result.status, 200);

    const { prisma } = await import("../../lib/db");
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fullName: true, phone: true },
    });
    assert.equal(row.fullName, "Yangi Ism Familiya");
    assert.equal(row.phone, "+998 90 123 45 67");
  });

  it("BO'SH telefon `null` bo'lib yoziladi", async () => {
    // `@unique` bo'sh satrlarni to'qnashtirardi — shuning uchun `null`.
    const { client, userId } = await signedInClient("profil-telefon");

    await client.request("/api/user/profile", {
      method: "PATCH",
      body: { fullName: "Telefon Yo'q", phone: "" },
    });

    const { prisma } = await import("../../lib/db");
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phone: true },
    });
    assert.equal(row.phone, null);
  });

  it("NOTO'G'RI telefon rad etiladi", async () => {
    const { client } = await signedInClient("profil-xato");

    const result = await client.request("/api/user/profile", {
      method: "PATCH",
      body: { fullName: "Ism Familiya", phone: "raqam emas!" },
    });
    assert.equal(result.status, 400);
  });

  it("EMAIL o'zgartirib bo'lmaydi — notanish maydon rad etiladi", async () => {
    const { client, email } = await signedInClient("profil-email");

    const result = await client.request("/api/user/profile", {
      method: "PATCH",
      body: { fullName: "Ism", phone: "", email: "boshqa@sinov.uz" },
    });

    assert.equal(result.status, 400, "email maydoni qabul qilindi");

    const { prisma } = await import("../../lib/db");
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: (await prisma.user.findUniqueOrThrow({ where: { email } })).id },
      select: { email: true },
    });
    assert.equal(row.email, email);
  });

  it("kirmagan foydalanuvchi rad etiladi", async () => {
    const anonymous = new TestClient();
    const result = await anonymous.request("/api/user/profile", {
      method: "PATCH",
      body: { fullName: "Begona", phone: "" },
    });
    assert.equal(result.status, 401);
  });
});

describe("parolni o'zgartirish", () => {
  it("to'g'ri joriy parol bilan o'zgaradi va YANGI parol ishlaydi", async () => {
    const { client, email } = await signedInClient("parol-ozgarish");

    const changed = await client.request("/api/user/password", {
      method: "PUT",
      body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    });
    assert.equal(changed.status, 200);

    // Eski parol endi ishlamasligi kerak.
    const oldLogin = new TestClient();
    const withOld = await oldLogin.request("/api/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    assert.equal(withOld.status, 401, "eski parol hamon ishlayapti");

    // Yangisi ishlashi kerak.
    const newLogin = new TestClient();
    const withNew = await newLogin.request("/api/auth/login", {
      method: "POST",
      body: { email, password: NEW_PASSWORD },
    });
    assert.equal(withNew.status, 200);
  });

  it("NOTO'G'RI joriy parol rad etiladi", async () => {
    const { client } = await signedInClient("parol-notogri");

    const result = await client.request("/api/user/password", {
      method: "PUT",
      body: { currentPassword: "butunlay-boshqa-parol", newPassword: NEW_PASSWORD },
    });
    assert.equal(result.status, 400);
  });

  it("qisqa yangi parol rad etiladi", async () => {
    const { client } = await signedInClient("parol-qisqa");

    const result = await client.request("/api/user/password", {
      method: "PUT",
      body: { currentPassword: PASSWORD, newPassword: "qisqa" },
    });
    assert.equal(result.status, 400);
  });

  it("parol o'zgargach BOSHQA sessiyalar bekor qilinadi", async () => {
    /*
      Parolni o'zgartirishning asosiy sababi — "kimdir hisobimga kirdi"
      degan shubha. Eski sessiyalar qolsa, hujumchi kirgan holida
      qolardi va amal hech narsa bermasdi.
    */
    const { client, email } = await signedInClient("parol-sessiya");

    // Ikkinchi qurilma.
    const other = new TestClient();
    const login = await other.request("/api/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    assert.equal(login.status, 200);
    assert.ok(await identifiesUser(other), "ikkinchi qurilma kira olmadi");

    await client.request("/api/user/password", {
      method: "PUT",
      body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    });

    // Ikkinchi qurilma chiqarilgan bo'lishi kerak.
    assert.equal(await identifiesUser(other), false, "boshqa qurilma sessiyasi qoldi");

    // Parolni o'zgartirgan qurilma esa ishlashda davom etadi.
    assert.ok(await identifiesUser(client), "o'z qurilmasi ham chiqarib yuborildi");
  });
});

describe("barcha qurilmalardan chiqish", () => {
  it("boshqa sessiya bekor qilinadi, joriysi qoladi", async () => {
    const { client, email } = await signedInClient("sessiya-chiqish");

    const other = new TestClient();
    await other.request("/api/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD },
    });
    assert.ok(await identifiesUser(other));

    const revoked = await client.request("/api/user/sessions", { method: "DELETE" });
    assert.equal(revoked.status, 200);

    assert.equal(await identifiesUser(other), false, "boshqa qurilma qoldi");
    assert.ok(await identifiesUser(client), "joriy qurilma chiqarib yuborildi");
  });
});

describe("hisobni o'chirish", () => {
  it("FAYLLAR ham o'chadi — cascade ularni bilmaydi", async () => {
    /*
      Bu sinovning butun sababi shu. `onDelete: Cascade` yozuvni
      o'chiradi, lekin diskdagi .pptx/.xlsx qoladi va yo'li yozuv bilan
      birga yo'qolgani uchun uni boshqa topib bo'lmaydi.
    */
    const { client, userId } = await signedInClient("ochirish-fayllar");

    const created = await client.request<{ presentation: { id: string } }>(
      "/api/presentations",
      { method: "POST", body: { mode: "standalone", topic: "O'chiriladigan fayl" } },
    );
    assert.equal(created.status, 202);

    const ready = await waitForGeneration<{ status: string; filePath: string | null }>(
      client,
      `/api/presentations/${created.data!.presentation.id}`,
      "presentation",
    );
    assert.equal(ready.status, "READY");
    assert.ok(ready.filePath, "fayl yaratilmadi");

    // Fayl HAQIQATAN saqlagichda ekanini tasdiqlaymiz.
    const { getFile } = await import("../../lib/storage/files");
    assert.ok(await getFile("pptx", ready.filePath!), "fayl saqlagichda yo'q");

    const deleted = await client.request("/api/user/account", {
      method: "DELETE",
      body: { password: PASSWORD },
    });
    assert.equal(deleted.status, 200);

    // Yozuv ham, fayl ham yo'q bo'lishi kerak.
    const { prisma } = await import("../../lib/db");
    assert.equal(await prisma.user.count({ where: { id: userId } }), 0);
    assert.equal(
      await getFile("pptx", ready.filePath!),
      null,
      "hisob o'chdi, lekin FAYL diskda qoldi",
    );
  });

  it("NOTO'G'RI parol bilan o'chirib bo'lmaydi", async () => {
    const { client, userId } = await signedInClient("ochirish-parol");

    const result = await client.request("/api/user/account", {
      method: "DELETE",
      body: { password: "boshqa-parol" },
    });
    assert.equal(result.status, 400);

    const { prisma } = await import("../../lib/db");
    assert.equal(await prisma.user.count({ where: { id: userId } }), 1);
  });

  it("o'chirilgandan keyin sessiya ishlamaydi", async () => {
    const { client } = await signedInClient("ochirish-sessiya");

    await client.request("/api/user/account", {
      method: "DELETE",
      body: { password: PASSWORD },
    });

    assert.equal(
      await identifiesUser(client),
      false,
      "hisob o'chdi, lekin sessiya hamon ishlayapti",
    );
  });

  it("kirmagan foydalanuvchi hisob o'chira olmaydi", async () => {
    const anonymous = new TestClient();
    const result = await anonymous.request("/api/user/account", {
      method: "DELETE",
      body: { password: PASSWORD },
    });
    assert.equal(result.status, 401);
  });
});
