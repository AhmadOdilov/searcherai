import type { LanguageCode, LessonTypeCode } from "@/lib/validations/common";
import type { LessonPlanInput } from "@/lib/validations/lesson-plan";

/**
 * Dars ishlanmasi uchun AI promptlari.
 *
 * ── Nega promptlar to'liq tarjima qilingan ────────────────────────────────
 * "Javobni rus tilida ber" deb o'zbekcha promptga qo'shish yetarli emas:
 * model ko'pincha ko'rsatmani qisman bajaradi — sarlavhalarni tarjima qilib,
 * matnni prompt tilida qoldiradi. Prompt butunlay maqsad tilida bo'lsa,
 * javob ham tabiiy ravishda o'sha tilda chiqadi.
 *
 * Shuning uchun har bir til uchun to'liq matn bor — qisqartirish yo'q.
 */

/** Dars turining har bir tildagi nomi va metodik ma'nosi. */
const LESSON_TYPES: Record<
  LanguageCode,
  Record<LessonTypeCode, { name: string; guidance: string }>
> = {
  UZ: {
    NEW_TOPIC: {
      name: "yangi mavzu bayoni",
      guidance:
        "Yangi tushunchani bosqichma-bosqich tanishtir: avval oldingi bilimga bog'la, keyin yangi materialni tushuntir, misollar bilan mustahkamla.",
    },
    REINFORCEMENT: {
      name: "mustahkamlash",
      guidance:
        "Yangi material bermaslikka harakat qil. Asosiy vaqt mashqlar, amaliy topshiriqlar va o'quvchilarning mustaqil ishlashiga ajratilsin.",
    },
    ASSESSMENT: {
      name: "nazorat / baholash",
      guidance:
        "Darsning asosiy qismi baholash topshiriqlaridan iborat bo'lsin. Baholash mezonlarini albatta batafsil ko'rsat.",
    },
  },
  RU: {
    NEW_TOPIC: {
      name: "изложение новой темы",
      guidance:
        "Вводите новое понятие пошагово: сначала свяжите с ранее изученным, затем объясните новый материал, закрепите примерами.",
    },
    REINFORCEMENT: {
      name: "закрепление",
      guidance:
        "Не давайте новый материал. Основное время отведите упражнениям, практическим заданиям и самостоятельной работе учеников.",
    },
    ASSESSMENT: {
      name: "контроль / оценивание",
      guidance:
        "Основная часть урока должна состоять из проверочных заданий. Обязательно подробно укажите критерии оценивания.",
    },
  },
  EN: {
    NEW_TOPIC: {
      name: "new topic presentation",
      guidance:
        "Introduce the new concept step by step: first connect it to prior knowledge, then explain the new material, then consolidate with examples.",
    },
    REINFORCEMENT: {
      name: "reinforcement",
      guidance:
        "Avoid introducing new material. Devote most of the time to exercises, practical tasks and independent student work.",
    },
    ASSESSMENT: {
      name: "assessment",
      guidance:
        "The main part of the lesson should consist of assessment tasks. Always describe the assessment criteria in detail.",
    },
  },
};

/**
 * Har bir til uchun tizim (system) prompti.
 *
 * JSON MAYDON NOMLARI hamma tilda BIR XIL (inglizcha) — ular zod sxemasining
 * kalitlari, tarjima qilinsa sxema mos kelmaydi. Tarjima qilinadigan narsa —
 * maydonlarning TAVSIFI va natija MATNI.
 */
