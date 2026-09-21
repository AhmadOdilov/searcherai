import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Seed ISHCHISI — alohida `tsx` jarayonida bajariladi.
 *
 * ── Nega ALOHIDA jarayon ──────────────────────────────────────────────────
 * Playwright TypeScript'ni CommonJS'ga o'giradi, Prisma'ning generatsiya
 * qilingan klienti esa faqat ESM. Ularni bir jarayonda birlashtirib
 * bo'lmaydi ("Cannot use 'import.meta' outside a module").
 *
 * Shuning uchun baza ishi `tsx` ostidagi alohida jarayonda bajariladi —
 * xuddi mavjud e2e to'plamidagi kabi — va natija JSON bo'lib qaytadi.
 *
 * ── Nega `lib/db.ts` ishlatilmaydi ────────────────────────────────────────
 * U `server-only` ni import qiladi va `--conditions=react-server` bilan
 * ishlaydigan muhitni kutadi. Bu yerda klient to'g'ridan-to'g'ri
 * quriladi — bu sinov uskunasi, ilova kodi emas.
 *
 * ── Nega yozuvlar bazaga TO'G'RIDAN-TO'G'RI qo'yiladi ─────────────────────
 * Brauzer testlari muharrirni tekshiradi, generatsiyani emas. HTTP orqali
 * yaratsak, har bir sinov haqiqiy AI so'rovi yuborardi: sekin, qimmat va
 * natijasi har safar boshqacha. Tayyor yozuv esa BASHORAT QILINADIGAN —
 * sinov aynan nimani ko'rishini biladi.
 *
 * ── Ma'lumot ATAYLAB "og'ir" ──────────────────────────────────────────────
 * Uzun sarlavha (sxemadagi chegaraga yaqin), ko'p slayd, 24 hafta,
 * 12 bosqich. Aynan shunday ma'lumot Phase 2.1 dagi joylashuv nuqsonini
 * ochgan edi — o'rtacha holat uni yashirardi.
 */

