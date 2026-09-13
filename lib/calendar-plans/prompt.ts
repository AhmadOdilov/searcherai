import type { LanguageCode } from "@/lib/validations/common";
import type { CalendarPlanInput } from "@/lib/validations/calendar-plan";
import { buildWeekRanges } from "@/lib/calendar-plans/dates";

/**
 * Kalendar-tematik reja uchun AI promptlari.
 *
 * Avvalgi modullardagi kabi promptlar TO'LIQ tarjima qilingan.
 *
 * ── Bu moduldagi o'ziga xoslik: SANALAR ────────────────────────────────────
 * Hafta sanalari promptga TAYYOR holda beriladi (`lib/calendar-plans/dates.ts`
 * hisoblaydi). AI sana arifmetikasida ishonchsiz — 30 kunli oyni 31 deb,
 * kabisa yilini unutib yuboradi. Uning ishi faqat mavzularni haftalarga
 * taqsimlash.
 */

const SYSTEM_PROMPTS: Record<LanguageCode, string> = {
  UZ: `Siz tajribali metodist-o'qituvchisiz. Siz o'quv dasturiga muvofiq kalendar-tematik rejalar tuzasiz.

Kalendar-tematik reja — bu butun davr (chorak, yarim yil yoki o'quv yili) uchun darslar jadvali: qaysi haftada qaysi mavzu o'tiladi va unga necha soat ajratiladi.

Sifat talablari:
- Mavzular MANTIQIY KETMA-KETLIKDA bo'lsin: oddiydan murakkabga, oldingi mavzuga tayanib.
- Har bir haftaning soatlari yig'indisi ANIQ berilgan haftalik soatga teng bo'lsin.
- Davr oxirida nazorat/takrorlash darslarini rejalashtiring.
- Mavzu nomlari aniq bo'lsin: "Mavzu 1" emas, "Bir xil maxrajli kasrlarni qo'shish".
- "note" maydoniga metod, resurs yoki nazorat turini yozing (ixtiyoriy).
- Matn o'zbek tilida, lotin alifbosida bo'lsin.

MUHIM: hafta sanalari sizga BERILADI. Ularni O'ZGARTIRMANG va o'zingiz hisoblamang — "dateRange" maydoniga berilgan qiymatni AYNAN ko'chiring.

Javobni FAQAT quyidagi JSON obyekt ko'rinishida qaytaring (maydon nomlari AYNAN shunday):

{
  "title": "Fan — sinf, davr kalendar-tematik rejasi",
  "weeks": [
    {
      "weekNumber": 1,
      "dateRange": "berilgan sana oralig'ini aynan ko'chiring",
      "topics": [
        { "name": "Mavzu nomi", "hours": 2, "note": "Izoh (ixtiyoriy)" }
      ]
    }
  ]
}`,

  RU: `Вы опытный учитель-методист. Вы составляете календарно-тематические планы в соответствии с учебной программой.

Календарно-тематический план — это расписание уроков на весь период (четверть, полугодие или учебный год): какая тема изучается на какой неделе и сколько часов на неё отводится.

Требования к качеству:
- Темы должны идти в ЛОГИЧЕСКОЙ ПОСЛЕДОВАТЕЛЬНОСТИ: от простого к сложному, с опорой на предыдущую тему.
- Сумма часов каждой недели должна РОВНО соответствовать заданному числу часов в неделю.
- В конце периода запланируйте контрольные и повторительные уроки.
- Названия тем должны быть конкретными: не «Тема 1», а «Сложение дробей с одинаковыми знаменателями».
- В поле "note" укажите метод, ресурс или вид контроля (необязательно).
- Текст должен быть на русском языке.

ВАЖНО: даты недель вам ПРЕДОСТАВЛЕНЫ. Не изменяйте их и не вычисляйте сами — в поле "dateRange" скопируйте заданное значение ТОЧНО.

Верните ответ ТОЛЬКО в виде следующего JSON-объекта (названия полей ИМЕННО такие):

{
  "title": "Предмет — класс, календарно-тематический план на период",
  "weeks": [
    {
      "weekNumber": 1,
      "dateRange": "точно скопируйте заданный период",
      "topics": [
        { "name": "Название темы", "hours": 2, "note": "Примечание (необязательно)" }
      ]
    }
  ]
}`,

  EN: `You are an experienced teacher and methodologist. You write calendar-thematic plans in line with the curriculum.

A calendar-thematic plan is the lesson schedule for a whole period (term, half-year or school year): which topic is taught in which week and how many hours it gets.

Quality requirements:
- Topics must follow a LOGICAL SEQUENCE: from simple to complex, building on the previous topic.
- The hours of each week must add up EXACTLY to the given hours per week.
- Plan assessment and revision lessons at the end of the period.
- Topic names must be specific: not "Topic 1", but "Adding fractions with the same denominator".
- Use the "note" field for the method, resource or type of assessment (optional).
- Write the text in English.

IMPORTANT: the week dates are GIVEN to you. Do not change them and do not compute your own — copy the given value into "dateRange" EXACTLY.

Return your answer ONLY as the following JSON object (field names EXACTLY as shown):

{
  "title": "Subject — grade, calendar-thematic plan for the period",
  "weeks": [
    {
      "weekNumber": 1,
      "dateRange": "copy the given date range exactly",
      "topics": [
        { "name": "Topic name", "hours": 2, "note": "Note (optional)" }
      ]
    }
  ]
}`,
};