const SYSTEM_PROMPTS: Record<LanguageCode, string> = {
  UZ: `Siz tajribali metodist-o'qituvchisiz. 20 yildan ortiq umumta'lim maktabida ishlagansiz va o'qituvchilar uchun dars ishlanmalari tuzasiz.

Vazifangiz — berilgan parametrlar bo'yicha AMALDA ISHLATISHGA TAYYOR dars ishlanmasini tuzish.

Sifat talablari:
- Maqsad aniq va o'lchanadigan bo'lsin, umumiy gaplar ("bilimini oshirish") EMAS.
- Kutilayotgan natijalar "o'quvchi ... qila oladi" ko'rinishida yozilsin.
- Har bir bosqich uchun o'qituvchi VA o'quvchi nima qilishini alohida yoz.
- Resurslar real bo'lsin: doska, tarqatma material, proyektor kabi maktabda mavjud narsalar.
- Matn o'zbek tilida, lotin alifbosida bo'lsin.

Javobni FAQAT quyidagi JSON obyekt ko'rinishida qaytaring (maydon nomlari AYNAN shunday, o'zgartirilmaydi):

{
  "objective": "O'quv maqsadi — bir-ikki gap",
  "outcomes": ["Kutilayotgan natija 1", "Kutilayotgan natija 2"],
  "resources": ["Kerakli material 1", "Kerakli material 2"],
  "stages": [
    {
      "name": "Bosqich nomi (masalan: Kirish, Asosiy qism, Mustahkamlash, Uyga vazifa)",
      "durationMinutes": 5,
      "description": "Bosqichda nima bo'ladi",
      "teacherActivity": "O'qituvchi nima qiladi",
      "studentActivity": "O'quvchilar nima qiladi"
    }
  ],
  "assessmentCriteria": ["Baholash mezoni 1"]
}`,

  RU: `Вы опытный учитель-методист. Вы более 20 лет работали в общеобразовательной школе и составляете планы уроков для учителей.

Ваша задача — составить ГОТОВЫЙ К ПРИМЕНЕНИЮ план урока по заданным параметрам.

Требования к качеству:
- Цель должна быть конкретной и измеримой, а НЕ общими словами («повысить знания»).
- Ожидаемые результаты формулируйте в виде «ученик умеет ...».
- Для каждого этапа отдельно опишите, что делает учитель И что делают ученики.
- Ресурсы должны быть реальными: доска, раздаточный материал, проектор — то, что есть в школе.
- Текст должен быть на русском языке.

Верните ответ ТОЛЬКО в виде следующего JSON-объекта (названия полей ИМЕННО такие, их нельзя изменять):

{
  "objective": "Цель урока — одно-два предложения",
  "outcomes": ["Ожидаемый результат 1", "Ожидаемый результат 2"],
  "resources": ["Необходимый материал 1", "Необходимый материал 2"],
  "stages": [
    {
      "name": "Название этапа (например: Введение, Основная часть, Закрепление, Домашнее задание)",
      "durationMinutes": 5,
      "description": "Что происходит на этапе",
      "teacherActivity": "Что делает учитель",
      "studentActivity": "Что делают ученики"
    }
  ],
  "assessmentCriteria": ["Критерий оценивания 1"]
}`,

  EN: `You are an experienced teacher and methodologist. You have worked in secondary education for over 20 years and write lesson plans for teachers.

Your task is to produce a READY-TO-USE lesson plan for the given parameters.

Quality requirements:
- The objective must be specific and measurable, NOT vague ("improve knowledge").
- Write expected outcomes as "the student can ...".
- For every stage, describe separately what the teacher does AND what the students do.
- Resources must be realistic: board, handouts, projector — things a school actually has.
- Write the text in English.

Return your answer ONLY as the following JSON object (field names EXACTLY as shown, do not change them):

{
  "objective": "Learning objective — one or two sentences",
  "outcomes": ["Expected outcome 1", "Expected outcome 2"],
  "resources": ["Required material 1", "Required material 2"],
  "stages": [
    {
      "name": "Stage name (e.g. Introduction, Main part, Consolidation, Homework)",
      "durationMinutes": 5,
      "description": "What happens in this stage",
      "teacherActivity": "What the teacher does",
      "studentActivity": "What the students do"
    }
  ],
  "assessmentCriteria": ["Assessment criterion 1"]
}`,
};

/** Foydalanuvchi so'rovini tilga mos matn qilib yig'adi. */
const USER_PROMPT_BUILDERS: Record<
  LanguageCode,
  (input: LessonPlanInput, lessonType: { name: string; guidance: string }) => string
