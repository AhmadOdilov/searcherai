import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { z } from "zod";
import {
  anthropicResponse,
  openAiResponse,
  startMockServer,
  type MockScenario,
} from "./mock-ai-server";

/**
 * AI qatlami sinovlari.
 *
 * Haqiqiy API kaliti KERAK EMAS — mahalliy soxta server bilan ishlaydi,
 * lekin haqiqiy HTTP yo'lidan o'tadi: so'rov shakli, javob tahlili,
 * xatolik tarjimasi va qayta urinish hammasi tekshiriladi.
 */

// `lib/env.ts` sozlamani dangasa o'qiydi, shuning uchun har sinovda
// process.env ni o'zgartirish yetarli — qayta import kerak emas.
function configure(overrides: Record<string, string>): void {
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/d";
  // `lib/env.ts` BARCHA o'zgaruvchini birga tekshiradi — AUTH_SECRET
  // bo'lmasa AI sinovlari ham yiqiladi.
  process.env.AUTH_SECRET = "sinov-uchun-kalit-kamida-32-belgi-boisin!!";
  process.env.AI_API_KEY = "test-key";
  process.env.AI_PROVIDER = "openai";
  process.env.AI_MODEL = "mock-model";
  process.env.AI_TIMEOUT_MS = "3000";
  process.env.AI_MAX_RETRIES = "0";
  process.env.AI_MAX_TOKENS = "500";
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

/** Mock serverni ko'tarib, uni AI_BASE_URL qilib beradi. */
async function withMock<T>(
  scenario: MockScenario,
  overrides: Record<string, string>,
  run: (mock: Awaited<ReturnType<typeof startMockServer>>) => Promise<T>,
): Promise<T> {
  const mock = await startMockServer(scenario);
  configure({ ...overrides, AI_BASE_URL: mock.baseUrl });
  try {
    return await run(mock);
  } finally {
    await mock.close();
  }
}

describe("AI qatlami — openai-mos transport", () => {
  beforeEach(() => configure({}));

  it("matn generatsiya qiladi va so'rovni to'g'ri shaklda yuboradi", async () => {
    const { generateText } = await import("../lib/ai/provider");

    await withMock(
      { status: 200, body: openAiResponse("Salom, men yordamchiman.") },
      {},
      async (mock) => {
        const result = await generateText({
          prompt: "Salom de",
          systemPrompt: "Qisqa javob ber",
          maxTokens: 120,
        });

        assert.equal(result.text, "Salom, men yordamchiman.");
        assert.equal(result.provider, "openai");
        assert.equal(result.model, "mock-model");
        assert.equal(result.usage.inputTokens, 11);
        assert.equal(result.usage.outputTokens, 22);
        assert.equal(result.finishReason, "stop");
        assert.equal(result.attempts, 0);
        assert.ok(result.durationMs >= 0);

        // So'rov shakli
        const sent = mock.requests[0];
        assert.equal(sent.path, "/chat/completions");
        assert.equal(sent.headers.authorization, "Bearer test-key");
        const body = sent.body as Record<string, unknown>;
        assert.equal(body.model, "mock-model");
        assert.equal(body.max_tokens, 120);
        const messages = body.messages as Array<{ role: string; content: string }>;
        assert.equal(messages[0].role, "system");
        assert.equal(messages[0].content, "Qisqa javob ber");
        assert.equal(messages[1].role, "user");
        assert.equal(messages[1].content, "Salom de");
        // temperature ataylab berilmagan — yuborilmasligi kerak
        assert.equal("temperature" in body, false);
      },
    );
  });

  it("max_completion_tokens talab qilinsa avtomatik qayta yuboradi", async () => {
    const { generateText } = await import("../lib/ai/provider");

    await withMock(
      {
        status: [400, 200],
        body: (_body, attempt) =>
          attempt === 0
            ? {
                error: {
                  message:
                    "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
                },
              }
            : openAiResponse("ikkinchi urinishda ishladi"),
      },
      {},
      async (mock) => {
        const result = await generateText({ prompt: "test" });
        assert.equal(result.text, "ikkinchi urinishda ishladi");

        assert.equal(mock.requests.length, 2);
        const first = mock.requests[0].body as Record<string, unknown>;
        const second = mock.requests[1].body as Record<string, unknown>;
        assert.ok("max_tokens" in first);
        assert.ok("max_completion_tokens" in second);
      },
    );
  });
});

describe("AI qatlami — anthropic transport", () => {
  it("Messages API shaklida yuboradi va temperature YUBORMAYDI", async () => {
    const { generateText } = await import("../lib/ai/provider");

    await withMock(
      { status: 200, body: anthropicResponse("Assalomu alaykum") },
      { AI_PROVIDER: "anthropic", AI_MODEL: "claude-opus-5" },
      async (mock) => {
        const result = await generateText({
          prompt: "Salom",
          systemPrompt: "O'zbek tilida javob ber",
          // Ataylab beramiz — transport uni TASHLAB KETISHI kerak, chunki
          // zamonaviy Claude modellari 400 xato qaytaradi.
          temperature: 0.7,
        });

        assert.equal(result.text, "Assalomu alaykum");
        assert.equal(result.provider, "anthropic");
        assert.equal(result.usage.inputTokens, 33);
        assert.equal(result.usage.outputTokens, 44);

        const sent = mock.requests[0];
        assert.equal(sent.path, "/v1/messages");
        assert.equal(sent.headers["x-api-key"], "test-key");
        assert.equal(sent.headers["anthropic-version"], "2023-06-01");
        const body = sent.body as Record<string, unknown>;
        assert.equal(body.model, "claude-opus-5");
        assert.equal(body.system, "O'zbek tilida javob ber");
        assert.ok(typeof body.max_tokens === "number");
        assert.equal(
          "temperature" in body,
          false,
          "temperature Anthropic'ga yuborilmasligi kerak",
        );
      },
    );
  });

  it("stop_reason=refusal ni xatolik deb qabul qiladi", async () => {
    const { generateText } = await import("../lib/ai/provider");
    const { AiError } = await import("../lib/ai/types");

    await withMock(
      {
        status: 200,
        body: {
          model: "claude-opus-5",
          content: [],
          stop_reason: "refusal",
          stop_details: { type: "refusal", category: "cyber" },
          usage: { input_tokens: 5, output_tokens: 0 },
        },
      },
      { AI_PROVIDER: "anthropic" },
      async () => {
        await assert.rejects(
          () => generateText({ prompt: "test" }),
          (error: unknown) => {
            assert.ok(error instanceof AiError);
            assert.equal(error.kind, "bad_request");
            return true;
          },
        );
      },
    );
  });
});

describe("AI qatlami — xatoliklar", () => {
  it("kalit sozlanmagan bo'lsa not_configured qaytaradi", async () => {
    const { generateText } = await import("../lib/ai/provider");
    const { AiError } = await import("../lib/ai/types");

    configure({ AI_API_KEY: "" });
    await assert.rejects(
      () => generateText({ prompt: "test" }),
      (error: unknown) => {
        assert.ok(error instanceof AiError);
        assert.equal(error.kind, "not_configured");
        assert.equal(error.httpStatus, 503);
        // Foydalanuvchiga texnik tafsilot ketmasligi kerak
        assert.ok(!error.userMessage.includes("AI_API_KEY"));
        return true;
      },
    );
  });

  it("401 → auth xatosi, qayta urinilmaydi", async () => {
    const { generateText } = await import("../lib/ai/provider");
    const { AiError } = await import("../lib/ai/types");

    await withMock(
      { status: 401, body: { error: { message: "Incorrect API key provided" } } },
      { AI_MAX_RETRIES: "2" },
      async (mock) => {
        await assert.rejects(
          () => generateText({ prompt: "test" }),
          (error: unknown) => {
            assert.ok(error instanceof AiError);
            assert.equal(error.kind, "auth");
            assert.equal(error.retryable, false);
            return true;
          },
        );
        // auth xatosi qaytarilmasligi kerak — bitta so'rov
        assert.equal(mock.requests.length, 1);
      },
    );
  });

  it("429 → rate_limit, qayta urinadi va muvaffaqiyat bilan tugaydi", async () => {
    const { generateText } = await import("../lib/ai/provider");

    await withMock(
      {
        status: [429, 200],
        body: (_b, attempt) =>
          attempt === 0
            ? { error: { message: "Rate limit reached" } }
            : openAiResponse("uchinchi urinishda"),
        headers: { "retry-after": "0" },
      },
      { AI_MAX_RETRIES: "2" },
      async (mock) => {
        const result = await generateText({ prompt: "test" });
        assert.equal(result.text, "uchinchi urinishda");
        assert.equal(result.attempts, 1, "bitta qayta urinish bo'lishi kerak");
        assert.equal(mock.requests.length, 2);
      },
    );
  });

  it("500 → server xatosi, urinishlar tugagach uzatiladi", async () => {
    const { generateText } = await import("../lib/ai/provider");
    const { AiError } = await import("../lib/ai/types");

    await withMock(
      { status: 500, body: { error: { message: "internal" } } },
      { AI_MAX_RETRIES: "1" },
      async (mock) => {
        await assert.rejects(
          () => generateText({ prompt: "test" }),
          (error: unknown) => {
            assert.ok(error instanceof AiError);
            assert.equal(error.kind, "server");
            assert.equal(error.retryable, true);
            return true;
          },
        );
        // 1 urinish + 1 qayta urinish
        assert.equal(mock.requests.length, 2);
      },
    );
  });

  it("javob kechiksa timeout qaytaradi", async () => {
    const { generateText } = await import("../lib/ai/provider");
    const { AiError } = await import("../lib/ai/types");

    await withMock(
      { status: 200, body: openAiResponse("kech keldi"), delayMs: 1000 },
      { AI_TIMEOUT_MS: "150", AI_MAX_RETRIES: "0" },
      async () => {
        await assert.rejects(
          () => generateText({ prompt: "test" }),
          (error: unknown) => {
            assert.ok(error instanceof AiError);
            assert.equal(error.kind, "timeout");
            assert.equal(error.httpStatus, 504);
            return true;
          },
        );
      },
    );
  });

  it("balans tugagani 400 ichida kelsa quota deb tanilanadi", async () => {
    const { generateText } = await import("../lib/ai/provider");
    const { AiError } = await import("../lib/ai/types");

    await withMock(
      {
        status: 400,
        body: { error: { message: "You exceeded your current quota" } },
      },
      {},
      async () => {
        await assert.rejects(
          () => generateText({ prompt: "test" }),
          (error: unknown) => {
            assert.ok(error instanceof AiError);
            assert.equal(error.kind, "quota");
            return true;
          },
        );
      },
    );
  });

  it("bo'sh javob → bad_response", async () => {
    const { generateText } = await import("../lib/ai/provider");
    const { AiError } = await import("../lib/ai/types");

    await withMock(
      {
        status: 200,
        body: { choices: [{ message: { content: "" }, finish_reason: "length" }] },
      },
      {},
      async () => {
        await assert.rejects(
          () => generateText({ prompt: "test" }),
          (error: unknown) => {
            assert.ok(error instanceof AiError);
            assert.equal(error.kind, "bad_response");
            return true;
          },
        );
      },
    );
  });
});

describe("AI qatlami — generateJson", () => {
  const schema = z.object({
    title: z.string().min(1),
    steps: z.array(z.string()).min(2),
  });

  it("```json ramkasidagi javobni tozalab tahlil qiladi", async () => {
    const { generateJson } = await import("../lib/ai/provider");

    const payload = { title: "Dars", steps: ["kirish", "asosiy qism"] };
    await withMock(
      {
        status: 200,
        body: openAiResponse(
          "Mana natija:\n```json\n" + JSON.stringify(payload) + "\n```",
        ),
      },
      {},
      async (mock) => {
        const { data } = await generateJson({ schema, prompt: "reja tuz" });
        assert.deepEqual(data, payload);

        // jsonMode native rejimini ham yoqishi kerak
        const body = mock.requests[0].body as Record<string, unknown>;
        assert.deepEqual(body.response_format, { type: "json_object" });
        // va system promptga JSON ko'rsatmasi qo'shilishi kerak
        const messages = body.messages as Array<{ role: string; content: string }>;
        assert.ok(messages[0].content.includes("JSON"));
      },
    );
  });

  it("sxemadan o'tmasa bir marta qayta urinadi", async () => {
    const { generateJson } = await import("../lib/ai/provider");

    await withMock(
      {
        status: 200,
        body: (_b, attempt) =>
          attempt === 0
            ? // `steps` yetarli emas — sxema rad etadi
              openAiResponse(JSON.stringify({ title: "Dars", steps: ["bitta"] }))
            : openAiResponse(JSON.stringify({ title: "Dars", steps: ["a", "b"] })),
      },
      {},
      async (mock) => {
        const { data } = await generateJson({ schema, prompt: "reja tuz" });
        assert.deepEqual(data.steps, ["a", "b"]);
        assert.equal(mock.requests.length, 2);

        // Ikkinchi so'rovda modelga xato sababi aytilishi kerak
        const secondBody = mock.requests[1].body as Record<string, unknown>;
        const messages = secondBody.messages as Array<{ content: string }>;
        assert.ok(messages.at(-1)!.content.includes("OLDINGI JAVOB XATO"));
      },
    );
  });

  it("ikki urinishdan keyin ham o'tmasa bad_response qaytaradi", async () => {
    const { generateJson } = await import("../lib/ai/provider");
    const { AiError } = await import("../lib/ai/types");

    await withMock(
      { status: 200, body: openAiResponse("bu umuman JSON emas") },
      {},
      async (mock) => {
        await assert.rejects(
          () => generateJson({ schema, prompt: "reja tuz" }),
          (error: unknown) => {
            assert.ok(error instanceof AiError);
            assert.equal(error.kind, "bad_response");
            return true;
          },
        );
        assert.equal(mock.requests.length, 2);
      },
    );
  });
});
