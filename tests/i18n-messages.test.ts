import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { UI_LOCALES } from "../lib/i18n/config";

/**
 * Tarjima fayllari sinovlari.
 *
 * ── Nega bu eng muhim sinov ───────────────────────────────────────────────
 * Tarjima jim buziladi: yangi kalit qo'shilib, ikkinchi tilga ko'chirish
 * unutiladi. Natijada rus tilidagi foydalanuvchi ekranda kalit nomini
 * (`lessonPlans.new.title`) ko'radi va buni faqat qo'lda sinab bilish
 * mumkin bo'lardi.
 *
 * Shuning uchun bu sinov ikki faylni AVTOMATIK solishtiradi.
 */

const MESSAGES_DIR = path.join(process.cwd(), "messages");

type Messages = Record<string, unknown>;

function loadMessages(locale: string): Messages {
  return JSON.parse(
    readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8"),
  ) as Messages;
}

/** Ichma-ich joylashgan obyektdan to'liq kalit yo'llarini yig'adi. */
function collectKeys(value: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>();
  if (typeof value !== "object" || value === null) return keys;

  for (const [key, child] of Object.entries(value as Messages)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "object" && child !== null) {
      for (const nested of collectKeys(child, full)) keys.add(nested);
    } else {
      keys.add(full);
    }
  }
  return keys;
}

/** Matndagi `{parametr}` o'rinbosarlarini topadi. */
function placeholders(text: string): Set<string> {
  return new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]));
}

/** Kalit bo'yicha qiymatni oladi. */
function valueAt(messages: Messages, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        typeof current === "object" && current !== null
          ? (current as Messages)[part]
          : undefined,
      messages,
    );
}

describe("tarjima fayllari", () => {
  it("har bir interfeys tili uchun fayl mavjud", () => {
    const files = readdirSync(MESSAGES_DIR).filter((name) => name.endsWith(".json"));

    for (const locale of UI_LOCALES) {
      assert.ok(files.includes(`${locale}.json`), `messages/${locale}.json topilmadi`);
    }
  });

  it("BARCHA tillarda kalitlar to'plami BIR XIL", () => {
    const [first, ...rest] = UI_LOCALES;
    const reference = collectKeys(loadMessages(first));

    for (const locale of rest) {
      const current = collectKeys(loadMessages(locale));

      const missing = [...reference].filter((key) => !current.has(key)).sort();
      const extra = [...current].filter((key) => !reference.has(key)).sort();

      assert.deepEqual(
        missing,
        [],
        `${locale}.json da yetishmayotgan kalitlar (${first}.json da bor):\n  ${missing.join("\n  ")}`,
      );
      assert.deepEqual(
        extra,
        [],
        `${locale}.json da ortiqcha kalitlar (${first}.json da yo'q):\n  ${extra.join("\n  ")}`,
      );
    }
  });

  it("hech bir tarjima BO'SH emas", () => {
    for (const locale of UI_LOCALES) {
      const messages = loadMessages(locale);
      for (const key of collectKeys(messages)) {
        const value = valueAt(messages, key);
        assert.equal(
          typeof value,
          "string",
          `${locale}.json → ${key} satr bo'lishi kerak`,
        );
        assert.ok((value as string).trim().length > 0, `${locale}.json → ${key} bo'sh`);
      }
    }
  });

  it("TODO yoki tarjima qilinmagan belgi qolmagan", () => {
    for (const locale of UI_LOCALES) {
      const raw = readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8");
      assert.ok(!/TODO|FIXME|XXX/i.test(raw), `${locale}.json da TODO bor`);
    }
  });

  it("bir xil kalitda O'RINBOSARLAR ham bir xil", () => {
    // `{count}` bir tilda bo'lib, ikkinchisida bo'lmasa — o'sha tilda
    // son ko'rsatilmaydi va buni faqat ko'z bilan sezish mumkin.
    const [first, ...rest] = UI_LOCALES;
    const reference = loadMessages(first);

    for (const locale of rest) {
      const current = loadMessages(locale);

      for (const key of collectKeys(reference)) {
        const expected = placeholders(String(valueAt(reference, key)));
        const actual = placeholders(String(valueAt(current, key)));

        assert.deepEqual(
          [...actual].sort(),
          [...expected].sort(),
          `${key}: ${first} da {${[...expected].join(", ")}}, ` +
            `${locale} da {${[...actual].join(", ")}}`,
        );
      }
    }
  });

  it("xato kalitlari barcha tillarda mavjud", () => {
    // Kod ishlatadigan kalitlarni ALOHIDA tekshiramiz: ular yo'q bo'lsa
    // foydalanuvchi xato o'rniga kalit matnini ko'radi.
    const required = [
      "errors.api.validation_error",
      "errors.api.unauthorized",
      "errors.api.forbidden",
      "errors.api.not_found",
      "errors.api.conflict",
      "errors.api.internal_error",
      "errors.api.not_configured",
      "errors.api.invalidJsonBody",
      "errors.ai.not_configured",
      "errors.ai.timeout",
      "errors.ai.rate_limit",
      "errors.ai.unknown",
      "errors.domain.lessonPlanNotFound",
      "errors.domain.presentationNotFound",
      "errors.domain.calendarPlanNotFound",
      "errors.domain.emailTaken",
      "errors.domain.invalidCredentials",
    ];

    for (const locale of UI_LOCALES) {
      const messages = loadMessages(locale);
      for (const key of required) {
        assert.equal(
          typeof valueAt(messages, key),
          "string",
          `${locale}.json → ${key} yo'q`,
        );
      }
    }
  });
});

