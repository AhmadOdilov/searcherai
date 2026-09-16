import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createLogger, describeError } from "../lib/observability/log";

/**
 * Loglar qatlami — XAVFSIZLIK sinovi.
 *
 * ── Nega bu sinov muhim ───────────────────────────────────────────────────
 * Loglar odatda hech kim o'qimaydigan joy sifatida qaraladi, aynan
 * shuning uchun ularga sir tushib ketishi oson: kimdir kontekstga
 * `token` yoki `password` qo'shib qo'yadi va uni bir necha oy hech kim
 * sezmaydi.
 *
 * `redact()` buni kalit NOMI bo'yicha avtomatik to'sadi — ya'ni
 * chaqiruvchi xato qilsa ham sir logga tushmaydi. Bu sinov o'sha
 * kafolatni tekshiradi.
 */

/** `console` chaqiruvlarini ushlaydi. */
function capture(level: "log" | "warn" | "error") {
  const lines: string[] = [];
  mock.method(console, level, (line: string) => {
    lines.push(line);
  });
  return lines;
}

describe("logger — sirlar", () => {
  it("SIR nomli maydonlar logga TUSHMAYDI", () => {
    const lines = capture("warn");
    const log = createLogger("sinov");

    log.warn("urinish", {
      requestId: "abc-123",
      password: "juda-maxfiy-parol",
      apiKey: "sk-1234567890",
      sessionToken: "eyJhbGciOi",
      authorization: "Bearer xyz",
      cookie: "searcher_session=...",
      secret: "AUTH_SECRET qiymati",
    });

    mock.restoreAll();
    const line = lines.join("\n");

    for (const leaked of [
      "juda-maxfiy-parol",
      "sk-1234567890",
      "eyJhbGciOi",
      "Bearer xyz",
      "searcher_session=",
      "AUTH_SECRET qiymati",
    ]) {
      assert.ok(!line.includes(leaked), `LOGGA SIR TUSHDI: ${leaked}`);
    }

    // Xavfsiz maydonlar esa qolishi kerak.
    assert.ok(line.includes("requestId=abc-123"));
  });

  it("sir maydonlari o'chirilgan deb BELGILANADI, jim tashlanmaydi", () => {
    // Maydon butunlay yo'qolsa, uni kimdir qo'shganini ham bilib
    // bo'lmaydi. Belgi esa "bu yerda nimadir bor edi" deydi.
    const lines = capture("warn");
    createLogger("sinov").warn("xabar", { apiKey: "sir" });
    mock.restoreAll();

    assert.match(lines.join(""), /apiKey=\[olib tashlandi\]/);
  });

  it("kalit nomining BIR QISMI mos kelsa ham to'siladi", () => {
    const lines = capture("warn");
    createLogger("sinov").warn("xabar", {
      userPassword: "a",
      api_key: "b",
      refreshToken: "c",
    });
    mock.restoreAll();

    const line = lines.join("");
    for (const leaked of ["=a", "=b", "=c"]) {
      assert.ok(!line.includes(leaked), `to'silmadi: ${leaked}`);
    }
  });
});

describe("logger — format", () => {
  it("mavjud PREFIKS saqlanadi", () => {
    // Operator loglarni aynan shu bo'yicha filtrlaydi.
    const lines = capture("warn");
    createLogger("storage:s3").warn("fayl o'qilmadi", { route: "/api/x" });
    mock.restoreAll();

    assert.match(lines[0], /^\[storage:s3\] fayl o'qilmadi/);
  });

  it("kontekst `kalit=qiymat` ko'rinishida qo'shiladi", () => {
    const lines = capture("warn");
    createLogger("api").warn("validation", {
      requestId: "r1",
      route: "/api/lesson-plans",
      status: 400,
    });
    mock.restoreAll();

    assert.match(lines[0], /requestId=r1/);
    assert.match(lines[0], /route=\/api\/lesson-plans/);
    assert.match(lines[0], /status=400/);
  });

  it("kontekstsiz ham ishlaydi", () => {
    const lines = capture("log");
    createLogger("fon").info("tugadi");
    mock.restoreAll();

    assert.equal(lines[0], "[fon] tugadi");
  });

  it("`undefined` maydonlar tashlab yuboriladi", () => {
    const lines = capture("warn");
    createLogger("api").warn("xabar", { requestId: "r1", userId: undefined });
    mock.restoreAll();

    assert.ok(!lines[0].includes("userId"), "bo'sh maydon logga tushdi");
  });

  it("daraja mos `console` metodiga tushadi", () => {
    const errors = capture("error");
    createLogger("api").error("xato");
    mock.restoreAll();
    assert.equal(errors.length, 1);
  });
});

describe("describeError", () => {
  it("xato nomi va xabarini qaytaradi, STACK'ni EMAS", () => {
    /*
      `stack` ataylab chiqarilmaydi: u uzun, loglarni to'ldiradi va
      fayl yo'llari orqali ichki tuzilmani oshkor qilishi mumkin.
    */
    const error = new TypeError("noto'g'ri qiymat");
    const text = describeError(error);

    assert.equal(text, "TypeError: noto'g'ri qiymat");
    assert.ok(!text.includes("at "), "stack chiqib ketdi");
  });

  it("xato bo'lmagan qiymatni ham matnga aylantiradi", () => {
    assert.equal(describeError("oddiy matn"), "oddiy matn");
    assert.equal(describeError(42), "42");
    assert.equal(describeError(null), "null");
  });
});
