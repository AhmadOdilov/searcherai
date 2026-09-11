import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

/**
 * Sessiya JWT'i sinovlari — baza kerak emas.
 */

const SECRET = "sinov-uchun-kalit-kamida-32-belgi-boisin!!";

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
});

describe("sessiya JWT", () => {
  it("imzolab, qaytarib o'qiydi", async () => {
    const { signSessionToken, verifySessionToken, sessionExpiry } =
      await import("../lib/auth/jwt");

    const token = await signSessionToken(
      { sid: "sessiya-1", uid: "foydalanuvchi-1" },
      sessionExpiry(),
    );
    const claims = await verifySessionToken(token);

    assert.deepEqual(claims, { sid: "sessiya-1", uid: "foydalanuvchi-1" });
  });

  it("buzilgan tokenni rad etadi", async () => {
    const { signSessionToken, verifySessionToken, sessionExpiry } =
      await import("../lib/auth/jwt");

    const token = await signSessionToken({ sid: "s", uid: "u" }, sessionExpiry());
    // Oxirgi belgini o'zgartiramiz — imzo buziladi.
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");

    assert.equal(await verifySessionToken(tampered), null);
  });

  it("boshqa kalit bilan imzolangan tokenni rad etadi", async () => {
    const { signSessionToken, verifySessionToken, sessionExpiry } =
      await import("../lib/auth/jwt");

    const token = await signSessionToken({ sid: "s", uid: "u" }, sessionExpiry());

    // Kalit o'zgardi — masalan productionda AUTH_SECRET almashtirildi.
    process.env.AUTH_SECRET = "butunlay-boshqa-kalit-kamida-32-belgi-uzun!";
    assert.equal(
      await verifySessionToken(token),
      null,
      "kalit o'zgarsa eski sessiyalar kuchdan qolishi kerak",
    );
  });

  it("muddati o'tgan tokenni rad etadi", async () => {
    const { signSessionToken, verifySessionToken } = await import("../lib/auth/jwt");

    const past = new Date(Date.now() - 60_000);
    const token = await signSessionToken({ sid: "s", uid: "u" }, past);

    assert.equal(await verifySessionToken(token), null);
  });

  it("bo'sh yoki shakli buzuq tokenni rad etadi", async () => {
    const { verifySessionToken } = await import("../lib/auth/jwt");

    assert.equal(await verifySessionToken(""), null);
    assert.equal(await verifySessionToken("umuman-jwt-emas"), null);
    assert.equal(await verifySessionToken("a.b.c"), null);
  });

  it("AUTH_SECRET juda qisqa bo'lsa xato tashlaydi", async () => {
    const { signSessionToken, sessionExpiry } = await import("../lib/auth/jwt");

    process.env.AUTH_SECRET = "qisqa";
    await assert.rejects(
      () => signSessionToken({ sid: "s", uid: "u" }, sessionExpiry()),
      /AUTH_SECRET/,
    );
  });

  it("sessiya muddati 30 kun", async () => {
    const { sessionExpiry, SESSION_TTL_DAYS } = await import("../lib/auth/jwt");

    const from = new Date("2026-09-11T00:00:00.000Z");
    const expiry = sessionExpiry(from);

    assert.equal(SESSION_TTL_DAYS, 30);
    assert.equal(expiry.toISOString(), "2026-10-11T00:00:00.000Z");
  });
});

describe("parol hash'lash", () => {
  it("hash yaratadi va tekshiradi", async () => {
    const bcrypt = (await import("bcryptjs")).default;

    const hash = await bcrypt.hash("maxfiy-parol", 12);
    assert.notEqual(hash, "maxfiy-parol", "parol ochiq saqlanmasligi kerak");
    assert.ok(hash.startsWith("$2"), "bcrypt formatida bo'lishi kerak");
    assert.equal(await bcrypt.compare("maxfiy-parol", hash), true);
    assert.equal(await bcrypt.compare("boshqa-parol", hash), false);
  });

  it("bir xil parol har safar boshqa hash beradi (tuz bor)", async () => {
    const bcrypt = (await import("bcryptjs")).default;

    const first = await bcrypt.hash("bir-xil", 10);
    const second = await bcrypt.hash("bir-xil", 10);
    assert.notEqual(first, second);
    // Ikkalasi ham ishlashi kerak.
    assert.equal(await bcrypt.compare("bir-xil", first), true);
    assert.equal(await bcrypt.compare("bir-xil", second), true);
  });
});
