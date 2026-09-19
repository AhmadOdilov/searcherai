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

/** Yozib olinadigan prompt — rasm soni bilan birga. */
export interface AiPromptRecord {
  system: string;
  user: string;
  /** So'rovga biriktirilgan rasmlar soni. */
  imageCount: number;
}

export interface MockAiServer {
  baseUrl: string;
  /** Tinglanayotgan port — havolani boshqa xost nomi bilan qayta qurish uchun. */
  port: number;
  requestCount: number;
  /** Oxirgi so'rovdagi promptlar — tilni tekshirish uchun. */
  lastPrompts: AiPromptRecord | null;
  /**
   * BARCHA so'rovlardagi promptlar.
   *
   * Nega kerak: integratsiya sinovi "dars ishlanmasi mazmuni AI'ga
   * yuborilganmi?" degan savolga javob berishi kerak. Soxta server
   * alohida jarayonda emas, SINOV jarayonida ishlaydi — shuning uchun
   * sinov yuborilgan promptni to'g'ridan-to'g'ri o'qiy oladi.
   */
  prompts: AiPromptRecord[];
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

/**
 * So'rov prezentatsiya SKELETI uchunmi.
 *
 * ── Nega alohida tekshiruv ────────────────────────────────────────────────
 * Prezentatsiya endi IKKI bosqichda yaratiladi (lib/presentations/pipeline.ts):
 * avval skelet, keyin matn. Ikkala bosqichning system prompti ham
 * `"slides"` kalitini o'z ichiga oladi, shuning uchun eski tekshiruv
 * skeletga MATN javobini qaytarib yuborardi va generatsiya yiqilardi.
 *
 * Skelet promptining farqlovchi belgisi — `"beatKey"` maydoni.
 * Tekshiruv TARTIBI muhim: skelet oldin tekshiriladi.
 */
function isOutlineRequest(systemPrompt: string): boolean {
  return systemPrompt.includes('"beatKey"');
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

/**
 * Xabar mazmunidan MATNNI ajratib oladi.
 *
 * ── Nega kerak ────────────────────────────────────────────────────────────
 * OpenAI-mos API'da `content` ikki shaklda bo'ladi: oddiy satr (faqat
 * matn) yoki bo'laklar massivi (rasm bo'lsa). Soxta server dastlab
 * faqat satrni kutardi va rasm kelganda `[object Object]` ni yozib
 * qo'yardi — natijada promptni qidiradigan sinovlar ishlamay qoldi.
 */
function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter(
      (part): part is { type: string; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

/** Xabarga nechta rasm biriktirilgan. */
function imagesIn(content: unknown): number {
  if (!Array.isArray(content)) return 0;
  return content.filter(
    (part) =>
      typeof part === "object" &&
      part !== null &&
      (part as { type?: unknown }).type === "image_url",
  ).length;
}

/**
 * So'rov rasm tahlili uchunmi.
 *
 * Javob shakli foydalanuvchi promptida beriladi (qidiruv kabi),
 * shuning uchun TO'LIQ matn tekshiriladi.
 */
function isVisionRequest(combined: string): boolean {
  return combined.includes('"keyContent"');
}

/** Soxta rasm tahlili — `visionAnalysisSchema` ga mos. */
function buildVisionAnalysis() {
  return {
    description:
      "Soxta AI javobi: rasmda darslik sahifasi ko'rsatilgan, unda kasrlar mavzusi va bir nechta misol bor.",
    subject: "Matematika",
    grade: "7-sinf",
    topic: "Kasrlarni qo'shish",
    keyContent: [
      "Kasrlarni qo'shish qoidasi",
      "Umumiy maxrajga keltirish",
      "Ikkita yechilgan misol",
    ],
    usable: true,
  };
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

/**
 * Skelet promptidan hikoya bosqichlarini o'qiydi.
 *
 * Soxta model ham HAQIQIY model kabi ishlashi kerak: unga berilgan
 * beatlar ro'yxatiga AYNAN rioya qilishi shart. Aks holda sinov
 * quvurning eng muhim shartini (slaydlar soni) tekshirmay qolardi.
 */
function extractBeats(prompt: string): Array<{ key: string; purpose: string }> {
  const beats: Array<{ key: string; purpose: string }> = [];
  for (const line of prompt.split("\n")) {
    const match = line.match(/^\d+\.\s+beatKey="([^"]+)"[^—]*—\s*(.+)$/);
    if (match) beats.push({ key: match[1], purpose: match[2].trim() });
  }
  return beats;
}

/** Promptda ruxsat etilgan mazmun shakllari. */
function extractAllowedTypes(prompt: string): string[] {
  const types: string[] = [];
  for (const line of prompt.split("\n")) {
    const match = line.match(/^- "([a-zA-Z]+)" —/);
    if (match) types.push(match[1]);
  }
  return types;
}

/** Sxemadan o'tadigan SKELET — beatlar promptdan ko'chiriladi. */
function buildOutline(prompt: string) {
  const beats = extractBeats(prompt);
  const allowed = extractAllowedTypes(prompt);
  const archetype =
    prompt.match(/\b(educational|investor|business|report)\b/)?.[1] ?? "educational";

  // Muqovadan keyin navbat bilan almashtiramiz — natija bir xil
  // shakldagi slaydlar ketma-ketligi bo'lib qolmasin.
  const rotation = allowed.filter((type) => type !== "statement");
  const pick = (index: number) =>
    index === 0 || rotation.length === 0
      ? "statement"
      : rotation[(index - 1) % rotation.length];

  return {
    title: "Soxta AI skeleti — sinov prezentatsiyasi",
    archetype,
    slides: beats.map((beat, index) => ({
      beatKey: beat.key,
      heading: `${index + 1}. ${beat.purpose}`.slice(0, 120),
      keyMessage: `${beat.purpose} — shu slaydning asosiy fikri.`.slice(0, 200),
      contentType: pick(index),
    })),
  };
}

/**
 * Mazmun promptidan slayd rejasini o'qiydi.
 *
 * Har bir slayd bloki shunday ko'rinadi:
 *   SLAYD 3 [type=content]
 *     heading: ...
 *     mazmun shakli: cards → ...
 */
function extractPlannedSlides(
  prompt: string,
): Array<{ type: string; heading: string; shape: string }> {
  const slides: Array<{ type: string; heading: string; shape: string }> = [];
  const lines = prompt.split("\n");

  for (let index = 0; index < lines.length; index++) {
    const header = lines[index].match(/^SLAYD \d+ \[type=(title|content|summary)\]$/);
    if (!header) continue;

    const heading = lines[index + 1]?.match(/^\s+heading:\s*(.+)$/)?.[1] ?? "Slayd";
    let shape = "bullets";
    for (let offset = 2; offset <= 5; offset++) {
      const match = lines[index + offset]?.match(/shakli:\s*([a-zA-Z]+)\s*→/);
      if (match) {
        shape = match[1];
        break;
      }
    }
    slides.push({ type: header[1], heading: heading.trim(), shape });
  }

  return slides;
}

/** Rejadagi shaklga mos slayd mazmuni. */
function buildPlannedSlide(planned: { type: string; heading: string; shape: string }) {
  const base = {
    type: planned.type,
    heading: planned.heading.slice(0, 120),
    bullets: [] as string[],
    keyMessage: "Soxta AI javobi: shu slaydning asosiy fikri.",
    speakerNotes: "Soxta AI: o'qituvchi uchun izoh.",
  };

  switch (planned.shape) {
    case "cards":
      return {
        ...base,
        cards: [
          { title: "Birinchi", body: "Soxta tavsif" },
          { title: "Ikkinchi", body: "Soxta tavsif" },
          { title: "Uchinchi", body: "Soxta tavsif" },
        ],
      };
    case "steps":
      return {
        ...base,
        steps: [
          { label: "Bosqich 1", body: "Soxta tavsif" },
          { label: "Bosqich 2", body: "Soxta tavsif" },
          { label: "Bosqich 3", body: "Soxta tavsif" },
        ],
      };
    case "comparison":
      return {
        ...base,
        comparison: {
          leftTitle: "Chap",
          leftItems: ["Birinchi"],
          rightTitle: "O'ng",
          rightItems: ["Ikkinchi"],
        },
      };
    case "quote":
      return {
        ...base,
        quote: { text: "Bu yetarlicha uzun soxta iqtibos matni.", author: "Muallif" },
      };
    case "statistic":
      return { ...base, statistic: { value: "35%", caption: "Soxta ko'rsatkich" } };
    case "chart":
      return {
        ...base,
        chart: {
          kind: "bar",
          categories: ["A", "B"],
          series: [{ name: "Qator", values: [1, 2] }],
        },
      };
    case "statement":
      return base;
    default:
      return {
        ...base,
        bullets: ["Birinchi fikr", "Ikkinchi fikr", "Uchinchi fikr"],
      };
  }
}

/** Rejaga MOS prezentatsiya mazmuni — slaydlar soni promptdan olinadi. */
function buildPlannedPresentation(prompt: string, topic: string) {
  const planned = extractPlannedSlides(prompt);

  // Reja o'qilmasa eski xatti-harakatga qaytamiz — sinov "javob yo'q"
  // o'rniga aniq sxema xatosini ko'rsin.
  if (planned.length === 0) return buildPresentation(topic);

  return {
    title: prompt.match(/^title:\s*(.+)$/m)?.[1]?.slice(0, 150) ?? topic.slice(0, 150),
    slides: planned.map(buildPlannedSlide),
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

export interface MockAiOptions {
  /**
   * Qaysi interfeysda tinglansin. Standart `127.0.0.1` — soxta server
   * faqat shu mashinadagi sinovlarga ochiq bo'lsin.
   *
   * Production smoke testi Docker konteynerida ishlayotgan ilovani
   * sinaydi va konteyner uchun `127.0.0.1` — uning O'Z ichi, xost emas.
   * O'sha holatda `0.0.0.0` beriladi (tests/smoke/helpers/target.ts).
   */
  host?: string;
}

export async function startMockAiServer(
  options: MockAiOptions = {},
): Promise<MockAiServer> {
  const host = options.host ?? "127.0.0.1";
  const state = {
    requestCount: 0,
    lastPrompts: null as MockAiServer["lastPrompts"],
    prompts: [] as AiPromptRecord[],
    /*
      Keyingi RASM so'roviga server xatosi qaytariladi (bir martalik).

      Nega alohida tugma, MARKER_SERVER_ERROR emas: belgilar PROMPT
      ichida uzatiladi, rasm tahlilining promptida esa foydalanuvchi
      yozadigan erkin matn YO'Q — unga faqat fan va sinf tushadi,
      ikkalasi ham enum (lib/vision/prompt.ts → buildVisionUserPrompt).
      Ya'ni bu yo'lni belgi bilan sinab bo'lmaydi.

      Nega faqat RASM so'roviga: boshqa modullar generatsiyani fonda
      davom ettiradi va o'sha paytda kelib qolgan so'rov bayroqni
      o'g'irlab ketishi mumkin edi. Rasm tahlili esa sinxron va faqat
      shu faylda ishlatiladi.
    */
    failNextVision: false,
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
    /* Keyingi rasm so'rovini yiqitish — yuqoridagi `failNextVision` ga qara. */
    if (req.url === "/__vision-fail" && req.method === "POST") {
      state.failNextVision = true;
      res.writeHead(204).end();
      return;
    }

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
      const systemMessage = messages.find((m) => m.role === "system");
      const userMessage = messages.find((m) => m.role === "user");

      const system = textOf(systemMessage?.content);
      const user = textOf(userMessage?.content);
      // Rasm haqiqatan yuborilganini sinovlar tekshira olishi uchun.
      const imageCount = imagesIn(userMessage?.content);

      state.lastPrompts = { system, user, imageCount };
      state.prompts.push({ system, user, imageCount });

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

      // Tartib MUHIM: skelet prompti ham `"slides"` ni o'z ichiga oladi.
      const outline = isOutlineRequest(system);
      const presentation = !outline && isPresentationRequest(system);
      const calendarPlan = isCalendarPlanRequest(system);
      const search = isSearchRequest(combined);
      const vision = isVisionRequest(combined);

      if (vision && state.failNextVision) {
        state.failNextVision = false;
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "mock: rasm tahlili xatosi" } }));
        return;
      }

      let content: string;
      if (combined.includes(MARKER_BAD_SHAPE)) {
        // Sxemaga mos kelmaydigan javob — har uch modul uchun.
        if (outline || presentation) {
          content = JSON.stringify({ title: "x", slides: [] });
        } else if (calendarPlan) {
          content = JSON.stringify({ title: "x", weeks: [] });
        } else if (vision) {
          content = JSON.stringify({ description: "qisqa", keyContent: [] });
        } else if (search) {
          content = JSON.stringify({ answer: "qisqa", keyPoints: [] });
        } else {
          content = JSON.stringify({ objective: "yo'q", outcomes: [] });
        }
      } else if (vision) {
        content = JSON.stringify(buildVisionAnalysis());
      } else if (search) {
        content = JSON.stringify(buildSearchAnswer(user));
      } else if (outline) {
        content = JSON.stringify(buildOutline(user));
      } else if (presentation) {
        content = JSON.stringify(buildPlannedPresentation(user, extractTopic(user)));
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

  await new Promise<void>((resolve) => server.listen(0, host, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("soxta AI serveri manzilini olib bo'lmadi");
  }

  return {
    /*
      `0.0.0.0` — tinglash manzili, murojaat manzili emas: unga so'rov
      yuborib bo'lmaydi. Shu holatda havola `127.0.0.1` bilan quriladi,
      konteyner uchun kerakli xost nomini esa chaqiruvchi o'zi qo'yadi.
    */
    baseUrl: `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${address.port}`,
    port: address.port,
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