loadEnv({ path: ".env", quiet: true });

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined || connectionString === "") {
  throw new Error("DATABASE_URL sozlanmagan — .env faylini tekshiring");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Sinov hisoblarining prefiksi — tozalash aynan shularni topadi. */
const BROWSER_TEST_PREFIX = "e2e-test-browser-";

interface SeededWorkspace {
  cookie: { name: string; value: string };
  email: string;
  presentationId: string;
  calendarPlanId: string;
  lessonPlanId: string;
  /** Muharrirda ko'rinishi kerak bo'lgan uzun sarlavha. */
  longHeading: string;
}

/**
 * Uzun slayd sarlavhasi — sxemadagi 120 belgilik chegaraga yaqin.
 *
 * Aynan shu uzunlik Phase 2.1 da ustunni ~830px ga cho'zgan edi.
 */
const LONG_HEADING =
  "Juda uzun slayd sarlavhasi — telefonda ikki yoki uch qatorga tushishi va qutidan chiqib ketmasligi kerak";

async function seedWorkspace(baseUrl: string, suffix: string): Promise<SeededWorkspace> {
  const email = `${BROWSER_TEST_PREFIX}${suffix}-${Date.now()}@sinov.uz`;

  /*
    Hisob HTTP orqali ochiladi — parol hash'i va sessiya ilovaning O'Z
    mantig'i bilan yaratilsin. Ro'yxatdan o'tish AI chaqirmaydi.
  */
  const registered = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "juda-maxfiy-parol",
      fullName: "Brauzer Sinovi",
    }),
    redirect: "manual",
  });
  if (registered.status !== 201) {
    throw new Error(`ro'yxatdan o'tish muvaffaqiyatsiz: ${registered.status}`);
  }

  const raw = registered.headers
    .getSetCookie()
    .find((c) => c.startsWith("searcher_session="));
  if (raw === undefined) throw new Error("sessiya cookie'si kelmadi");

  const [name, value] = raw.split(";")[0].split("=");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  // ── Prezentatsiya: 20 slayd, biri yashirilgan ──
  const slides = Array.from({ length: 20 }, (_, index) => ({
    type: index === 0 ? "title" : index === 19 ? "summary" : "content",
    heading: index === 3 ? LONG_HEADING : `Slayd ${index + 1}`,
    bullets:
      index === 0
        ? []
        : [
            "Qisqa band",
            "Ancha uzunroq band matni: o'qituvchi yozishi mumkin bo'lgan to'liq jumla",
          ],
    ...(index === 5 ? { hidden: true } : {}),
  }));

  /*
    ── V6 blokli slaydlar ─────────────────────────────────────────────────
    Yuqoridagi yigirmata slaydda faqat bandlar bor va aynan shuning uchun
    brauzer sinovlari uzoq vaqt kartali/bosqichli slaydlarni HECH QACHON
    ko'rmagan. Ko'rish rejimi ularni chizmasligi ham shu sababdan
    sezilmagan edi.

    Markerlar (`KARTA-ALFA` kabi) ataylab to'qnashmaydigan: ekranda
    ularni qidirish boshqa matnga tushib ketmasin.
  */
  const blockSlides = [
    {
      type: "content",
      heading: "Kartalar slaydi",
      bullets: [] as string[],
      layout: "threeCards",
      eyebrow: "YORLIQ-ALFA",
      cards: [
        { title: "KARTA-ALFA", body: "Karta tavsifi alfa" },
        { title: "KARTA-BETA", body: "Karta tavsifi beta" },
        { title: "KARTA-GAMMA" },
      ],
      source: "MANBA-ALFA",
    },
    {
      type: "content",
      heading: "Bosqichlar slaydi",
      bullets: [] as string[],
      layout: "process",
      steps: [
        { label: "BOSQICH-ALFA", body: "Bosqich tavsifi alfa" },
        { label: "BOSQICH-BETA", body: "Bosqich tavsifi beta" },
        { label: "BOSQICH-GAMMA", body: "Bosqich tavsifi gamma" },
      ],
    },
    {
      type: "content",
      heading: "Taqqoslash slaydi",
      bullets: [] as string[],
      layout: "comparison",
      comparison: {
        leftTitle: "CHAP-USTUN",
        leftItems: ["CHAP-ALFA", "CHAP-BETA"],
        rightTitle: "ONG-USTUN",
        rightItems: ["ONG-ALFA"],
      },
    },
    {
      type: "content",
      heading: "Statistika slaydi",
      bullets: [] as string[],
      layout: "statistic",
      statistic: { value: "78%", caption: "STATISTIKA-IZOHI" },
    },
    {
      type: "content",
      heading: "Iqtibos slaydi",
      bullets: [] as string[],
      layout: "quote",
      quote: { text: "IQTIBOS-MATNI yetarlicha uzun jumla.", author: "IQTIBOS-MUALLIFI" },
    },
  ];

  // Xulosa OXIRIDA qolsin — bloklar undan oldin joylashtiriladi.
  slides.splice(slides.length - 1, 0, ...blockSlides);

  const presentation = await prisma.presentation.create({
    data: {
      userId: user.id,
      topic: "Brauzer sinovi",
      title: "Brauzer sinovi — uzun prezentatsiya nomi bilan",
      language: "UZ",
      template: "klassik",
      status: "READY",
      slideCount: 24,
      content: { title: "Brauzer sinovi — uzun prezentatsiya nomi bilan", slides },
    },
  });

  // ── Kalendar reja: 24 hafta × 2 mavzu = 48 qator (eng katta holat) ──
  const weeks = Array.from({ length: 24 }, (_, index) => ({
    weekNumber: index + 1,
    dateRange: `${String(index + 1).padStart(2, "0")}.09.2026 – ${String(index + 7).padStart(2, "0")}.09.2026`,
    topics: [
      { name: `Mavzu ${index + 1}: uzunroq nom bilan tekshiruv uchun`, hours: 1 },
      { name: `Qo'shimcha mavzu ${index + 1}`, hours: 1, note: "Izoh matni" },
    ],
  }));

  const calendarPlan = await prisma.calendarPlan.create({
    data: {
      userId: user.id,
      subject: "Matematika",
      grade: "7-sinf",
      period: "Brauzer sinovi",
      weeks: 24,
      hoursPerWeek: 2,
      startDate: new Date("2026-09-14"),
      language: "UZ",
      title: "24 haftalik brauzer sinovi",
      status: "READY",
      rowCount: 48,
      content: { title: "24 haftalik brauzer sinovi", weeks },
    },
  });

  // ── Dars ishlanmasi: 12 bosqich (sxemadagi eng katta) ──
  const stages = Array.from({ length: 12 }, (_, index) => ({
    name: `Bosqich ${index + 1}`,
    durationMinutes: index === 0 ? 8 : 3,
    description: "Bosqich tavsifi: yetarlicha uzun matn bilan maydon tekshiriladi.",
    teacherActivity: "O'qituvchi tushuntiradi va savol beradi.",
    studentActivity: "O'quvchilar javob beradi va mashq bajaradi.",
  }));

  const lessonPlan = await prisma.lessonPlan.create({
    data: {
      userId: user.id,
      subject: "Biologiya",
      grade: "7-sinf",
      topic: "Brauzer sinovi darsi",
      durationMinutes: 45,
      lessonType: "NEW_TOPIC",
      language: "UZ",
      status: "READY",
      content: {
        objective: "Dars maqsadi: o'quvchilar mavzuni tushunadi va misollar yecha oladi.",
        outcomes: ["O'quvchi ta'rifni ayta oladi", "O'quvchi misol yecha oladi"],
        resources: ["Darslik", "Doska va bo'r"],
        stages,
        assessmentCriteria: ["To'g'ri javoblar soni", "Mustaqil ish sifati"],
      },
    },
  });

  return {
    cookie: { name, value },
    email,
    presentationId: presentation.id,
    calendarPlanId: calendarPlan.id,
    lessonPlanId: lessonPlan.id,
    longHeading: LONG_HEADING,
  };
}

