import type { LanguageCode } from "@/lib/validations/common";
import { MAX_SLIDES, MIN_SLIDES } from "@/lib/validations/presentation";
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

const SYSTEM_PROMPTS: Record<LanguageCode, string> = {
  UZ: `Siz tajribali o'qituvchi va prezentatsiya dizayneri sifatida ishlaysiz. Sizning vazifangiz — darsda PROYEKTORDA ko'rsatiladigan slaydlar tuzish.

Slayd — konspekt emas, EKRAN. Shuning uchun:
- Har bir band QISQA bo'lsin: 1-2 qator, ideal holda 10-15 so'z. Uzun gaplar slaydda o'qilmaydi.
- Bandlar to'liq gap bo'lishi shart emas — asosiy fikr yetarli.
- Har bir slaydda 3-5 band bo'lsin. 6 dan ortiq band slaydni to'ldirib yuboradi.
- O'qituvchi aytadigan batafsil gaplarni "speakerNotes" ga yozing, slaydga emas.

Slaydlar soni: ${MIN_SLIDES} dan ${MAX_SLIDES} gacha. Tuzilishi:
1. Bitta "title" turidagi sarlavha slaydi (birinchi bo'lishi shart)
2. ${MIN_SLIDES - 2} dan ${MAX_SLIDES - 2} gacha "content" turidagi mazmun slaydi
3. Bitta "summary" turidagi xulosa slaydi (oxirgi bo'lishi shart)

Matn o'zbek tilida, lotin alifbosida bo'lsin.

Javobni FAQAT quyidagi JSON obyekt ko'rinishida qaytaring (maydon nomlari AYNAN shunday):

{
  "title": "Prezentatsiya sarlavhasi",
  "slides": [
    {
      "type": "title",
      "heading": "Dars mavzusi",
      "bullets": ["Fan va sinf kabi qisqa ma'lumot"],
      "speakerNotes": "O'qituvchi uchun izoh (ixtiyoriy)"
    },
    {
      "type": "content",
      "heading": "Slayd sarlavhasi",
      "bullets": ["Qisqa band", "Yana bir qisqa band"],
      "speakerNotes": "Bu slaydda nima gapirish kerak"
    },
    {
      "type": "summary",
      "heading": "Xulosa",
      "bullets": ["Asosiy fikr"]
    }
  ]
}`,

  RU: `Вы работаете как опытный учитель и дизайнер презентаций. Ваша задача — составить слайды, которые будут показаны на ПРОЕКТОРЕ во время урока.

Слайд — это не конспект, а ЭКРАН. Поэтому:
- Каждый пункт должен быть КОРОТКИМ: 1-2 строки, идеально 10-15 слов. Длинные предложения на слайде не читаются.
- Пункты не обязаны быть полными предложениями — достаточно основной мысли.
- На каждом слайде 3-5 пунктов. Больше 6 пунктов перегружают слайд.
- Подробности, которые учитель произносит вслух, пишите в "speakerNotes", а не на слайд.

Количество слайдов: от ${MIN_SLIDES} до ${MAX_SLIDES}. Структура:
1. Один титульный слайд типа "title" (обязательно первый)
2. От ${MIN_SLIDES - 2} до ${MAX_SLIDES - 2} содержательных слайдов типа "content"
3. Один итоговый слайд типа "summary" (обязательно последний)

Текст должен быть на русском языке.

Верните ответ ТОЛЬКО в виде следующего JSON-объекта (названия полей ИМЕННО такие):

{
  "title": "Название презентации",
  "slides": [
    {
      "type": "title",
      "heading": "Тема урока",
      "bullets": ["Краткая информация: предмет и класс"],
      "speakerNotes": "Заметка для учителя (необязательно)"
    },
    {
      "type": "content",
      "heading": "Заголовок слайда",
      "bullets": ["Короткий пункт", "Ещё один короткий пункт"],
      "speakerNotes": "Что говорить на этом слайде"
    },
    {
      "type": "summary",
      "heading": "Итоги",
      "bullets": ["Главная мысль"]
    }
  ]
}`,

  EN: `You work as an experienced teacher and presentation designer. Your task is to create slides that will be shown on a PROJECTOR during a lesson.

A slide is not a handout, it is a SCREEN. Therefore:
- Every bullet must be SHORT: 1-2 lines, ideally 10-15 words. Long sentences are unreadable on a slide.
- Bullets do not have to be complete sentences — the key idea is enough.
- Use 3-5 bullets per slide. More than 6 bullets overloads the slide.
- Put the details the teacher says out loud in "speakerNotes", not on the slide.

Number of slides: between ${MIN_SLIDES} and ${MAX_SLIDES}. Structure:
1. One title slide of type "title" (must be first)
2. Between ${MIN_SLIDES - 2} and ${MAX_SLIDES - 2} content slides of type "content"
3. One closing slide of type "summary" (must be last)

Write the text in English.

Return your answer ONLY as the following JSON object (field names EXACTLY as shown):

{
  "title": "Presentation title",
  "slides": [
    {
      "type": "title",
      "heading": "Lesson topic",
      "bullets": ["Short info: subject and grade"],
      "speakerNotes": "Note for the teacher (optional)"
    },
    {
      "type": "content",
      "heading": "Slide heading",
      "bullets": ["Short bullet", "Another short bullet"],
      "speakerNotes": "What to say on this slide"
    },
    {
      "type": "summary",
      "heading": "Summary",
      "bullets": ["Key takeaway"]
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

  if (context.lessonPlan) {
    const plan = context.lessonPlan;
    lines.push("", labels.planIntro, "");
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
  } else {
    lines.push("", labels.standaloneNote);
  }

  return lines.join("\n");
}
