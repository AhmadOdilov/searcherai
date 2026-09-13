import type { LanguageCode } from "@/lib/validations/common";
import type { SearchInput } from "@/lib/validations/search";

/**
 * AI qidiruv promptlari.
 *
 * ── Nega har bir til uchun to'liq matn ────────────────────────────────────
 * "Javobni rus tilida ber" deb o'zbekcha promptga qo'shish yetarli emas:
 * model ko'rsatmani qisman bajaradi — sarlavhalarni tarjima qilib,
 * matnni prompt tilida qoldiradi. Bu qoida loyihaning qolgan uch
 * modulida ham amal qiladi.
 */

const SYSTEM: Record<LanguageCode, string> = {
  UZ: `Sen O'zbekiston maktab o'qituvchilariga yordam beradigan metodist yordamchisisan.

Sening vazifang — o'qituvchining savoliga DARSGA TAYYORLANISH uchun javob berish.

Qoidalar:
· Javob aniq va amaliy bo'lsin. Umumiy gaplar ("bu muhim mavzu") kerak emas.
· Sinf darajasiga mosla: 5-sinf uchun sodda tilda, 11-sinf uchun chuqurroq.
· Asosiy nuqtalar doskaga yozsa bo'ladigan darajada qisqa bo'lsin.
· Sinfda qo'llash g'oyalari HAQIQIY sinf sharoitiga mos bo'lsin: maxsus
  jihoz, internet yoki qimmat material talab qilmasin.
· Aniq bilmagan narsangni o'ylab topma. Ishonching komil bo'lmasa yoki
  manbalar farq qilsa — buni "caution" maydonida ayt.
· Faqat JSON qaytar, boshqa hech narsa yozma.`,

  RU: `Ты методист-помощник для школьных учителей Узбекистана.

Твоя задача — ответить на вопрос учителя так, чтобы он мог ПОДГОТОВИТЬСЯ К УРОКУ.

Правила:
· Ответ должен быть конкретным и практичным. Общие фразы («это важная тема») не нужны.
· Подстраивайся под класс: для 5 класса — простым языком, для 11 — глубже.
· Ключевые пункты должны быть настолько краткими, чтобы их можно было записать на доске.
· Идеи для урока должны подходить реальному классу: без специального
  оборудования, интернета и дорогих материалов.
· Не выдумывай то, чего не знаешь точно. Если не уверен или источники
  расходятся — скажи об этом в поле "caution".
· Верни только JSON, ничего больше.`,

  EN: `You are a methodology assistant for school teachers in Uzbekistan.

Your task is to answer the teacher's question so they can PREPARE FOR A LESSON.

Rules:
· Be concrete and practical. Skip generic statements ("this is an important topic").
· Match the grade level: simple language for grade 5, deeper for grade 11.
· Key points must be short enough to write on a blackboard.
· Classroom ideas must fit a real classroom: no special equipment, no
  internet, no expensive materials.
· Do not invent what you do not know. If you are unsure or sources differ,
  say so in the "caution" field.
· Return JSON only, nothing else.`,
};

const SHAPE: Record<LanguageCode, string> = {
  UZ: `Javob shakli (JSON):
{
  "answer": "2-5 jumlalik to'g'ridan-to'g'ri javob",
  "keyPoints": ["asosiy nuqta", "..."],            // 3-7 ta, qisqa
  "classroomIdeas": ["sinfda qanday ishlatish", "..."], // 2-5 ta, amaliy
  "caution": "ehtiyot bo'lish kerak bo'lgan joy"   // ixtiyoriy, kerak bo'lmasa tashlab ket
}`,
  RU: `Формат ответа (JSON):
{
  "answer": "прямой ответ на 2-5 предложений",
  "keyPoints": ["ключевой пункт", "..."],               // 3-7 штук, кратко
  "classroomIdeas": ["как применить на уроке", "..."],  // 2-5 штук, практично
  "caution": "на что обратить внимание"                 // необязательно, можно не указывать
}`,
  EN: `Response shape (JSON):
{
  "answer": "a direct answer, 2-5 sentences",
  "keyPoints": ["key point", "..."],                 // 3-7 items, short
  "classroomIdeas": ["how to use it in class", "..."], // 2-5 items, practical
  "caution": "what to watch out for"                 // optional, omit if not needed
}`,
};

const CONTEXT_LABELS: Record<
  LanguageCode,
  { subject: string; grade: string; question: string }
> = {
  UZ: { subject: "Fan", grade: "Sinf", question: "O'qituvchining savoli" },
  RU: { subject: "Предмет", grade: "Класс", question: "Вопрос учителя" },
  EN: { subject: "Subject", grade: "Grade", question: "Teacher's question" },
};

export function buildSearchSystemPrompt(language: LanguageCode): string {
  return SYSTEM[language];
}

export function buildSearchUserPrompt(input: SearchInput): string {
  const labels = CONTEXT_LABELS[input.language];
  const lines: string[] = [];

  // Kontekst savoldan OLDIN: model avval kimga javob berayotganini bilsin.
  if (input.subject !== undefined) lines.push(`${labels.subject}: ${input.subject}`);
  if (input.grade !== undefined) lines.push(`${labels.grade}: ${input.grade}`);

  lines.push(`${labels.question}: ${input.question}`);
  lines.push("", SHAPE[input.language]);

  return lines.join("\n");
}
