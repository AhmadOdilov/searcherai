import type { LanguageCode } from "@/lib/validations/common";
import type { SearchInput } from "@/lib/validations/search";
import type { QueryUnderstanding } from "./understanding";
import type { RankedCurriculumMatch } from "./curriculum-matcher";

/**
 * AI qidiruv promptlari.
 *
 * O'quv dasturi, sinf/fan konteksti, auditoriya (o'qituvchi/o'quvchi) va intentga moslangan.
 */

const SYSTEM: Record<LanguageCode, string> = {
  UZ: `Sen O'zbekiston maktab ta'lim tizimi va Davlat ta'lim standartlari (DTS) bo'yicha ekspert-metodist yordamchisisan.

Sening vazifang — foydalanuvchining (o'qituvchi yoki o'quvchi) savoliga DARS VA O'QITISHGA TAYYORLANISH uchun chuqur, aniq va ilmiy asoslangan javob berish.

Qoidalar:
· Javob aniq, to'g'ri va amaliy bo'lsin. Quruq umumiy gaplar ("bu juda muhim") kerak emas.
· Sinf darajasiga qat'iy mosla: boshlang'ich sinf uchun sodda tushunarli, yuqori sinflar uchun chuqur ilmiy asoslangan.
· Asosiy nuqtalar doskaga yozsa yoki daftarga qayd etsa bo'ladigan darajada qisqa, mustahkam bo'lsin.
· Sinfda qo'llash g'oyalari HAQIQIY sinf sharoitiga mos, amaliy va interaktiv bo'lsin: ortiqcha xarajat yoki murakkab jihoz talab qilmasin.
· Berilgan RASMIY O'QUV DASTURI ma'lumotlariga qat'iy tayangan holda javob ber. Dasturdagi atamalar va bo'limlarni hisobga ol.
· Aniq bilmagan narsangni o'ylab topma. Ishonching komil bo'lmasa yoki dasturda farq bo'lsa — buni "caution" maydonida ayt.
· Faqat JSON qaytar, boshqa hech narsa yozma.`,

  RU: `Ты эксперт-методист по школьной системе образования Узбекистана и государственным образовательным стандартам.

Твоя задача — ответить на вопрос пользователя (учителя или ученика) для ПОДГОТОВКИ К УРОКУ и качественного обучения.

Правила:
· Ответ должен быть конкретным, научно выверенным и практичным. Без лишней "воды".
· Строго подстраивайся под класс: для начальных классов — простым и наглядным языком, для старших — глубоко и научно.
· Ключевые пункты должны быть настолько краткими и ёмкими, чтобы их можно было записать на доске или в тетрадь.
· Идеи для урока должны подходить реальному классу: без специального оборудования, интернета и лишних затрат.
· Строго опирайся на предоставленные данные ОФИЦИАЛЬНОЙ УЧЕБНОЙ ПРОГРАММЫ Узбекистана.
· Не выдумывай то, чего не знаешь точно. Если не уверен или источники расходятся — укажи в поле "caution".
· Верни только JSON, ничего больше.`,

  EN: `You are an expert methodology assistant for school teachers in Uzbekistan, specialized in the national curriculum standards.

Your task is to answer the teacher's question to PREPARE FOR A LESSON and facilitate effective teaching and learning.

Rules:
· Be concrete, accurate, and practical. Skip generic fluff.
· Match the grade level strictly: simple and intuitive for lower grades, rigorous and deep for upper grades.
· Key points must be concise and memorable, suitable for blackboard notes.
· Classroom ideas must fit real classroom environments: feasible without expensive equipment or reliance on internet.
· Strictly ground your response in the provided OFFICIAL CURRICULUM data from Uzbekistan.
· Do not hallucinate. If unsure or if topic is outside standard syllabus, specify in the "caution" field.
· Return JSON only, nothing else.`,
};

const SHAPE: Record<LanguageCode, string> = {
  UZ: `Javob shakli (JSON):
{
  "answer": "2-5 jumlalik to'g'ridan-to'g'ri, ilmiy asoslangan javob",
  "keyPoints": ["asosiy nuqta", "..."],            // 3-7 ta, qisqa
  "classroomIdeas": ["sinfda qanday ishlatish", "..."], // 2-5 ta, amaliy
  "caution": "ehtiyot bo'lish kerak bo'lgan joy"   // ixtiyoriy, kerak bo'lmasa tashlab ket
}`,
  RU: `Формат ответа (JSON):
{
  "answer": "прямой, научно выверенный ответ на 2-5 предложений",
  "keyPoints": ["ключевой пункт", "..."],               // 3-7 штук, кратко
  "classroomIdeas": ["как применить на уроке", "..."],  // 2-5 штук, практично
  "caution": "на что обратить внимание"                 // необязательно, можно не указывать
}`,
  EN: `Response shape (JSON):
{
  "answer": "a direct, grounded answer in 2-5 sentences",
  "keyPoints": ["key point", "..."],                 // 3-7 items, short
  "classroomIdeas": ["how to use it in class", "..."], // 2-5 items, practical
  "caution": "what to watch out for"                 // optional, omit if not needed
}`,
};