/** Sinov hisoblarini va ularning yozuvlarini o'chiradi. */
async function cleanupBrowserUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: { email: { startsWith: BROWSER_TEST_PREFIX } },
  });
}

/**
 * Yozuv holatini O'ZGARTIRISH — polling sinovi uchun.
 *
 * ── Nega kerak ────────────────────────────────────────────────────────────
 * Polling mexanizmini tekshirish uchun yozuv PENDING dan READY ga o'tishi
 * kerak. Buni haqiqiy AI generatsiyasi bilan qilish sinovni sekin (20-90
 * soniya), qimmat va beqaror qilardi. Bu yerda o'tish BEVOSITA bazada
 * bajariladi — shunda sinov faqat polling mexanizmini o'lchaydi.
 */
async function setStatus(model: string, id: string, status: string): Promise<void> {
  const data = { status: status as "PENDING" | "READY" | "FAILED" };
  if (model === "presentation") {
    await prisma.presentation.update({ where: { id }, data });
  } else if (model === "calendarPlan") {
    await prisma.calendarPlan.update({ where: { id }, data });
  } else if (model === "lessonPlan") {
    await prisma.lessonPlan.update({ where: { id }, data });
  } else {
    throw new Error(`noma'lum model: ${model}`);
  }
}

/**
 * CLI: `seed <baseUrl> <suffix>`, `cleanup` yoki
 * `set-status <model> <id> <status>`.
 *
 * Natija STDOUT ga JSON bo'lib chiqadi — chaqiruvchi shuni o'qiydi.
 */
async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "seed") {
    const [baseUrl, suffix] = rest;
    const workspace = await seedWorkspace(baseUrl, suffix);
    process.stdout.write(JSON.stringify(workspace));
  } else if (command === "cleanup") {
    await cleanupBrowserUsers();
    process.stdout.write("{}");
  } else if (command === "set-status") {
    const [model, id, status] = rest;
    await setStatus(model, id, status);
    process.stdout.write("{}");
  } else {
    throw new Error(`noma'lum buyruq: ${command}`);
  }

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
