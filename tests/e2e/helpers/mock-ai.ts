import { createServer, type Server } from "node:http";

/**
 * E2E sinovlari uchun soxta AI serveri (OpenAI-mos).
 *
 * Nega kerak: haqiqiy AI'ga murojaat qilsak sinovlar pul sarflaydi, sekin
 * ishlaydi va natijasi har safar boshqacha bo'ladi. Soxta server esa
 * bir xil, tez va bepul javob beradi — lekin ilova haqiqiy HTTP yo'lidan
 * o'tadi, ya'ni transport, JSON ajratish va zod tekshiruvi ham sinaladi.
 *
 * ── Sinov "belgilari" (markers) ──────────────────────────────────────────
 * Soxta serverga tashqaridan buyruq berish qiyin (u alohida jarayonda
 * ishlaydigan ilova tomonidan chaqiriladi). Shuning uchun buyruq PROMPT
 * ICHIDA uzatiladi: sinov mavzu (topic) sifatida maxsus so'z yozadi.
 */

/** Mavzuda shu so'z bo'lsa — server xatosi (FAILED holatini sinash uchun). */
export const MARKER_SERVER_ERROR = "XATO-SERVER";

/** Mavzuda shu so'z bo'lsa — sxemaga mos kelmaydigan javob. */
export const MARKER_BAD_SHAPE = "XATO-FORMAT";

export interface MockAiServer {
  baseUrl: string;
  requestCount: number;
  /** Oxirgi so'rovdagi promptlar — tilni tekshirish uchun. */
  lastPrompts: { system: string; user: string } | null;
  close(): Promise<void>;
}

/**
 * Promptdan dars davomiyligini ajratib oladi.
 *
 * Bosqichlar yig'indisi shunga teng bo'lishi kerak, aks holda
 * `lessonPlanContentSchemaFor` javobni rad etadi.
 */
function extractDuration(prompt: string): number {
  const match = prompt.match(/(\d+)\s*(?:daqiqa|минут|minutes)/i);
  return match ? Number(match[1]) : 45;
}

/** Berilgan umumiy vaqtni 4 bosqichga taqsimlaydi (yig'indi aniq mos keladi). */
function buildStages(total: number) {
  const intro = Math.max(1, Math.round(total * 0.15));
  const main = Math.max(1, Math.round(total * 0.45));
  const practice = Math.max(1, Math.round(total * 0.25));
  // Qolgani — yig'indi ANIQ mos kelishi uchun ayirib olamiz.
  const homework = Math.max(1, total - intro - main - practice);

  return [
    {
      name: "Kirish",
      durationMinutes: intro,
      description: "Oldingi mavzu takrorlanadi va yangi mavzuga o'tiladi.",
      teacherActivity: "Savollar beradi, mavzuni e'lon qiladi.",
      studentActivity: "Savollarga javob beradilar, daftar ochadilar.",
    },
    {
      name: "Asosiy qism",
      durationMinutes: main,
      description: "Yangi material misollar bilan tushuntiriladi.",
      teacherActivity: "Doskada tushuntiradi, misollar keltiradi.",
      studentActivity: "Tinglaydilar, daftarga yozadilar, savol beradilar.",
    },
    {
      name: "Mustahkamlash",
      durationMinutes: practice,
      description: "O'quvchilar mustaqil mashqlar bajaradilar.",
      teacherActivity: "Kuzatadi, individual yordam beradi.",
      studentActivity: "Mashqlarni yechadilar, javoblarni tekshiradilar.",
    },
    {
      name: "Uyga vazifa",
      durationMinutes: homework,
      description: "Uyga vazifa beriladi va tushuntiriladi.",
      teacherActivity: "Vazifani e'lon qiladi, talablarni aytadi.",
      studentActivity: "Yozib oladilar, aniqlashtiruvchi savol beradilar.",
    },
  ];
}

function buildLessonPlan(total: number) {
  return {
    objective:
      "O'quvchilar mavzu bo'yicha asosiy tushunchalarni o'zlashtiradi va amaliy masalalarni mustaqil yecha oladi.",
    outcomes: [
      "O'quvchi asosiy tushunchani o'z so'zlari bilan izohlab beradi.",
      "O'quvchi oddiy masalalarni mustaqil yechadi.",
      "O'quvchi xatolarini topib to'g'rilay oladi.",
    ],
    resources: ["Doska va bo'r", "Darslik", "Tarqatma material"],
    stages: buildStages(total),
    assessmentCriteria: ["Tushunchani to'g'ri izohlaydi", "Masalani mustaqil yechadi"],
  };
}

export async function startMockAiServer(): Promise<MockAiServer> {
  const state = { requestCount: 0, lastPrompts: null as MockAiServer["lastPrompts"] };

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      state.requestCount++;

      let body: {
        messages?: Array<{ role: string; content: string }>;
      } = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        // bo'sh qoladi
      }

      const messages = body.messages ?? [];
      const system = messages.find((m) => m.role === "system")?.content ?? "";
      const user = messages.find((m) => m.role === "user")?.content ?? "";
      state.lastPrompts = { system, user };

      const combined = `${system}\n${user}`;

      // ── Belgilarni tekshiramiz ───────────────────────────────────────
      if (combined.includes(MARKER_SERVER_ERROR)) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "mock: server xatosi" } }));
        return;
      }

      const content = combined.includes(MARKER_BAD_SHAPE)
        ? // Sxemaga mos kelmaydi: `stages` yo'q, `objective` juda qisqa.
          JSON.stringify({ objective: "yo'q", outcomes: [] })
        : JSON.stringify(buildLessonPlan(extractDuration(user)));

      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          model: "mock-lesson-model",
          choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
          usage: { prompt_tokens: 120, completion_tokens: 450 },
        }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("soxta AI serveri manzilini olib bo'lmadi");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    get requestCount() {
      return state.requestCount;
    },
    get lastPrompts() {
      return state.lastPrompts;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
