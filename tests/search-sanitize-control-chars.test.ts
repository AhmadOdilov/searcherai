import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripTags } from "../lib/validations/sanitize";
import { searchInputSchema } from "../lib/validations/search";
import { normalizeQuery } from "../lib/search/normalization";

const NUL = String.fromCharCode(0);
const SOH = String.fromCharCode(1);
const DEL = String.fromCharCode(127);

/*
  PostgreSQL `text` ustunida NUL baytini saqlay olmaydi va so'rovda uchrasa
  22021 xatosi bilan yiqiladi. V4 da NUL bayti zod sxemasidan ham,
  `stripTags` dan ham o'tib ketib, qidiruv so'rovi sifatida bazaga
  yetib borardi — ya'ni foydalanuvchi /api/search ni 500 xatoga olib
  kelishi mumkin edi.
*/
describe("boshqaruv belgilaridan himoya (V5 regressiya)", () => {
  it("stripTags NUL va boshqa C0 belgilarni olib tashlaydi", () => {
    const out = stripTags(`kasrlar${NUL}${SOH} mavzusi${DEL}`);
    assert.equal(out.includes(NUL), false);
    assert.equal(out.includes(SOH), false);
    assert.equal(out.includes(DEL), false);
    assert.match(out, /kasrlar/);
    assert.match(out, /mavzusi/);
  });

  it("qidiruv sxemasidan o'tgan savolda boshqaruv belgisi QOLMAYDI", () => {
    const parsed = searchInputSchema.parse({
      question: `5-sinf matematika kasrlar${NUL} mavzusi`,
      language: "UZ",
    });
    const controls = [...parsed.question].filter((ch) => ch.charCodeAt(0) < 32);
    assert.deepEqual(controls, []);
  });

  it("normalizatsiya chaqiruvchining tozalaganiga TAYANMAYDI", () => {
    // Baholash skriptlari va fon vazifalari API qatlamini chetlab o'tadi.
    const normalized = normalizeQuery(`8-sinf matematika kvadrat${NUL} tenglama`);
    assert.equal(normalized.normalized.includes(NUL), false);
    assert.equal(normalized.original.includes(NUL), false);
  });

  it("ko'rinmas yo'naltiruvchi belgilar ham olib tashlanadi", () => {
    const zeroWidth = String.fromCharCode(0x200b);
    const rtlOverride = String.fromCharCode(0x202e);
    const normalized = normalizeQuery(`kas${zeroWidth}rlar${rtlOverride} mavzusi`);
    assert.equal(normalized.normalized.includes(zeroWidth), false);
    assert.equal(normalized.normalized.includes(rtlOverride), false);
  });

  it("oddiy matn va matematik belgilar buzilmaydi", () => {
    assert.equal(stripTags("5 < 7 tengsizligi"), "5 < 7 tengsizligi");
  });
});
