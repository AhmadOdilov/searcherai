import type { LanguageCode } from "@/lib/validations/common";
import type { LessonPlanContent } from "@/lib/validations/lesson-plan";

/**
 * Prezentatsiya slaydlari uchun AI promptlari.
 *
 * Dars ishlanmasi modulidagi kabi promptlar TO'LIQ tarjima qilingan —
 * sabab o'sha: qisman ko'rsatma modelni aralash tilda javob berishga
 * olib keladi.
 */

/** Prezentatsiya uchun kirish konteksti — ikki rejim uchun umumiy shakl. */
export interface PresentationPromptContext {
  topic: string;
  subject?: string;
  grade?: string;
  language: LanguageCode;
  /**
   * Dars ishlanmasidan kelgan kontekst. Berilsa slaydlar AYNAN shu darsga
   * mos tuziladi, aks holda AI mavzuni o'zi ochib beradi.
   */
  lessonPlan?: LessonPlanContent;
}

/**
 * MAZMUN BOSQICHINING SYSTEM PROMPTI.
 *
 * ── Nega u qayta yozildi ──────────────────────────────────────────────────
 * Bu prompt Phase 1 dan qolgan edi va V6 blok shartnomasini UMUMAN
 * bilmasdi: unda `cards`, `steps`, `comparison`, `statistic`, `chart`,
 * `quote` va `keyMessage` so'zlari yo'q edi. U modelga "har slaydda 3-5
 * band yoz" deb buyurar va faqat `type/heading/bullets/speakerNotes`
 * bo'lgan JSON namunasini ko'rsatardi.
 *
 * Ayni paytda `stage-prompts.ts` har bir slayd uchun "mazmun shakli:
 * cards → cards: [...]" va "bullets: []" deb topshiriq berardi. Ya'ni
 * ikki prompt bir-biriga ZID edi va model odatda system promptga
 * ergashib, kartalar o'rniga bandlar qaytarardi.
 *
 * ── Slaydlar soni bu yerda AYTILMAYDI ─────────────────────────────────────
 * Ilgari prompt "5 dan 15 gacha slayd" derdi. Son esa brifda hal
 * qilinadi va sxema (`contentSchemaFor`) AYNAN rejadagi sonni talab
 * qiladi — oraliq aytish yana bitta ziddiyat edi. Endi son, tartib va
 * sarlavhalar faqat foydalanuvchi promptidan (rejadan) keladi.
 */