> = {
  UZ: (input, lessonType) => `Quyidagi dars uchun ishlanma tuz:

- Fan: ${input.subject}
- Sinf/daraja: ${input.grade}
- Mavzu: ${input.topic}
- Dars davomiyligi: ${input.durationMinutes} daqiqa
- Dars turi: ${lessonType.name}

Dars turi bo'yicha ko'rsatma: ${lessonType.guidance}

MUHIM: barcha bosqichlarning "durationMinutes" qiymatlari yig'indisi ANIQ ${input.durationMinutes} ga teng bo'lishi shart. Bosqichlarni yozib bo'lgach, yig'indini hisoblab tekshir; agar mos kelmasa, qiymatlarni to'g'rila.

Mavzu ${input.grade} o'quvchilari darajasiga mos bo'lsin — juda soddalashtirib ham, ortiqcha murakkablashtirib ham yubormang.`,

  RU: (input, lessonType) => `Составьте план для следующего урока:

- Предмет: ${input.subject}
- Класс/уровень: ${input.grade}
- Тема: ${input.topic}
- Длительность урока: ${input.durationMinutes} минут
- Тип урока: ${lessonType.name}

Указание по типу урока: ${lessonType.guidance}

ВАЖНО: сумма значений "durationMinutes" всех этапов должна быть РОВНО ${input.durationMinutes}. Закончив описание этапов, посчитайте сумму и проверьте; если не совпадает — исправьте значения.

Материал должен соответствовать уровню учеников ${input.grade} — не упрощайте и не усложняйте чрезмерно.`,

  EN: (input, lessonType) => `Write a lesson plan for the following lesson:

- Subject: ${input.subject}
- Grade/level: ${input.grade}
- Topic: ${input.topic}
- Lesson duration: ${input.durationMinutes} minutes
- Lesson type: ${lessonType.name}

Guidance for this lesson type: ${lessonType.guidance}

IMPORTANT: the sum of all stages' "durationMinutes" values must be EXACTLY ${input.durationMinutes}. After writing the stages, add up the values and check; if the total does not match, correct them.

The material must match the level of ${input.grade} students — neither oversimplified nor overly complex.`,
};

export function buildSystemPrompt(language: LanguageCode): string {
  return SYSTEM_PROMPTS[language];
}

/**
 * Tashqi manba bo'limining sarlavhasi — har bir tilda.
 *
 * ── Nega bu bo'lim promptning OXIRIDA ────────────────────────────────────
 * Modellar uzun promptning oxiridagi ko'rsatmaga kuchliroq amal qiladi.
 * Manba matnini boshiga qo'ysak, undan keyingi umumiy ko'rsatmalar uni
 * "bosib ketardi" va natija odatdagidan farq qilmasdi.
 */
const SOURCE_LABELS: Record<LanguageCode, string> = {
  UZ: `MANBA MATERIALI (o'qituvchi yuklagan darslik sahifasi / chizmadan o'qilgan):

Ishlanmani AYNAN shu material atrofida qur: undagi ta'rif, qoida va misollardan foydalan. Materialda yo'q narsani qo'shsang, uni "qo'shimcha" sifatida ajratib ko'rsat.`,
  RU: `ИСХОДНЫЙ МАТЕРИАЛ (прочитан со страницы учебника или схемы, загруженной учителем):

Постройте план ИМЕННО вокруг этого материала: используйте приведённые в нём определения, правила и примеры. Если добавляете то, чего в материале нет, обозначьте это как дополнение.`,
  EN: `SOURCE MATERIAL (read from a textbook page or diagram uploaded by the teacher):

Build the plan around THIS material: use its definitions, rules and examples. If you add anything not present in the material, mark it as supplementary.`,
};

/**
 * Rasmiy o'quv dasturi bo'limining sarlavhasi — har bir tilda.
 *
 * ── Nega "rasmiy" so'zi muhim ────────────────────────────────────────────
 * Modelga bu matn ODDIY kontekst emas, DAVLAT HUJJATI ekanini aytish
 * kerak. Aks holda u o'z bilimini ustun qo'yib, dasturdagi mavzu
 * nomlarini "yaxshilab" o'zgartirib yuboradi — o'qituvchi esa
 * maktabga topshiradigan ishlanmada dastur bilan mos nom kutadi.
 */
