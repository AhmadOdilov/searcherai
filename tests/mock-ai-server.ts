import { createServer, type Server } from "node:http";

/**
 * Sinovlar uchun soxta AI serveri.
 *
 * Haqiqiy API kaliti bo'lmasa ham transport mantig'ini (so'rov shakli,
 * javob tahlili, xatolik tarjimasi, qayta urinish) tekshirish imkonini beradi.
 */

/**
 * Javob tanasini beruvchi funksiya — har urinishda boshqa javob qaytarish
 * uchun (qayta urinish sinovlarida).
 */
export type MockBodyFactory = (requestBody: unknown, attempt: number) => unknown;

export interface MockScenario {
  /** HTTP status. Massiv berilsa — har urinishda keyingisi qaytariladi. */
  status: number | number[];
  /**
   * Qaytariladigan tana. Funksiya berilsa so'rov tanasi uzatiladi.
   * DIQQAT: `unknown` yozib bo'lmaydi — u union'ni yutib yuboradi va
   * funksiya argumentlari `any` bo'lib qoladi.
   */
  body: MockBodyFactory | object | string;
  /** Javobni ushlab turish (timeout sinovi uchun), millisekund. */
  delayMs?: number;
  headers?: Record<string, string>;
}

export interface MockServer {
  baseUrl: string;
  /** Qabul qilingan so'rovlar — shaklini tekshirish uchun. */
  requests: Array<{ path: string; headers: Record<string, string>; body: unknown }>;
  close(): Promise<void>;
}

export async function startMockServer(scenario: MockScenario): Promise<MockServer> {
  const requests: MockServer["requests"] = [];
  let attempt = 0;

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      let parsed: unknown = rawBody;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        // xom matn qoladi
      }

      requests.push({
        path: req.url ?? "",
        headers: req.headers as Record<string, string>,
        body: parsed,
      });

      const currentAttempt = attempt++;
      const status = Array.isArray(scenario.status)
        ? (scenario.status[currentAttempt] ?? scenario.status.at(-1)!)
        : scenario.status;
      const body =
        typeof scenario.body === "function"
          ? (scenario.body as (b: unknown, a: number) => unknown)(parsed, currentAttempt)
          : scenario.body;

      const send = () => {
        res.writeHead(status, {
          "content-type": "application/json",
          ...scenario.headers,
        });
        res.end(typeof body === "string" ? body : JSON.stringify(body));
      };

      if (scenario.delayMs) setTimeout(send, scenario.delayMs);
      else send();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("mock server manzilini olib bo'lmadi");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

/** OpenAI-mos muvaffaqiyatli javob. */
export function openAiResponse(content: string) {
  return {
    model: "mock-model",
    choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 11, completion_tokens: 22 },
  };
}

/** Anthropic Messages API muvaffaqiyatli javobi. */
export function anthropicResponse(text: string) {
  return {
    model: "mock-claude",
    content: [{ type: "text", text }],
    usage: { input_tokens: 33, output_tokens: 44 },
    stop_reason: "end_turn",
  };
}