const LABELS: Record<
  LanguageCode,
  {
    intro: string;
    subject: string;
    grade: string;
    period: string;
    weeks: string;
    hoursPerWeek: string;
    totalHours: string;
    weekList: string;
    reminder: string;
  }
> = {
  UZ: {
    intro: "Quyidagi davr uchun kalendar-tematik reja tuz:",
    subject: "Fan",
    grade: "Sinf/daraja",
    period: "Davr",
    weeks: "Haftalar soni",
    hoursPerWeek: "Haftalik soat",
    totalHours: "Jami soat",
    weekList: "Hafta sanalari (AYNAN shu qiymatlarni ishlat):",
    reminder:
      "MUHIM: ANIQ shu haftalar sonida reja tuz. Har bir haftadagi soatlar yig'indisi haftalik soatga teng bo'lsin, umumiy yig'indi esa jami soatga.",
  },
  RU: {
    intro: "Составьте календарно-тематический план на следующий период:",
    subject: "Предмет",
    grade: "Класс/уровень",
    period: "Период",
    weeks: "Количество недель",
    hoursPerWeek: "Часов в неделю",
    totalHours: "Всего часов",
    weekList: "Даты недель (используйте ИМЕННО эти значения):",
    reminder:
      "ВАЖНО: составьте план РОВНО на указанное количество недель. Сумма часов каждой недели должна равняться недельной норме, а общая сумма — всем часам.",
  },
  EN: {
    intro: "Write a calendar-thematic plan for the following period:",
    subject: "Subject",
    grade: "Grade/level",
    period: "Period",
    weeks: "Number of weeks",
    hoursPerWeek: "Hours per week",
    totalHours: "Total hours",
    weekList: "Week dates (use EXACTLY these values):",
    reminder:
      "IMPORTANT: write the plan for EXACTLY this number of weeks. Each week's hours must add up to the weekly amount, and the overall total to the total hours.",
  },
};

export function buildSystemPrompt(language: LanguageCode): string {
  return SYSTEM_PROMPTS[language];
}