const CURRICULUM_LABELS: Record<LanguageCode, string> = {
  UZ: `RASMIY O'QUV DASTURI MA'LUMOTI (O'zbekiston Respublikasi umumiy o'rta ta'lim dasturidan):

Ishlanmani shu ma'lumotga MOSLA: bo'lim nomlari va atamalarni dasturdagidek ishlat, kutilayotgan natijalarni hisobga ol. Dasturda ko'rsatilgan soat — butun BO'LIM uchun, bitta dars uchun emas.`,
  RU: `ДАННЫЕ ОФИЦИАЛЬНОЙ УЧЕБНОЙ ПРОГРАММЫ (из программы общего среднего образования Республики Узбекистан):

Приведите план в СООТВЕТСТВИЕ с этими данными: используйте названия разделов и термины как в программе, учитывайте ожидаемые результаты. Указанные часы относятся ко всему РАЗДЕЛУ, а не к одному уроку.`,
  EN: `OFFICIAL CURRICULUM DATA (from the general secondary education programme of the Republic of Uzbekistan):

Align the plan with this data: use the section names and terms as given, and take the expected outcomes into account. The hours shown are for the whole SECTION, not for a single lesson.`,
};

/** Topilgan dastur bo'limlarini promptga tushadigan matnga aylantiradi. */
export function formatCurriculumContext(
  language: LanguageCode,
  topics: Array<{
    topicName: string;
    description: string;
    expectedHours: number | null;
    expectedOutcomes: string[];
  }>,
): string {
  if (topics.length === 0) return "";

  const blocks = topics.map((topic) => {
    const lines = [`- ${topic.topicName}`];
    if (topic.expectedHours !== null) lines.push(`  soat: ${topic.expectedHours}`);

    /*
      ── Tavsif QISQARTIRILADI ──────────────────────────────────────────
      Haqiqiy o'lchovda ochildi: dastur bo'limining to'liq matni ~1400
      belgi, uchtasi bilan prompt 4000 belgiga o'sdi va model javobi
      SXEMADAN O'TMAY qoldi (`stages.4: expected object, received
      string`) — ya'ni yaxshilash o'rniga generatsiyani yiqitdi.

      500 belgi bo'lim mavzularini sanab o'tishga yetadi; qolgani
      takrorlash va nazorat ishlari haqida bo'lib, dars ishlanmasiga
      hech narsa qo'shmaydi.
    */
    if (topic.description !== "") {
      const summary =
        topic.description.length > 500
          ? `${topic.description.slice(0, 500)}…`
          : topic.description;
      lines.push(`  mazmuni: ${summary}`);
    }

    if (topic.expectedOutcomes.length > 0) {
      // Natijalar butun hujjat uchun umumiy va har bir bo'limda
      // takrorlanadi — faqat birinchi uchtasi olinadi.
      lines.push(
        `  kutilayotgan natijalar: ${topic.expectedOutcomes.slice(0, 3).join("; ")}`,
      );
    }
    return lines.join("\n");
  });

  return `${CURRICULUM_LABELS[language]}\n\n${blocks.join("\n\n")}`;
}

export function buildUserPrompt(input: LessonPlanInput): string {
  const lessonType = LESSON_TYPES[input.language][input.lessonType];
  const base = USER_PROMPT_BUILDERS[input.language](input, lessonType);

  const parts = [base];

  /*
    Tartib MUHIM: rasmiy dastur avval, rasm matni keyin.

    Modellar promptning oxiridagi ko'rsatmaga kuchliroq amal qiladi.
    O'qituvchi rasm yuklagan bo'lsa — u AYNAN shu darsni tayyorlamoqchi,
    ya'ni rasm mazmuni dasturning umumiy ro'yxatidan ustun turishi kerak.
  */
  if (input.curriculumContext !== undefined && input.curriculumContext !== "") {
    parts.push(input.curriculumContext);
  }

  if (input.sourceMaterial !== undefined && input.sourceMaterial !== "") {
    parts.push(`${SOURCE_LABELS[input.language]}\n\n${input.sourceMaterial}`);
  }

  return parts.join("\n\n");
}

/** Dars turining foydalanuvchiga ko'rsatiladigan nomi. */
export function lessonTypeName(
  language: LanguageCode,
  lessonType: LessonTypeCode,
): string {
  return LESSON_TYPES[language][lessonType].name;
}
