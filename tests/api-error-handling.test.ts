import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

/**
 * `withErrorHandling` sinovlari.
 *
 * Bu qatlam keyingi HAR BIR modul (dars ishlanmasi, prezentatsiya, Excel,
 * tarjima) tayanadigan joy. Asosiy talab: texnik tafsilotlar (API kaliti,
 * SQL, stack trace) foydalanuvchiga tushmasligi kerak.
 */

process.env.DATABASE_URL ??= "postgresql://u:p@localhost:5432/d";
process.env.AUTH_SECRET ??= "sinov-uchun-kalit-kamida-32-belgi-boisin!!";

function request(body?: unknown): Request {
  return new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("withErrorHandling", () => {
  it("muvaffaqiyatli javobni { ok: true } shaklida qaytaradi", async () => {
    const { withErrorHandling, ok } = await import("../lib/api/with-error-handling");

    const handler = withErrorHandling(async () => ok({ value: 42 }));
    const response = await handler(request(), {});

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, data: { value: 42 } });
  });

  it("ApiError ni to'g'ri status va xabar bilan qaytaradi", async () => {
    const { withErrorHandling } = await import("../lib/api/with-error-handling");
    const { apiErrors } = await import("../lib/api/errors");

    const handler = withErrorHandling(async () => {
      throw apiErrors.notFound("Dars ishlanmasi topilmadi.");
    });
    const response = await handler(request(), {});

    assert.equal(response.status, 404);
    const json = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    assert.equal(json.ok, false);
    assert.equal(json.error.code, "not_found");
    assert.equal(json.error.message, "Dars ishlanmasi topilmadi.");
  });

  it("AiError ni foydalanuvchiga tushunarli xabarga aylantiradi", async () => {
    const { withErrorHandling } = await import("../lib/api/with-error-handling");
    const { AiError } = await import("../lib/ai/types");

    const handler = withErrorHandling(async () => {
      throw new AiError({
        kind: "rate_limit",
        // Texnik tafsilot — javobga TUSHMASLIGI kerak
        detail: "openai 429: kalit sk-secret-123 uchun limit tugadi",
      });
    });
    const response = await handler(request(), {});

    assert.equal(response.status, 429);
    const text = await response.text();
    assert.ok(!text.includes("sk-secret-123"), "kalit javobga tushmasligi kerak");
    assert.ok(!text.includes("429:"), "texnik tafsilot javobga tushmasligi kerak");

    const json = JSON.parse(text) as { error: { code: string; message: string } };
    assert.equal(json.error.code, "ai_rate_limit");
    assert.ok(json.error.message.includes("qayta urinib"));
  });

  it("kutilmagan xatolikda 500 va umumiy xabar qaytaradi", async () => {
    const { withErrorHandling } = await import("../lib/api/with-error-handling");

    const handler = withErrorHandling(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432 (ichki tafsilot)");
    });
    const response = await handler(request(), {});

    assert.equal(response.status, 500);
    const text = await response.text();
    assert.ok(!text.includes("ECONNREFUSED"), "ichki tafsilot yashirilishi kerak");
    assert.ok(!text.includes("10.0.0.5"), "ichki manzil yashirilishi kerak");
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({
    subject: z.string().min(2),
    grade: z.string().min(1),
  });

  it("to'g'ri tanani tahlil qiladi", async () => {
    const { parseJsonBody } = await import("../lib/api/with-error-handling");

    const parsed = await parseJsonBody(
      request({ subject: "Matematika", grade: "7-sinf" }),
      schema,
    );
    assert.deepEqual(parsed, { subject: "Matematika", grade: "7-sinf" });
  });

  it("validatsiya xatosini maydonlar bo'yicha qaytaradi", async () => {
    const { withErrorHandling, parseJsonBody } =
      await import("../lib/api/with-error-handling");

    const handler = withErrorHandling(async (req) => {
      await parseJsonBody(req, schema);
      throw new Error("bu yerga yetib kelmasligi kerak");
    });
    const response = await handler(request({ subject: "M", grade: "" }), {});

    assert.equal(response.status, 400);
    const json = (await response.json()) as {
      error: { code: string; fieldErrors?: Record<string, string[]> };
    };
    assert.equal(json.error.code, "validation_error");
    assert.ok(json.error.fieldErrors?.subject, "subject xatosi bo'lishi kerak");
    assert.ok(json.error.fieldErrors?.grade, "grade xatosi bo'lishi kerak");
  });

  it("JSON bo'lmagan tanani rad etadi", async () => {
    const { withErrorHandling, parseJsonBody } =
      await import("../lib/api/with-error-handling");

    const handler = withErrorHandling(async (req) => {
      await parseJsonBody(req, schema);
      return new Response("ok");
    });
    const broken = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ buzuq json",
    });
    const response = await handler(broken, {});

    assert.equal(response.status, 400);
    const json = (await response.json()) as { error: { message: string } };
    assert.ok(json.error.message.includes("JSON"));
  });
});