const SYSTEM_PROMPTS: Record<LanguageCode, string> = {
  UZ: `Siz tajribali o'qituvchi va prezentatsiya matni muallifisiz. Prezentatsiya REJASI allaqachon tayyor — siz faqat slaydlar MATNINI yozasiz.

Rejani o'zgartirmaysiz: slaydlar soni, tartibi, sarlavhalari va har bir slaydning mazmun shakli sizga beriladi.

Slayd — konspekt emas, EKRAN:
- Matn QISQA bo'lsin: har bir band 1-2 qator, ideal holda 10-15 so'z.
- Bandlar to'liq gap bo'lishi shart emas — asosiy fikr yetarli.
- O'qituvchi og'zaki aytadigan tafsilotlarni "speakerNotes" ga yozing, slaydga emas.
- Har bir slayd uchun berilgan belgi chegaralaridan oshmang.

── MAZMUN SHAKLLARI ──

Har bir slayd uchun rejada BITTA mazmun shakli ko'rsatiladi. FAQAT o'sha shaklga tegishli maydonni to'ldiring, qolgan maydonlarni umuman yozmang:

- statement  → "keyMessage" (bitta kuchli jumla)
- bullets    → "bullets": ["...", "..."]
- cards      → "cards": [{ "title": "...", "body": "..." }]
- steps      → "steps": [{ "label": "...", "body": "..." }]
- comparison → "comparison": { "leftTitle": "...", "leftItems": ["..."], "rightTitle": "...", "rightItems": ["..."] }
- statistic  → "statistic": { "value": "...", "caption": "..." }
- chart      → "chart": { "kind": "bar", "categories": ["..."], "series": [{ "name": "...", "values": [1, 2] }] }
- quote      → "quote": { "text": "...", "author": "..." }

Qoidalar:
- "bullets" maydoni HAR DOIM bo'ladi. Mazmun shakli "bullets" bo'lmasa — bo'sh massiv: []
- Yuqoridagi ro'yxatda YO'Q maydon nomini O'YLAB TOPMANG.
- "type" va "heading" rejadagidek qoladi.
- "keyMessage" — slaydning yagona asosiy fikri; istalgan shaklda foydali.
- "eyebrow" — ixtiyoriy qisqa yorliq ("MUAMMO", "BOZOR").
- "source" — faqat HAQIQIY manba bo'lganda.
- Maydon nomlari HAR DOIM inglizcha. Matn esa o'zbek tilida, lotin alifbosida.

Javobni FAQAT quyidagi JSON obyekt ko'rinishida qaytaring (maydon nomlari AYNAN shunday):

{
  "title": "Prezentatsiya sarlavhasi",
  "slides": [
    {
      "type": "title",
      "heading": "Dars mavzusi",
      "bullets": [],
      "keyMessage": "Prezentatsiyaning va'dasi bitta jumlada"
    },
    {
      "type": "content",
      "heading": "Slayd sarlavhasi",
      "bullets": ["Qisqa band", "Yana bir qisqa band"],
      "speakerNotes": "Bu slaydda nima gapirish kerak"
    },
    {
      "type": "content",
      "heading": "Uchta tushuncha",
      "bullets": [],
      "cards": [{ "title": "Birinchi", "body": "Qisqa tavsif" }]
    },
    {
      "type": "summary",
      "heading": "Xulosa",
      "bullets": ["Yodda qoladigan asosiy fikr"]
    }
  ]
}`,

  RU: `Вы опытный учитель и автор текста презентаций. ПЛАН презентации уже готов — вы пишете только ТЕКСТ слайдов.

План вы не меняете: количество слайдов, их порядок, заголовки и форма содержания каждого слайда даются вам.

Слайд — это не конспект, а ЭКРАН:
- Текст должен быть КОРОТКИМ: каждый пункт 1-2 строки, идеально 10-15 слов.
- Пункты не обязаны быть полными предложениями — достаточно основной мысли.
- Подробности, которые учитель произносит вслух, пишите в "speakerNotes", а не на слайд.
- Не превышайте ограничения по символам, заданные для каждого слайда.

── ФОРМЫ СОДЕРЖАНИЯ ──

Для каждого слайда в плане указана ОДНА форма содержания. Заполняйте ТОЛЬКО поле этой формы, остальные поля не пишите вовсе:

- statement  → "keyMessage" (одно сильное предложение)
- bullets    → "bullets": ["...", "..."]
- cards      → "cards": [{ "title": "...", "body": "..." }]
- steps      → "steps": [{ "label": "...", "body": "..." }]
- comparison → "comparison": { "leftTitle": "...", "leftItems": ["..."], "rightTitle": "...", "rightItems": ["..."] }
- statistic  → "statistic": { "value": "...", "caption": "..." }
- chart      → "chart": { "kind": "bar", "categories": ["..."], "series": [{ "name": "...", "values": [1, 2] }] }
- quote      → "quote": { "text": "...", "author": "..." }

Правила:
- Поле "bullets" присутствует ВСЕГДА. Если форма содержания не "bullets" — пустой массив: []
- НЕ ВЫДУМЫВАЙТЕ названия полей, которых нет в списке выше.
- "type" и "heading" остаются такими, как в плане.
- "keyMessage" — единственная главная мысль слайда; полезна при любой форме.
- "eyebrow" — необязательная короткая метка ("ПРОБЛЕМА", "РЫНОК").
- "source" — только при НАСТОЯЩЕМ источнике.
- Названия полей ВСЕГДА на английском. Текст — на русском языке.

Верните ответ ТОЛЬКО в виде следующего JSON-объекта (названия полей ИМЕННО такие):

{
  "title": "Название презентации",
  "slides": [
    {
      "type": "title",
      "heading": "Тема урока",
      "bullets": [],
      "keyMessage": "Обещание презентации в одном предложении"
    },
    {
      "type": "content",
      "heading": "Заголовок слайда",
      "bullets": ["Короткий пункт", "Ещё один короткий пункт"],
      "speakerNotes": "Что говорить на этом слайде"
    },
    {
      "type": "content",
      "heading": "Три понятия",
      "bullets": [],
      "cards": [{ "title": "Первое", "body": "Краткое описание" }]
    },
    {
      "type": "summary",
      "heading": "Итоги",
      "bullets": ["Главная мысль, которую стоит запомнить"]
    }
  ]
}`,

  EN: `You are an experienced teacher and presentation copywriter. The PLAN of the presentation is already fixed — you only write the slide COPY.

You do not change the plan: the number of slides, their order, their headings and each slide's content shape are given to you.

A slide is not a handout, it is a SCREEN:
- Keep the text SHORT: every bullet 1-2 lines, ideally 10-15 words.
- Bullets do not have to be complete sentences — the key idea is enough.
- Put the details the teacher says out loud in "speakerNotes", not on the slide.
- Never exceed the character limits given for each slide.

── CONTENT SHAPES ──

The plan names exactly ONE content shape per slide. Fill ONLY that shape's field and do not write the other fields at all:

- statement  → "keyMessage" (one strong sentence)
- bullets    → "bullets": ["...", "..."]
- cards      → "cards": [{ "title": "...", "body": "..." }]
- steps      → "steps": [{ "label": "...", "body": "..." }]
- comparison → "comparison": { "leftTitle": "...", "leftItems": ["..."], "rightTitle": "...", "rightItems": ["..."] }
- statistic  → "statistic": { "value": "...", "caption": "..." }
- chart      → "chart": { "kind": "bar", "categories": ["..."], "series": [{ "name": "...", "values": [1, 2] }] }
- quote      → "quote": { "text": "...", "author": "..." }

Rules:
- The "bullets" field is ALWAYS present. When the content shape is not "bullets", use an empty array: []
- Do NOT invent field names that are not in the list above.
- "type" and "heading" stay exactly as the plan gives them.
- "keyMessage" is the slide's single key idea; it is useful with any shape.
- "eyebrow" is an optional short label ("PROBLEM", "MARKET").
- "source" only when there is a REAL source.
- Field names are ALWAYS in English. The text itself is in English.

Return your answer ONLY as the following JSON object (field names EXACTLY as shown):

{
  "title": "Presentation title",
  "slides": [
    {
      "type": "title",
      "heading": "Lesson topic",
      "bullets": [],
      "keyMessage": "The promise of the deck in one sentence"
    },
    {
      "type": "content",
      "heading": "Slide heading",
      "bullets": ["Short bullet", "Another short bullet"],
      "speakerNotes": "What to say on this slide"
    },
    {
      "type": "content",
      "heading": "Three concepts",
      "bullets": [],
      "cards": [{ "title": "First", "body": "Short description" }]
    },
    {
      "type": "summary",
      "heading": "Summary",
      "bullets": ["The key takeaway"]
    }
  ]
}`,
};

