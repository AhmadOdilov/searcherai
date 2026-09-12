import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginSchema, registerSchema } from "../lib/validations/auth";

/**
 * Auth sxemalari sinovlari — forma xatolari aynan shu qoidalardan chiqadi.
 */

describe("registerSchema", () => {
  it("to'g'ri ma'lumotni qabul qiladi", () => {
    const parsed = registerSchema.parse({
      email: "aziza@maktab.uz",
      password: "juda-maxfiy-parol",
      fullName: "Aziza Karimova",
    });

    assert.equal(parsed.email, "aziza@maktab.uz");
    assert.equal(parsed.fullName, "Aziza Karimova");
    assert.equal(parsed.language, "UZ", "til ko'rsatilmasa UZ bo'lishi kerak");
  });

  it("emailni kichik harfga o'giradi va bo'shliqni kesadi", () => {
    // Bu MUHIM: aks holda "Aziza@Maktab.uz" va "aziza@maktab.uz" ikkita
    // alohida hisob bo'lib qolardi.
    const parsed = registerSchema.parse({
      email: "  Aziza@MAKTAB.uz  ",
      password: "juda-maxfiy-parol",
      fullName: "  Aziza Karimova  ",
    });

    assert.equal(parsed.email, "aziza@maktab.uz");
    assert.equal(parsed.fullName, "Aziza Karimova");
  });

  it("noto'g'ri email formatini rad etadi", () => {
    const result = registerSchema.safeParse({
      email: "email-emas",
      password: "juda-maxfiy-parol",
      fullName: "Aziza",
    });

    assert.equal(result.success, false);
    assert.ok(
      result.error!.issues.some((issue) => issue.path[0] === "email"),
      "email maydonida xato bo'lishi kerak",
    );
  });

  it("qisqa parolni rad etadi", () => {
    const result = registerSchema.safeParse({
      email: "a@b.uz",
      password: "1234567",
      fullName: "Aziza",
    });

    assert.equal(result.success, false);
    const issue = result.error!.issues.find((i) => i.path[0] === "password");
    assert.ok(issue);
    // Xabar endi TARJIMA KALITI — tarjima `withErrorHandling` da qilinadi,
    // chunki sxema yaratilganda foydalanuvchi tili hali noma'lum.
    assert.equal(issue.message, "errors.validation.passwordTooShort");
  });

  it("72 belgidan uzun parolni rad etadi", () => {
    // bcrypt 72 baytdan keyingi qismni JIM tashlab yuboradi — foydalanuvchi
    // uzun parol yozgan deb o'ylab, aslida qisqasi bilan himoyalangan bo'ladi.
    const result = registerSchema.safeParse({
      email: "a@b.uz",
      password: "x".repeat(73),
      fullName: "Aziza",
    });

    assert.equal(result.success, false);
    assert.ok(result.error!.issues.some((i) => i.path[0] === "password"));
  });

  it("bo'sh ismni rad etadi", () => {
    const result = registerSchema.safeParse({
      email: "a@b.uz",
      password: "juda-maxfiy-parol",
      fullName: " ",
    });

    assert.equal(result.success, false);
    assert.ok(result.error!.issues.some((i) => i.path[0] === "fullName"));
  });

  it("rolni so'rovdan QABUL QILMAYDI", () => {
    // Hujumchi o'zini ADMIN qilib ro'yxatdan o'tmasligi kerak.
    const parsed = registerSchema.parse({
      email: "a@b.uz",
      password: "juda-maxfiy-parol",
      fullName: "Aziza",
      role: "ADMIN",
    });

    assert.equal("role" in parsed, false, "role sxemadan o'tmasligi kerak");
  });
});

describe("loginSchema", () => {
  it("parolga uzunlik qoidasini QO'LLAMAYDI", () => {
    // Eski, qisqa parolli foydalanuvchi ham kirishi kerak.
    const result = loginSchema.safeParse({
      email: "a@b.uz",
      password: "123",
    });

    assert.equal(result.success, true);
  });

  it("bo'sh parolni rad etadi", () => {
    const result = loginSchema.safeParse({ email: "a@b.uz", password: "" });

    assert.equal(result.success, false);
    assert.ok(result.error!.issues.some((i) => i.path[0] === "password"));
  });

  it("emailni normallashtiradi", () => {
    const parsed = loginSchema.parse({
      email: "AZIZA@Maktab.UZ",
      password: "parol",
    });
    assert.equal(parsed.email, "aziza@maktab.uz");
  });
});