describe("kodda ishlatilgan kalitlar tarjimada bor", () => {
  it("zod sxemalaridagi BARCHA kalitlar mavjud", async () => {
    // Kirish sxemalari xato xabari sifatida kalit qaytaradi. Kalit
    // tarjimada bo'lmasa, formada foydalanuvchi kalit nomini ko'radi.
    const sources = [
      "lib/validations/common.ts",
      "lib/validations/auth.ts",
      "lib/validations/calendar-plan.ts",
    ];

    const used = new Set<string>();
    for (const file of sources) {
      const raw = readFileSync(path.join(process.cwd(), file), "utf8");
      for (const match of raw.matchAll(/"(errors\.validation\.\w+)"/g)) {
        used.add(match[1]);
      }
    }

    assert.ok(used.size > 20, `kam kalit topildi: ${used.size}`);

    for (const locale of UI_LOCALES) {
      const messages = loadMessages(locale);
      for (const key of used) {
        assert.equal(
          typeof valueAt(messages, key),
          "string",
          `${locale}.json → ${key} yo'q (kodda ishlatilgan)`,
        );
      }
    }
  });

  it("servis va route'lardagi domen kalitlari mavjud", () => {
    const files = [
      "lib/auth/session.ts",
      "lib/lesson-plans/service.ts",
      "lib/presentations/service.ts",
      "lib/calendar-plans/service.ts",
      "app/api/auth/login/route.ts",
      "app/api/auth/register/route.ts",
    ];

    const used = new Set<string>();
    for (const file of files) {
      const raw = readFileSync(path.join(process.cwd(), file), "utf8");
      for (const match of raw.matchAll(/"(errors\.(?:domain|ai)\.\w+)"/g)) {
        used.add(match[1]);
      }
    }

    assert.ok(used.size > 0, "hech qanday kalit topilmadi");

    for (const locale of UI_LOCALES) {
      const messages = loadMessages(locale);
      for (const key of used) {
        assert.equal(
          typeof valueAt(messages, key),
          "string",
          `${locale}.json → ${key} yo'q (kodda ishlatilgan)`,
        );
      }
    }
  });
});
