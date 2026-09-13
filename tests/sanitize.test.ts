import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripTags } from "../lib/validations/sanitize";
import { subjectSchema, topicSchema } from "../lib/validations/common";

/**
 * Matn tozalash sinovlari.
 *
 * ── Bu yerda ENG MUHIM narsa — NIMANI TEGMASLIK ───────────────────────────
 * Tozalashning asosiy xavfi zaiflik emas, balki HAQIQIY matnni buzish:
 * matematika o'qituvchisi mavzuga "5 < 7" deb yozadi va uning matni
 * qirqilsa, u nima bo'lganini tushunmaydi. Shuning uchun sinovlarning
 * yarmi aynan shu holatlarni qo'riqlaydi.
 */

describe("stripTags — xavfli teglarni olib tashlaydi", () => {
  it("script tegini MAZMUNI bilan birga kesadi", () => {
    assert.equal(stripTags("Kasrlar<script>alert(1)</script>"), "Kasrlar");
  });

  it("iframe, object, embed, style ham kesiladi", () => {
    for (const tag of ["iframe", "object", "embed", "style", "template"]) {
      const result = stripTags(`Mavzu<${tag}>yomon</${tag}>`);
      assert.equal(result, "Mavzu", `${tag} kesilmadi`);
    }
  });

  it("oddiy teglarni olib tashlaydi, matnni QOLDIRADI", () => {
    assert.equal(stripTags("<b>Kasrlar</b> bilan amallar"), "Kasrlar bilan amallar");
  });

  it("yopilmagan tegni ham kesadi", () => {
    // `<script` (yopilmagan) — brauzer buni baribir teg deb o'qishi mumkin.
    assert.equal(stripTags("Mavzu <script src=x"), "Mavzu");
  });

  it("katta-kichik harf farq qilmaydi", () => {
    assert.equal(stripTags("Mavzu<SCRIPT>x</SCRIPT>"), "Mavzu");
  });

  it("ortiqcha bo'shliqlarni yig'ishtiradi", () => {
    assert.equal(stripTags("Kasrlar   <b>  </b>   amallar"), "Kasrlar amallar");
  });
});

describe("stripTags — HAQIQIY matnga tegmaydi", () => {
  it("matematik tengsizlikni saqlaydi", () => {
    // Eng muhim holat: `<` dan keyin bo'shliq bor, ya'ni bu teg emas.
    assert.equal(stripTags("5 < 7 tengsizligi"), "5 < 7 tengsizligi");
    assert.equal(stripTags("a > b taqqoslash"), "a > b taqqoslash");
  });

  it("o'zbek lotin apostroflariga tegmaydi", () => {
    assert.equal(
      stripTags("O'simliklarning ko'payishi va g'o'za"),
      "O'simliklarning ko'payishi va g'o'za",
    );
  });

  it("kirill matnga tegmaydi", () => {
    assert.equal(stripTags("Действия с дробями"), "Действия с дробями");
  });

  it("qo'shtirnoq va qavslarga tegmaydi", () => {
    assert.equal(
      stripTags('«Kasrlar» mavzusi (7-sinf) — "asosiy qism"'),
      '«Kasrlar» mavzusi (7-sinf) — "asosiy qism"',
    );
  });

  it("oddiy mavzu nomi o'zgarmaydi", () => {
    const topic = "Kasrlarni qo'shish va ayirish";
    assert.equal(stripTags(topic), topic);
  });
});

describe("sxemalar tozalangan matn ustida ishlaydi", () => {
  it("mavzu tozalanib saqlanadi", () => {
    const result = topicSchema.parse("<b>Kasrlar bilan amallar</b>");
    assert.equal(result, "Kasrlar bilan amallar");
  });

  it("tozalangach BO'SH qolgan qiymat RAD ETILADI", () => {
    /*
      Nozik joy: tekshiruv tozalashdan KEYIN bo'lishi kerak. Oldin
      bo'lsa, "<b></b>" (7 belgi) uzunlik tekshiruvidan o'tib ketar va
      bazaga bo'sh mavzu tushardi.
    */
    const result = topicSchema.safeParse("<b></b>");
    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0]?.message, "errors.validation.topicTooShort");
  });

  it("fan nomi ham tozalanadi", () => {
    assert.equal(subjectSchema.parse("Matematika<script>x</script>"), "Matematika");
  });

  it("haqiqiy mavzu tekshiruvdan bemalol o'tadi", () => {
    assert.equal(subjectSchema.parse("Matematika"), "Matematika");
    assert.equal(topicSchema.parse("5 < 7 tengsizligi"), "5 < 7 tengsizligi");
  });
});