const CONTEXT_LABELS: Record<
  LanguageCode,
  {
    subject: string;
    grade: string;
    question: string;
    audience: string;
    intent: string;
    curriculumHeader: string;
  }
> = {
  UZ: {
    subject: "Fan",
    grade: "Sinf",
    question: "Foydalanuvchi savoli",
    audience: "Auditoriya",
    intent: "Maqsad (Intent)",
    curriculumHeader: "RASMIY O'QUV DASTURIDAN MA'LUMOTLAR:",
  },
  RU: {
    subject: "Предмет",
    grade: "Класс",
    question: "Вопрос пользователя",
    audience: "Аудитория",
    intent: "Цель (Intent)",
    curriculumHeader: "ДАННЫЕ ИЗ ОФИЦИАЛЬНОЙ УЧЕБНОЙ ПРОГРАММЫ:",
  },
  EN: {
    subject: "Subject",
    grade: "Grade",
    question: "User's question",
    audience: "Audience",
    intent: "Intent",
    curriculumHeader: "DATA FROM OFFICIAL CURRICULUM:",
  },
};

export function buildSearchSystemPrompt(language: LanguageCode): string {
  return SYSTEM[language];
}

export function buildSearchUserPrompt(
  input: SearchInput,
  understanding?: QueryUnderstanding,
  curriculumTopics?: RankedCurriculumMatch[],
): string {
  const labels = CONTEXT_LABELS[input.language];
  const lines: string[] = [];

  const effectiveSubject = input.subject ?? understanding?.detectedSubject;
  const effectiveGrade = input.grade ?? understanding?.detectedGrade;

  if (effectiveSubject !== undefined) lines.push(`${labels.subject}: ${effectiveSubject}`);
  if (effectiveGrade !== undefined) {
    lines.push(`${labels.grade}: ${effectiveGrade}`);
    const gradeNum = parseInt(effectiveGrade.replace(/\D/g, ""), 10);
    if (!isNaN(gradeNum)) {
      if (gradeNum <= 6) {
        lines.push("Uslubiy yo'riqnoma: Kichik sinf darajasi (5-6 sinf) — tushuntirish sodda, ko'rgazmali, hayotiy misollar bilan berilsin.");
      } else if (gradeNum >= 9) {
        lines.push("Uslubiy yo'riqnoma: Yuqori sinf darajasi (9-11 sinf) — chuqur ilmiy, nazariy asoslangan, atamalar va formulalar bilan to'liq berilsin.");
      }
    }
  }

  if (understanding) {
    const isStudent = understanding.audience === "student";
    lines.push(
      `${labels.audience}: ${isStudent ? "O'quvchi (Student — sodda, bosqichma-bosqich yo'l-yo'riq)" : "O'qituvchi (Teacher — metodik, dars rejasi va baholashga yo'naltirilgan)"}`,
    );
    lines.push(`${labels.intent}: ${understanding.detectedIntent}`);
  }

  // Rasmiy o'quv dasturi kontekstini kiritish (Grounding Context)
  if (curriculumTopics && curriculumTopics.length > 0) {
    lines.push("", labels.curriculumHeader);
    for (const topic of curriculumTopics.slice(0, 2)) {
      lines.push(`- Bo'lim: ${topic.topicName}`);
      if (topic.expectedHours) lines.push(`  Ajratilgan soat: ${topic.expectedHours}`);
      if (topic.description) {
        lines.push(`  Mavzular mazmuni: ${topic.description.slice(0, 300)}`);
      }
      if (topic.expectedOutcomes.length > 0) {
        lines.push(`  Kutilayotgan natijalar: ${topic.expectedOutcomes.slice(0, 2).join("; ")}`);
      }
    }
    lines.push("");
  }

  lines.push(`${labels.question}: ${input.question}`);
  lines.push("", SHAPE[input.language]);

  return lines.join("\n");
}
