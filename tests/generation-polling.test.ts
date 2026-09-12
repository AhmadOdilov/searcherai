import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer, type Server } from "node:http";

/**
 * Fon generatsiyasini kuzatish sinovlari.
 *
 * ── Nima tekshiriladi ─────────────────────────────────────────────────────
 * Asosiy xavf — CHEKSIZ AYLANISH: hook to'xtash shartlarini noto'g'ri
 * qo'llasa, u yopilgan sahifada ham so'rov yuboraverardi va serverni
 * keraksiz yuklardi. Shuning uchun har bir to'xtash sharti alohida
 * tekshiriladi.
 *
 * Hook React'ga bog'liq, shuning uchun uning MANTIG'I bu yerda soxta
 * server bilan qayta tiklanadi: bir xil to'xtash shartlari, bir xil
 * hisoblagichlar. Bu React muhitini ko'tarmasdan mantiqni qoplaydi.
 */

interface Scenario {
  /** Har so'rovda ketma-ket qaytariladigan holatlar. */
  statuses: Array<"PENDING" | "READY" | "FAILED">;
  /** Shu indeksdagi so'rovlar xato qaytaradi. */
  errorAt?: Set<number>;
}

let server: Server;
let baseUrl = "";
let scenario: Scenario = { statuses: ["READY"] };
let requestCount = 0;

before(async () => {
  server = createServer((req, res) => {
    const index = requestCount++;

    if (scenario.errorAt?.has(index)) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: { code: "server" } }));
      return;
    }

    const status = scenario.statuses[Math.min(index, scenario.statuses.length - 1)];

    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        data: {
          record: { id: "x", status, errorMessage: status === "FAILED" ? "e" : null },
        },
      }),
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("port yo'q");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

/**
 * Hook'ning to'xtash mantig'i.
 *
 * Bu `lib/hooks/use-generation-polling.ts` dagi shartlarning aynan
 * nusxasi — React'siz ishlaydigan shaklda.
 */