/** Tilga qarab sarlavhalar — dars ishlanmasi kontekstini yozish uchun. */
const CONTEXT_LABELS: Record<
  LanguageCode,
  {
    intro: string;
    subject: string;
    grade: string;
    topic: string;
    planIntro: string;
    objective: string;
    outcomes: string;
    stages: string;
    stageNote: string;
    standaloneNote: string;
  }
> = {
  UZ: {
    intro: "Quyidagi dars uchun prezentatsiya slaydlarini tuz:",
    subject: "Fan",
    grade: "Sinf/daraja",
    topic: "Mavzu",
    planIntro:
      "Bu dars uchun ishlanma ALLAQACHON tuzilgan. Slaydlar AYNAN shu ishlanmaga mos bo'lishi kerak:",
    objective: "Dars maqsadi",
    outcomes: "Kutilayotgan natijalar",
    stages: "Dars bosqichlari",
    stageNote:
      "MUHIM: har bir dars bosqichi uchun taxminan bitta mazmun slaydi tuz — shunda o'qituvchi darsni slaydlar ketma-ketligi bo'yicha olib boradi. Bosqichning mazmunini slaydga sig'adigan qisqa bandlarga aylantir.",
    standaloneNote:
      "Mavzuni mustaqil ravishda mantiqiy ketma-ketlikda ochib ber: tushuncha → tushuntirish → misol → mashq → xulosa.",
  },
  RU: {
    intro: "Составьте слайды презентации для следующего урока:",
    subject: "Предмет",
    grade: "Класс/уровень",
    topic: "Тема",
    planIntro:
      "План этого урока УЖЕ составлен. Слайды должны соответствовать ИМЕННО этому плану:",
    objective: "Цель урока",
    outcomes: "Ожидаемые результаты",
    stages: "Этапы урока",
    stageNote:
      "ВАЖНО: составьте примерно по одному содержательному слайду на каждый этап урока — тогда учитель ведёт урок по последовательности слайдов. Содержание этапа превратите в короткие пункты, которые поместятся на слайд.",
    standaloneNote:
      "Раскройте тему самостоятельно в логической последовательности: понятие → объяснение → пример → упражнение → вывод.",
  },
  EN: {
    intro: "Create presentation slides for the following lesson:",
    subject: "Subject",
    grade: "Grade/level",
    topic: "Topic",
    planIntro:
      "A lesson plan for this lesson ALREADY exists. The slides must follow THIS plan:",
    objective: "Lesson objective",
    outcomes: "Expected outcomes",
    stages: "Lesson stages",
    stageNote:
      "IMPORTANT: create roughly one content slide per lesson stage — this way the teacher runs the lesson by moving through the slides. Turn each stage's content into short bullets that fit on a slide.",
    standaloneNote:
      "Develop the topic independently in a logical sequence: concept → explanation → example → practice → conclusion.",
  },
};

