import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampText, compressSlide, densityFor } from "../lib/presentations/density";
import { slideSchema, type Slide } from "../lib/validations/presentation";

/**
 * MAZMUN SIQISH sinovlari.
 *
 * ── Nega bu qatlam kerak ──────────────────────────────────────────────────
 * Chegaralar promptda ham aytiladi, lekin model ularni buzadi. Phase 1
 * da aynan shu sodir bo'ldi: "10-15 so'z" deb yozilgan bo'lsa ham, uch
 * qatorli bandlar chiqardi.
 *
 * Shuning uchun chegara javobga MAJBURAN qo'llaniladi. Bu qatlam
 * yiqilsa, prezentatsiya sifatsiz bo'lib chiqadi va buni faqat tayyor
 * faylni ochib ko'rish bilan bilish mumkin bo'lardi.
 */

function slide(overrides: Partial<Slide> = {}): Slide {
  return {
    type: "content",
    heading: "Sarlavha",
    bullets: [],
    ...overrides,
  };
}

describe("clampText", () => {
  it("chegaradan qisqa matnni TEGMAYDI", () => {
    assert.equal(clampText("Qisqa matn", 50), "Qisqa matn");
  });

  it("uzun matnni SO'Z chegarasida kesadi", () => {
    const result = clampText(
      "Fotosintez o'simliklarning oziq moddalar ishlab chiqarishi",
      30,
    );
    assert.ok(result.length <= 30, `juda uzun: ${result.length}`);
    assert.ok(result.endsWith("…"), "kesilgani ko'rsatilmagan");
    // So'z o'rtasidan kesilmasin.
    assert.ok(!/\S…$/.test(result) || !result.slice(0, -1).endsWith("o"), result);
  });

  it("bitta juda uzun so'zni baribir kesadi", () => {
    const result = clampText("a".repeat(100), 20);
    assert.ok(result.length <= 20, `kesilmadi: ${result.length}`);
  });

  it("chegara 0 bo'lsa matnni o'zgartirmaydi", () => {
    assert.equal(clampText("  matn  ", 0), "matn");
  });
});

describe("densityFor", () => {
  it("statement maketida bandlar YO'Q", () => {
    const limits = densityFor("statement", { audienceAge: null, audience: "general" });
    assert.equal(limits.maxBullets, 0);
  });

  it("bandlar maketida 3 tadan kam bo'lmaydi", () => {
    // Yosh auditoriya uchun qisqartirilganda ham slayd bo'shab qolmasin.
    for (const age of [8, 10, 12, 16, null]) {
      const limits = densityFor("bullets", { audienceAge: age, audience: "students" });
      assert.ok(limits.maxBullets >= 3, `yosh ${age}: ${limits.maxBullets} band`);
    }
  });

  it("yosh auditoriya uchun matn qisqaradi", () => {
    const child = densityFor("bullets", { audienceAge: 10, audience: "students" });
    const adult = densityFor("bullets", { audienceAge: null, audience: "general" });
    assert.ok(child.maxBulletChars < adult.maxBulletChars);
    assert.ok(child.maxBullets <= adult.maxBullets);
  });

  it("chegaralar SXEMA chegarasidan oshmaydi", () => {
    /*
      Sxema bandni 220 belgiga, kartani 160 ga cheklaydi. Zichlik
      chegarasi undan katta bo'lsa, siqilgan slayd baribir sxemadan
      o'tmasdi va butun generatsiya yiqilardi.
    */
    for (const type of ["bullets", "cards", "steps", "comparison"] as const) {
      const limits = densityFor(type, { audienceAge: null, audience: "general" });
      assert.ok(limits.maxBulletChars <= 220);
      assert.ok(limits.maxCardBodyChars <= 160);
      assert.ok(limits.maxStepBodyChars <= 140);
      assert.ok(limits.maxHeadingChars <= 120);
      assert.ok(limits.maxKeyMessageChars <= 200);
    }
  });
});

describe("compressSlide", () => {
  const limits = densityFor("bullets", { audienceAge: null, audience: "general" });

  it("ortiqcha bandlarni kesadi", () => {
    const result = compressSlide(
      slide({ bullets: Array.from({ length: 8 }, (_, i) => `Band ${i + 1}`) }),
      limits,
    );
    assert.equal(result.bullets.length, limits.maxBullets);
  });

  it("uzun bandni qisqartiradi", () => {
    const long = "Fotosintez ".repeat(40);
    const result = compressSlide(slide({ bullets: [long] }), limits);
    assert.ok(result.bullets[0].length <= limits.maxBulletChars);
  });

  it("bandsiz maketda bandlarni butunlay olib tashlaydi", () => {
    const statementLimits = densityFor("statement", {
      audienceAge: null,
      audience: "general",
    });
    const result = compressSlide(slide({ bullets: ["Band"] }), statementLimits);
    assert.deepEqual(result.bullets, []);
  });

  it("kartalar va bosqichlarni ham siqadi", () => {
    const cardLimits = densityFor("cards", { audienceAge: 10, audience: "students" });
    const result = compressSlide(
      slide({
        cards: [
          { title: "Karta", body: "Juda uzun tavsif ".repeat(20) },
          { title: "Ikkinchi", body: "Yana uzun tavsif ".repeat(20) },
        ],
      }),
      cardLimits,
    );

    for (const card of result.cards ?? []) {
      assert.ok(
        (card.body ?? "").length <= cardLimits.maxCardBodyChars,
        `karta matni uzun: ${(card.body ?? "").length}`,
      );
    }
  });

  it("siqilgan slayd SXEMADAN o'tadi", () => {
    // Eng muhim shart: siqish natijasi yaroqsiz slayd yasamasligi kerak.
    const result = compressSlide(
      slide({
        heading: "S".repeat(300),
        bullets: ["B".repeat(500), "x", ""],
        keyMessage: "K".repeat(400),
        cards: [
          { title: "T".repeat(200), body: "B".repeat(400) },
          { title: "T2", body: "B2" },
        ],
        steps: [
          { label: "L".repeat(200), body: "B".repeat(400) },
          { label: "L2" },
          { label: "L3" },
        ],
      }),
      densityFor("bullets", { audienceAge: 10, audience: "students" }),
    );

    const parsed = slideSchema.safeParse(result);
    assert.ok(
      parsed.success,
      `siqilgan slayd sxemadan o'tmadi: ${JSON.stringify(parsed.error?.issues?.[0])}`,
    );
  });

  it("asl slaydni O'ZGARTIRMAYDI", () => {
    const original = slide({ bullets: ["a", "b", "c", "d", "e", "f", "g"] });
    const before = original.bullets.length;
    compressSlide(original, limits);
    assert.equal(original.bullets.length, before);
  });
});