async function poll(options: {
  intervalMs: number;
  timeoutMs: number;
  maxErrors: number;
}): Promise<{
  finalStatus: string;
  requests: number;
  stopReason: "completed" | "timeout" | "errors";
}> {
  const startedAt = Date.now();
  let errorCount = 0;
  let requests = 0;

  for (;;) {
    if (Date.now() - startedAt > options.timeoutMs) {
      return { finalStatus: "FAILED", requests, stopReason: "timeout" };
    }

    requests++;
    try {
      const response = await fetch(`${baseUrl}/record`);
      const body = (await response.json()) as {
        ok: boolean;
        data?: { record: { status: string } };
      };
      if (!body.ok) throw new Error("xato javob");

      errorCount = 0;
      const status = body.data!.record.status;
      if (status === "READY" || status === "FAILED") {
        return { finalStatus: status, requests, stopReason: "completed" };
      }
    } catch {
      errorCount++;
      if (errorCount >= options.maxErrors) {
        return { finalStatus: "FAILED", requests, stopReason: "errors" };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }
}

const FAST = { intervalMs: 10, timeoutMs: 2000, maxErrors: 3 };

describe("polling — to'xtash shartlari", () => {
  it("READY bo'lgach DARHOL to'xtaydi", async () => {
    requestCount = 0;
    scenario = { statuses: ["READY"] };

    const result = await poll(FAST);

    assert.equal(result.finalStatus, "READY");
    assert.equal(result.stopReason, "completed");
    assert.equal(result.requests, 1, "bitta so'rov yetarli bo'lishi kerak");
  });

  it("FAILED bo'lgach ham to'xtaydi", async () => {
    requestCount = 0;
    scenario = { statuses: ["FAILED"] };

    const result = await poll(FAST);

    assert.equal(result.finalStatus, "FAILED");
    assert.equal(result.stopReason, "completed");
    assert.equal(result.requests, 1);
  });

  it("PENDING → READY o'tishini kutadi", async () => {
    requestCount = 0;
    scenario = { statuses: ["PENDING", "PENDING", "PENDING", "READY"] };

    const result = await poll(FAST);

    assert.equal(result.finalStatus, "READY");
    assert.equal(result.stopReason, "completed");
    assert.equal(result.requests, 4, "to'rtinchi so'rovda tayyor bo'ladi");
  });

  it("PENDING → FAILED o'tishini ham kutadi", async () => {
    requestCount = 0;
    scenario = { statuses: ["PENDING", "PENDING", "FAILED"] };

    const result = await poll(FAST);

    assert.equal(result.finalStatus, "FAILED");
    assert.equal(result.requests, 3);
  });

  it("MANGU PENDING bo'lsa timeout bilan to'xtaydi — CHEKSIZ AYLANMAYDI", async () => {
    // Eng muhim sinov: server yozuvni hech qachon tugatmasa ham hook
    // to'xtashi kerak.
    requestCount = 0;
    scenario = { statuses: ["PENDING"] };

    const result = await poll({ intervalMs: 10, timeoutMs: 200, maxErrors: 3 });

    assert.equal(result.stopReason, "timeout");
    assert.equal(result.finalStatus, "FAILED");
    // Taxminan 200/10 = 20 ta so'rov; keng chegara bilan tekshiramiz.
    assert.ok(
      result.requests > 5 && result.requests < 60,
      `so'rovlar soni mantiqiy bo'lishi kerak (${result.requests})`,
    );
  });

  it("ketma-ket xatolardan keyin to'xtaydi", async () => {
    requestCount = 0;
    scenario = { statuses: ["PENDING"], errorAt: new Set([0, 1, 2, 3, 4]) };

    const result = await poll(FAST);

    assert.equal(result.stopReason, "errors");
    assert.equal(result.requests, 3, "maxErrors (3) da to'xtashi kerak");
  });

  it("BITTA xatolik kuzatuvni to'xtatmaydi", async () => {
    // Vaqtinchalik tarmoq uzilishi butun jarayonni bekor qilmasligi kerak.
    requestCount = 0;
    scenario = { statuses: ["PENDING", "PENDING", "READY"], errorAt: new Set([0]) };

    const result = await poll(FAST);

    assert.equal(result.finalStatus, "READY");
    assert.equal(result.stopReason, "completed");
    assert.ok(result.requests >= 3, "xatodan keyin davom etishi kerak");
  });

  it("xatolar ketma-ket BO'LMASA hisoblagich tiklanadi", async () => {
    requestCount = 0;
    // 0 xato, 1 ok, 2 xato, 3 ok, 4 xato, 5 READY — hech qachon 3 ta
    // ketma-ket xato bo'lmaydi.
    scenario = {
      statuses: ["PENDING", "PENDING", "PENDING", "PENDING", "PENDING", "READY"],
      errorAt: new Set([0, 2, 4]),
    };

    const result = await poll(FAST);

    assert.equal(result.finalStatus, "READY", "to'xtab qolmasligi kerak");
    assert.equal(result.stopReason, "completed");
  });
});

describe("polling — sozlamalar mosligi", () => {
  it("hook timeout'i serverdagi STALE_AFTER_MS dan UZUN", async () => {
    // Server 5 daqiqadan uzoq PENDING turgan yozuvni FAILED qiladi.
    // Hook shundan oldin to'xtasa, foydalanuvchi sababni ko'rmay qolardi.
    const { STALE_AFTER_MS, POLL_TIMEOUT_MS } =
      await import("../lib/generation/constants");

    assert.ok(
      POLL_TIMEOUT_MS > STALE_AFTER_MS,
      `hook timeout (${POLL_TIMEOUT_MS}) server chegarasidan (${STALE_AFTER_MS}) uzun bo'lishi kerak`,
    );
  });

  it("osilib qolgan yozuv chegarasi eng uzun generatsiyadan katta", async () => {
    const { STALE_AFTER_MS } = await import("../lib/generation/constants");
    const { TYPICAL_SECONDS } = await import("../lib/calendar-plans/labels");

    // Eng sekin modul + qayta urinish (×2) + zaxira.
    const worstCaseMs = TYPICAL_SECONDS * 2 * 1000;

    assert.ok(
      STALE_AFTER_MS > worstCaseMs,
      `chegara (${STALE_AFTER_MS}ms) eng yomon holatdan (${worstCaseMs}ms) katta bo'lishi kerak`,
    );
  });
});
