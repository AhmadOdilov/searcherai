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

/** Mavzuda shu so'z bo'lsa — umuman JSON bo'lmagan javob. */
export const MARKER_NOT_JSON = "XATO-JSON";

/**
 * Mavzuda shu so'z bo'lsa — javob ataylab kechiktiriladi.
 *
 * Nega kerak: soxta AI odatda ~10ms da javob beradi va yozuv deyarli
 * darhol READY bo'ladi. PENDING holatiga bog'liq xatti-harakatni
 * (masalan «bir vaqtda ikki generatsiya» tekshiruvini) sinash uchun
 * yozuv bir muddat PENDING turishi kerak.
 */
export const MARKER_SLOW = "SEKIN-SINOV";

/** `MARKER_SLOW` bo'lganda javob shuncha kechikadi. */
const SLOW_DELAY_MS = 3000;

export interface MockAiServer {
  baseUrl: string;
  requestCount: number;
  /** Oxirgi so'rovdagi promptlar — tilni tekshirish uchun. */
  lastPrompts: { system: string; user: string } | null;
  /**
   * BARCHA so'rovlardagi promptlar.
   *
   * Nega kerak: integratsiya sinovi "dars ishlanmasi mazmuni AI'ga
   * yuborilganmi?" degan savolga javob berishi kerak. Soxta server
   * alohida jarayonda emas, SINOV jarayonida ishlaydi — shuning uchun
   * sinov yuborilgan promptni to'g'ridan-to'g'ri o'qiy oladi.
   */
  prompts: Array<{ system: string; user: string }>;
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

/** Promptdan mavzuni ajratib oladi — javob unga bog'liq bo'lsin. */
function extractTopic(prompt: string): string {
  const match = prompt.match(/(?:Mavzu|Тема|Topic):\s*(.+)/);
  return match ? match[1].trim().slice(0, 100) : "Dars mavzusi";
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

/**
 * So'rov prezentatsiya uchunmi yoki dars ishlanmasi uchunmi.
 *
 * Ikkisi bir xil endpointga (`/chat/completions`) keladi, shuning uchun
 * system promptdagi sxema kalitiga qarab ajratamiz.
 */
function isPresentationRequest(systemPrompt: string): boolean {
  return systemPrompt.includes('"slides"');
}

/** So'rov kalendar reja uchunmi. */
function isCalendarPlanRequest(systemPrompt: string): boolean {
  return systemPrompt.includes('"weekNumber"');
}

/**
 * So'rov AI qidiruv uchunmi.
 *
 * DIQQAT: boshqa ikkitasidan farqli o'laroq, bu yerda TO'LIQ matn
 * (system + user) tekshiriladi. Qidiruvda javob shakli tizim promptida
 * emas, foydalanuvchi promptida beriladi.
 */
function isSearchRequest(combined: string): boolean {
  return combined.includes('"classroomIdeas"');
}

/** Soxta qidiruv javobi — `searchAnswerSchema` ga mos. */
function buildSearchAnswer(userPrompt: string) {
  const question = userPrompt.slice(0, 60).replace(/\s+/g, " ");

  return {
    answer: `Soxta AI javobi. So'rov shunday boshlangan edi: ${question}. Bu matn sinov uchun yetarlicha uzun bo'lishi kerak.`,
    keyPoints: [
      "Birinchi asosiy nuqta",
      "Ikkinchi asosiy nuqta",
      "Uchinchi asosiy nuqta",
    ],
    classroomIdeas: [
      "Doskaga oddiy sxema chizib, o'quvchilardan to'ldirishni so'rang.",
      "Juftlikda ishlash uchun uchta qisqa savol bering.",
    ],
  };
}

/**
 * Promptdagi hafta sanalari ro'yxatini o'qiydi.
 *
 * Prompt "1. 14.09.2026 – 20.09.2026" ko'rinishidagi qatorlarni beradi;
 * soxta AI ularni AYNAN ko'chiradi — haqiqiy model ham shunday qilishi
 * kerak.
 */
function extractWeekRanges(prompt: string): Array<{ number: number; range: string }> {
  const result: Array<{ number: number; range: string }> = [];
  for (const line of prompt.split("\n")) {
    const match = line.match(
      /^(\d+)\.\s+(\d{2}\.\d{2}\.\d{4}\s+–\s+\d{2}\.\d{2}\.\d{4})$/,
    );
    if (match) result.push({ number: Number(match[1]), range: match[2] });
  }
  return result;
}

/** Promptdan haftalik soatni o'qiydi. */
function extractHoursPerWeek(prompt: string): number {
  const match = prompt.match(/(?:Haftalik soat|Часов в неделю|Hours per week):\s*(\d+)/);
  return match ? Number(match[1]) : 2;
}

/** Sxemadan o'tadigan kalendar reja — sanalar promptdan ko'chiriladi. */
function buildCalendarPlan(prompt: string) {
  const ranges = extractWeekRanges(prompt);
  const hoursPerWeek = extractHoursPerWeek(prompt);

  return {
    title: "Sinov fani — kalendar-tematik reja",
    weeks: ranges.map(({ number, range }) => ({
      weekNumber: number,
      dateRange: range,
      topics: [
        {
          name: `${number}-hafta mavzusi: asosiy tushunchalar`,
          hours: hoursPerWeek,
          note: number % 4 === 0 ? "Nazorat ishi" : undefined,
        },
      ],
    })),
  };
}

/** Sxemadan o'tadigan prezentatsiya (6 slayd: sarlavha + 4 mazmun + xulosa). */
function buildPresentation(topic: string) {
  return {
    title: `${topic} — dars prezentatsiyasi`.slice(0, 150),
    slides: [
      {
        type: "title",
        heading: topic.slice(0, 120),
        bullets: ["Biologiya · 7-sinf"],
        speakerNotes: "Darsni savol bilan boshlang.",
      },
      {
        type: "content",
        heading: "Dars maqsadi",
        bullets: ["Asosiy tushunchani o'zlashtirish", "Amaliy masalalarni yechish"],
      },
      {
        type: "content",
        heading: "Yangi mavzu",
        bullets: ["Birinchi asosiy fikr", "Ikkinchi asosiy fikr", "Uchinchi fikr"],
        speakerNotes: "Doskada sxema chizing.",
      },
      {
        type: "content",
        heading: "Misollar",
        bullets: ["Birinchi misol", "Ikkinchi misol"],
      },
      {
        type: "content",
        heading: "Mustahkamlash",
        bullets: ["Mustaqil mashq", "Juftlikda ishlash"],
      },
      {
        type: "summary",
        heading: "Xulosa",
        bullets: ["Asosiy fikrni takrorlash", "Uyga vazifa"],
      },
    ],
  };
}

export async function startMockAiServer(): Promise<MockAiServer> {
  const state = {
    requestCount: 0,
    lastPrompts: null as MockAiServer["lastPrompts"],
    prompts: [] as Array<{ system: string; user: string }>,
  };

  const server: Server = createServer((req, res) => {
    /*
      Introspeksiya endpointi.

      Nega kerak: soxta server TEST RUNNER jarayonida ishlaydi, sinov
      fayllari esa alohida bola jarayonlarda. Ya'ni sinov `state.prompts`
      ga to'g'ridan-to'g'ri tega olmaydi — ular boshqa xotirada.

      Shuning uchun yozib olingan promptlar HTTP orqali beriladi. Sinov
      `${process.env.AI_BASE_URL}/__prompts` ni o'qib, AI'ga nima
      yuborilganini tekshiradi.
    */
    if (req.url === "/__prompts") {
      if (req.method === "DELETE") {
        state.prompts.length = 0;
        res.writeHead(204).end();
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ prompts: state.prompts }));
      return;
    }

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
      state.prompts.push({ system, user });

      const combined = `${system}\n${user}`;

      // ── Belgilarni tekshiramiz ───────────────────────────────────────
      if (combined.includes(MARKER_SERVER_ERROR)) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "mock: server xatosi" } }));
        return;
      }

      if (combined.includes(MARKER_NOT_JSON)) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            model: "mock-model",
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "Kechirasiz, men bu so'rovni bajara olmayman.",
                },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 10 },
          }),
        );
        return;
      }

      const slow = combined.includes(MARKER_SLOW);

      const presentation = isPresentationRequest(system);
      const calendarPlan = isCalendarPlanRequest(system);
      const search = isSearchRequest(combined);

      let content: string;
      if (combined.includes(MARKER_BAD_SHAPE)) {
        // Sxemaga mos kelmaydigan javob — har uch modul uchun.
        if (presentation) {
          content = JSON.stringify({ title: "x", slides: [] });
        } else if (calendarPlan) {
          content = JSON.stringify({ title: "x", weeks: [] });
        } else if (search) {
          content = JSON.stringify({ answer: "qisqa", keyPoints: [] });
        } else {
          content = JSON.stringify({ objective: "yo'q", outcomes: [] });
        }
      } else if (search) {
        content = JSON.stringify(buildSearchAnswer(user));
      } else if (presentation) {
        content = JSON.stringify(buildPresentation(extractTopic(user)));
      } else if (calendarPlan) {
        content = JSON.stringify(buildCalendarPlan(user));
      } else {
        content = JSON.stringify(buildLessonPlan(extractDuration(user)));
      }

      /*
        SEKIN-SINOV markeri: javob ataylab kechiktiriladi. Bu PENDING
        yozuvni "hali tayyor emas" holatida ushlab turish uchun kerak —
        aks holda soxta AI ~10 ms da javob beradi va ikkinchi so'rov
        kelguncha yozuv allaqachon READY bo'lib qoladi.
      */
      const send = () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            model: "mock-lesson-model",
            choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
            usage: { prompt_tokens: 120, completion_tokens: 450 },
          }),
        );
      };

      if (slow) {
        setTimeout(send, SLOW_DELAY_MS).unref();
      } else {
        send();
      }
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
    get prompts() {
      return state.prompts;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