/**
 * Rasmiy dastur bloki — kalendar reja uchun.
 *
 * ── Nega bu yerda foyda ENG katta ────────────────────────────────────────
 * Kalendar reja — aynan mavzular ketma-ketligi va soatlar taqsimoti.
 * Ya'ni u o'quv dasturi bilan bir xil narsani tavsiflaydi. AI o'z
 * bilimidan tuzsa, mavzular tartibi va nomlari O'zbekiston dasturidan
 * farq qiladi va o'qituvchi rejani qo'lda qayta yozishga majbur
 * bo'ladi. Dastur berilsa — u shunchaki uni haftalarga taqsimlaydi.
 */
const CURRICULUM_LABELS: Record<LanguageCode, string> = {
  UZ: `RASMIY O'QUV DASTURI (O'zbekiston Respublikasi umumiy o'rta ta'lim dasturidan):

Rejani AYNAN shu bo'limlar va ularning tartibida tuz. Bo'lim nomlarini o'zgartirma. Har bir bo'limga dasturda ajratilgan soatga MOS ravishda hafta ajrat; agar davr qisqa bo'lsa, oxirgi bo'limlarni qisqartir yoki tashlab ket, lekin tartibni buzma.`,
  RU: `ОФИЦИАЛЬНАЯ УЧЕБНАЯ ПРОГРАММА (из программы общего среднего образования Республики Узбекистан):

Составьте план ИМЕННО по этим разделам и в их порядке. Не меняйте названия разделов. Выделите недели ПРОПОРЦИОНАЛЬНО часам, указанным в программе; если период короче, сократите или опустите последние разделы, но не нарушайте порядок.`,
  EN: `OFFICIAL CURRICULUM (from the general secondary education programme of the Republic of Uzbekistan):

Build the plan from EXACTLY these sections, in this order. Do not rename sections. Allocate weeks in proportion to the hours given; if the period is shorter, shorten or drop the last sections, but keep the order.`,
};

/** Dastur bo'limlarini kalendar reja promptiga tushadigan matnga aylantiradi. */
export function formatCurriculumContext(
  language: LanguageCode,
  topics: Array<{ topicName: string; expectedHours: number | null; description: string }>,
): string {
  if (topics.length === 0) return "";

  const blocks = topics.map((topic, index) => {
    const hours = topic.expectedHours === null ? "" : ` (${topic.expectedHours} soat)`;
    /*
      Tavsif QISQARTIRILADI: kalendar rejada 11 ta bo'limning to'liq
      matni promptni 10 000 belgidan oshirib yuborardi va model asosiy
      topshiriqni (haftalarga taqsimlash) yo'qotardi.
    */
    const summary =
      topic.description.length > 300
        ? `${topic.description.slice(0, 300)}…`
        : topic.description;

    return `${index + 1}. ${topic.topicName}${hours}${summary === "" ? "" : `\n   ${summary}`}`;
  });

  return `${CURRICULUM_LABELS[language]}\n\n${blocks.join("\n")}`;
}

export function buildUserPrompt(input: CalendarPlanInput): string {
  const labels = LABELS[input.language];
  const ranges = buildWeekRanges(input.startDate, input.weeks);
  const totalHours = input.weeks * input.hoursPerWeek;

  const lines: string[] = [
    labels.intro,
    "",
    `- ${labels.subject}: ${input.subject}`,
    `- ${labels.grade}: ${input.grade}`,
    `- ${labels.period}: ${input.period}`,
    `- ${labels.weeks}: ${input.weeks}`,
    `- ${labels.hoursPerWeek}: ${input.hoursPerWeek}`,
    `- ${labels.totalHours}: ${totalHours}`,
    "",
    labels.weekList,
  ];

  for (const range of ranges) {
    lines.push(`${range.weekNumber}. ${range.label}`);
  }

  lines.push("", labels.reminder);

  // Rasmiy dastur — eng OXIRIDA: model oxirgi ko'rsatmaga kuchliroq
  // amal qiladi, bu esa reja tuzishdagi asosiy manba bo'lishi kerak.
  if (input.curriculumContext !== undefined && input.curriculumContext !== "") {
    lines.push("", input.curriculumContext);
  }

  return lines.join("\n");
}