export function buildSystemPrompt(language: LanguageCode): string {
  return SYSTEM_PROMPTS[language];
}

/**
 * Foydalanuvchi promptini yig'adi.
 *
 * Dars ishlanmasi berilgan bo'lsa uning maqsadi, natijalari va BOSQICHLARI
 * promptga kiritiladi — shunda slaydlar dars oqimiga mos keladi va
 * o'qituvchi ikkisini birga ishlatadi.
 */
export function buildUserPrompt(context: PresentationPromptContext): string {
  const labels = CONTEXT_LABELS[context.language];
  const lines: string[] = [labels.intro, ""];

  if (context.subject !== undefined) {
    lines.push(`- ${labels.subject}: ${context.subject}`);
  }
  if (context.grade !== undefined) {
    lines.push(`- ${labels.grade}: ${context.grade}`);
  }
  lines.push(`- ${labels.topic}: ${context.topic}`);

  lines.push("", buildLessonContextBlock(context));

  return lines.join("\n");
}

/**
 * Dars ishlanmasi bo'limi — mavzu satrlarisiz.
 *
 * ── Nega alohida funksiya ─────────────────────────────────────────────────
 * Ko'p bosqichli generatsiyada bu blok IKKI martta kerak bo'ladi:
 * skelet bosqichida (slaydlar dars bosqichlariga mos tushishi uchun) va
 * mazmun bosqichida (matn darsning o'z tilidan chiqishi uchun). Ikkala
 * joyda ham mavzu/fan/sinf satrlari boshqacha yoziladi, shuning uchun
 * faqat MAZMUN qismi ajratildi.
 */
export function buildLessonContextBlock(context: PresentationPromptContext): string {
  const labels = CONTEXT_LABELS[context.language];

  if (!context.lessonPlan) return labels.standaloneNote;

  const plan = context.lessonPlan;
  const lines: string[] = [labels.planIntro, ""];

  lines.push(`${labels.objective}: ${plan.objective}`, "");
  lines.push(`${labels.outcomes}:`);
  for (const outcome of plan.outcomes) {
    lines.push(`- ${outcome}`);
  }
  lines.push("", `${labels.stages}:`);
  for (const [index, stage] of plan.stages.entries()) {
    lines.push(
      `${index + 1}. ${stage.name} (${stage.durationMinutes} min) — ${stage.description}`,
    );
  }
  lines.push("", labels.stageNote);

  return lines.join("\n");
}
