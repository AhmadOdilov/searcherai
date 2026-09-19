import type { LanguageCode } from "@/lib/validations/common";
import type { PresentationBrief } from "@/lib/presentations/brief";
import type { PlannedBeat } from "@/lib/presentations/storyline";
import type { SlideBlueprint } from "@/lib/presentations/slide-plan";
import { CONTENT_TYPES, type ContentType } from "@/lib/presentations/storyline";

/**
 * KO'P BOSQICHLI GENERATSIYA PROMPTLARI.
 *
 * Ikkita AI chaqiruvi bor va ularning vazifasi ATAYLAB ajratilgan:
 *
 *   1-chaqiruv (SKELET) — model butun prezentatsiyaning TUZILISHINI
 *      o'ylaydi: har bir slayd nima uchun bor va uning asosiy fikri
 *      nima. Matn yozmaydi.
 *
 *   2-chaqiruv (MAZMUN) — model tayyor rejani OLADI va faqat matn
 *      yozadi. Tuzilma haqida o'ylamaydi.
 *
 * ── Nega bitta chaqiruv yetarli emas edi ──────────────────────────────────
 * Bitta chaqiruvda model ikkala ishni birga qiladi va amalda tuzilma
 * yutqazadi: u birinchi slayddan boshlab matn yozishga kirishadi va
 * oxiriga borib hikoya yo'qligi ma'lum bo'ladi. Natijada "mavzu haqida
 * 8 ta mustaqil fakt" chiqardi.
 *
 * ── Narxi ─────────────────────────────────────────────────────────────────
 * Ikki chaqiruv — ikki baravar kechikish emas: skelet chaqiruvi juda
 * qisqa javob qaytaradi (matn yo'q) va tez tugaydi.
 */

// ─── 1-BOSQICH: SKELET ───────────────────────────────────────────────────

const OUTLINE_SYSTEM: Record<LanguageCode, string> = {
  UZ: `Siz tajribali prezentatsiya strategisiz. Sizning vazifangiz — matn YOZISH EMAS, balki prezentatsiyaning SKELETINI tuzish.

Skelet — bu har bir slaydning VAZIFASI va bitta asosiy fikri. Hozir hech qanday band, tavsif yoki paragraf yozmaysiz.

Qoidalar:
- Sizga hikoya bosqichlari (beat) ro'yxati beriladi. Har bir bosqich uchun AYNAN bitta slayd qaytaring, AYNAN o'sha tartibda.
- Har bir slaydning "keyMessage" i BITTA jumla bo'lsin va u shu slaydning yagona asosiy fikrini aytsin.
- Ketma-ket slaydlarning fikrlari TAKRORLANMASIN. Hikoya oldinga yursin.
- "heading" qisqa bo'lsin — slayd sarlavhasi, gap emas.
- "contentType" ni mazmunga qarab tanlang, xilma-xillik uchun emas.

Javobni FAQAT quyidagi JSON ko'rinishida qaytaring:

{
  "title": "Prezentatsiya sarlavhasi",
  "archetype": "educational",
  "slides": [
    {
      "beatKey": "berilgan ro'yxatdagi kalit",
      "heading": "Slayd sarlavhasi",
      "keyMessage": "Bu slaydning yagona asosiy fikri, bitta jumla.",
      "contentType": "bullets"
    }
  ]
}`,

  RU: `Вы опытный стратег презентаций. Ваша задача — НЕ ПИСАТЬ текст, а составить СКЕЛЕТ презентации.

Скелет — это НАЗНАЧЕНИЕ каждого слайда и одна его главная мысль. Сейчас вы не пишете ни пунктов, ни описаний, ни абзацев.

Правила:
- Вам дают список этапов истории (beat). Для каждого этапа верните РОВНО один слайд, РОВНО в том же порядке.
- "keyMessage" каждого слайда — ОДНО предложение, выражающее единственную главную мысль слайда.
- Мысли соседних слайдов НЕ ДОЛЖНЫ повторяться. История должна двигаться вперёд.
- "heading" должен быть коротким — это заголовок слайда, а не предложение.
- "contentType" выбирайте по содержанию, а не ради разнообразия.

Верните ответ ТОЛЬКО в виде следующего JSON:

{
  "title": "Название презентации",
  "archetype": "educational",
  "slides": [
    {
      "beatKey": "ключ из данного списка",
      "heading": "Заголовок слайда",
      "keyMessage": "Единственная главная мысль слайда, одно предложение.",
      "contentType": "bullets"
    }
  ]
}`,

  EN: `You are an experienced presentation strategist. Your task is NOT to write copy, but to build the SKELETON of a presentation.

The skeleton is the PURPOSE of each slide and its single key message. You are not writing bullets, descriptions or paragraphs yet.

Rules:
- You are given a list of story beats. Return EXACTLY one slide per beat, in EXACTLY that order.
- Each slide's "keyMessage" must be ONE sentence stating the single key idea of that slide.
- Consecutive slides must NOT repeat each other's message. The story must move forward.
- "heading" must be short — a slide title, not a sentence.
- Choose "contentType" from the content itself, not for the sake of variety.

Return your answer ONLY as the following JSON:

{
  "title": "Presentation title",
  "archetype": "educational",
  "slides": [
    {
      "beatKey": "a key from the given list",
      "heading": "Slide heading",
      "keyMessage": "The single key idea of this slide, one sentence.",
      "contentType": "bullets"
    }
  ]
}`,
};

/** Mazmun shakllarining tushuntirilishi — model to'g'ri tanlashi uchun. */
const CONTENT_TYPE_HELP: Record<LanguageCode, Record<ContentType, string>> = {
  UZ: {
    statement: "bitta kuchli jumla, bandlarsiz",
    bullets: "3-5 ta qisqa band",
    cards: "2-4 ta mustaqil tushuncha, yonma-yon",
    steps: "3-6 bosqichli ketma-ketlik yoki jarayon",
    comparison: "ikki tomonni qarama-qarshi qo'yish (A va B)",
    statistic: "bitta katta raqam va uning izohi",
    chart: "raqamli qator — diagramma",
    quote: "iqtibos",
  },
  RU: {
    statement: "одно сильное предложение, без пунктов",
    bullets: "3-5 коротких пунктов",
    cards: "2-4 самостоятельных понятия рядом",
    steps: "последовательность или процесс из 3-6 шагов",
    comparison: "противопоставление двух сторон (A и B)",
    statistic: "одно большое число и подпись к нему",
    chart: "числовой ряд — диаграмма",
    quote: "цитата",
  },
  EN: {
    statement: "one strong sentence, no bullets",
    bullets: "3-5 short bullets",
    cards: "2-4 independent concepts side by side",
    steps: "a 3-6 step sequence or process",
    comparison: "two sides set against each other (A vs B)",
    statistic: "one large number with its caption",
    chart: "a numeric series — a chart",
    quote: "a quotation",
  },
};

const OUTLINE_LABELS: Record<
  LanguageCode,
  {
    intro: string;
    subject: string;
    grade: string;
    topic: string;
    audience: string;
    purpose: string;
    count: string;
    beats: string;
    beatsNote: string;
    typesIntro: string;
    forbiddenTypes: string;
    archetypeLocked: string;
    archetypeFree: string;
    ageNote: (age: number) => string;
  }
> = {
  UZ: {
    intro: "Quyidagi prezentatsiya uchun skelet tuz:",
    subject: "Fan",
    grade: "Sinf/daraja",
    topic: "Mavzu",
    audience: "Auditoriya",
    purpose: "Maqsad",
    count: "Slaydlar soni (AYNAN)",
    beats: "Hikoya bosqichlari — har biriga bittadan slayd, shu tartibda:",
    beatsNote:
      'Har bir slaydning "beatKey" i yuqoridagi kalitlardan biri bo\'lishi SHART.',
    typesIntro: 'Mumkin bo\'lgan "contentType" qiymatlari:',
    forbiddenTypes:
      'DIQQAT: raqamli shakllar ("statistic", "chart") TAQIQLANGAN — ishonchli ma\'lumot manbasi yo\'q. Statistika, bozor hajmi yoki foizlarni O\'YLAB TOPMA.',
    archetypeLocked: "Arxetip ALLAQACHON tanlangan, uni o'zgartirma:",
    archetypeFree:
      "Arxetipni mavzuga qarab o'zing tanla (educational, investor, business, report):",
    ageNote: (age) =>
      `Auditoriya taxminan ${age} yoshda — fikrlar sodda va aniq bo'lsin.`,
  },
  RU: {
    intro: "Составьте скелет для следующей презентации:",
    subject: "Предмет",
    grade: "Класс/уровень",
    topic: "Тема",
    audience: "Аудитория",
    purpose: "Цель",
    count: "Количество слайдов (РОВНО)",
    beats: "Этапы истории — по одному слайду на каждый, в этом порядке:",
    beatsNote: '"beatKey" каждого слайда ОБЯЗАН быть одним из ключей выше.',
    typesIntro: 'Возможные значения "contentType":',
    forbiddenTypes:
      'ВНИМАНИЕ: числовые формы ("statistic", "chart") ЗАПРЕЩЕНЫ — нет надёжного источника данных. НЕ ВЫДУМЫВАЙТЕ статистику, объём рынка или проценты.',
    archetypeLocked: "Архетип УЖЕ выбран, не меняйте его:",
    archetypeFree:
      "Выберите архетип по теме сами (educational, investor, business, report):",
    ageNote: (age) =>
      `Аудитории примерно ${age} лет — мысли должны быть простыми и конкретными.`,
  },
  EN: {
    intro: "Build the skeleton for the following presentation:",
    subject: "Subject",
    grade: "Grade/level",
    topic: "Topic",
    audience: "Audience",
    purpose: "Purpose",
    count: "Number of slides (EXACTLY)",
    beats: "Story beats — one slide each, in this order:",
    beatsNote: 'Each slide\'s "beatKey" MUST be one of the keys above.',
    typesIntro: 'Allowed "contentType" values:',
    forbiddenTypes:
      'NOTE: numeric forms ("statistic", "chart") are FORBIDDEN — there is no reliable data source. Do NOT invent statistics, market sizes or percentages.',
    archetypeLocked: "The archetype is ALREADY chosen, do not change it:",
    archetypeFree:
      "Choose the archetype yourself based on the topic (educational, investor, business, report):",
    ageNote: (age) =>
      `The audience is around ${age} years old — keep every idea simple and concrete.`,
  },
};

const AUDIENCE_WORDS: Record<LanguageCode, Record<string, string>> = {
  UZ: {
    students: "o'quvchilar",
    teachers: "o'qituvchilar",
    investors: "investorlar",
    executives: "rahbariyat",
    general: "umumiy auditoriya",
  },
  RU: {
    students: "ученики",
    teachers: "учителя",
    investors: "инвесторы",
    executives: "руководство",
    general: "общая аудитория",
  },
  EN: {
    students: "students",
    teachers: "teachers",
    investors: "investors",
    executives: "executives",
    general: "a general audience",
  },
};

const PURPOSE_WORDS: Record<LanguageCode, Record<string, string>> = {
  UZ: {
    teach: "o'rgatish",
    persuade: "ishontirish",
    inform: "xabardor qilish",
    report: "hisobot berish",
  },
  RU: {
    teach: "обучить",
    persuade: "убедить",
    inform: "проинформировать",
    report: "отчитаться",
  },
  EN: {
    teach: "teach",
    persuade: "persuade",
    inform: "inform",
    report: "report",
  },
};

export function buildOutlineSystemPrompt(language: LanguageCode): string {
  return OUTLINE_SYSTEM[language];
}

export interface OutlinePromptInput {
  brief: PresentationBrief;
  beats: PlannedBeat[];
  allowed: ReadonlySet<ContentType>;
  /** Dars ishlanmasi konteksti — `buildUserPrompt` yig'adi. */
  contextBlock?: string;
}

export function buildOutlineUserPrompt(input: OutlinePromptInput): string {
  const { brief, beats, allowed } = input;
  const labels = OUTLINE_LABELS[brief.language];
  const lines: string[] = [labels.intro, ""];

  if (brief.subject) lines.push(`- ${labels.subject}: ${brief.subject}`);
  if (brief.grade) lines.push(`- ${labels.grade}: ${brief.grade}`);
  lines.push(`- ${labels.topic}: ${brief.topic}`);
  lines.push(`- ${labels.audience}: ${AUDIENCE_WORDS[brief.language][brief.audience]}`);
  lines.push(`- ${labels.purpose}: ${PURPOSE_WORDS[brief.language][brief.purpose]}`);
  lines.push(`- ${labels.count}: ${beats.length}`);

  lines.push(
    "",
    brief.archetypeLocked ? labels.archetypeLocked : labels.archetypeFree,
    brief.archetype,
  );

  if (brief.audienceAge !== null) {
    lines.push("", labels.ageNote(brief.audienceAge));
  }

  lines.push("", labels.beats, "");
  for (const [index, beat] of beats.entries()) {
    const part = beat.parts > 1 ? ` [${beat.part}/${beat.parts}]` : "";
    lines.push(`${index + 1}. beatKey="${beat.key}"${part} — ${beat.purpose}`);
  }
  lines.push("", labels.beatsNote);

  lines.push("", labels.typesIntro);
  for (const type of CONTENT_TYPES) {
    if (!allowed.has(type)) continue;
    lines.push(`- "${type}" — ${CONTENT_TYPE_HELP[brief.language][type]}`);
  }

  const blocked = CONTENT_TYPES.filter((type) => !allowed.has(type));
  if (blocked.includes("statistic") || blocked.includes("chart")) {
    lines.push("", labels.forbiddenTypes);
  }

  if (input.contextBlock) {
    lines.push("", input.contextBlock);
  }

  return lines.join("\n");
}

// ─── 3-BOSQICH: MAZMUN ───────────────────────────────────────────────────

const CONTENT_LABELS: Record<
  LanguageCode,
  {
    intro: string;
    rule: string;
    perSlide: string;
    purpose: string;
    keyMessage: string;
    shape: string;
    limits: string;
    noInvent: string;
    order: string;
  }
> = {
  UZ: {
    intro: "Quyidagi REJA bo'yicha slaydlar matnini yoz.",
    rule: "Reja o'zgartirilmaydi: slaydlar soni, tartibi va sarlavhalari AYNAN shu bo'lib qoladi. Sen faqat mazmunni yozasan.",
    perSlide: "SLAYD",
    purpose: "vazifasi",
    keyMessage: "asosiy fikr",
    shape: "mazmun shakli",
    limits: "chegaralar",
    noInvent:
      "Statistika, foiz, bozor hajmi, sana yoki iqtibos manbasini O'YLAB TOPMA. Ishonching komil bo'lmasa — raqamsiz yoz.",
    order:
      'Slaydlarni AYNAN shu tartibda qaytar. Har bir slaydning "heading" i rejadagidek bo\'lsin.',
  },
  RU: {
    intro: "Напишите текст слайдов по следующему ПЛАНУ.",
    rule: "План не меняется: количество слайдов, их порядок и заголовки остаются РОВНО такими. Вы пишете только содержание.",
    perSlide: "СЛАЙД",
    purpose: "назначение",
    keyMessage: "главная мысль",
    shape: "форма содержания",
    limits: "ограничения",
    noInvent:
      "НЕ ВЫДУМЫВАЙТЕ статистику, проценты, объём рынка, даты или источник цитаты. Если не уверены — пишите без чисел.",
    order:
      'Верните слайды РОВНО в этом порядке. "heading" каждого слайда должен совпадать с планом.',
  },
  EN: {
    intro: "Write the slide copy for the following PLAN.",
    rule: "The plan does not change: the number of slides, their order and their headings stay EXACTLY as given. You only write the content.",
    perSlide: "SLIDE",
    purpose: "purpose",
    keyMessage: "key message",
    shape: "content shape",
    limits: "limits",
    noInvent:
      "Do NOT invent statistics, percentages, market sizes, dates or quote attributions. When unsure, write without numbers.",
    order:
      'Return the slides in EXACTLY this order. Each slide\'s "heading" must match the plan.',
  },
};

/** Mazmun shakli uchun JSON maydonlari — model nimani to'ldirishini bilsin. */
const SHAPE_FIELDS: Record<ContentType, string> = {
  statement: "keyMessage (bullets: [])",
  bullets: "bullets",
  cards: 'cards: [{ "title", "body" }]',
  steps: 'steps: [{ "label", "body" }]',
  comparison: 'comparison: { "leftTitle", "leftItems", "rightTitle", "rightItems" }',
  statistic: 'statistic: { "value", "caption" }',
  chart: 'chart: { "kind", "categories", "series" }',
  quote: 'quote: { "text", "author" }',
};

export interface ContentPromptInput {
  brief: PresentationBrief;
  blueprints: SlideBlueprint[];
  title: string;
  /** Dars ishlanmasi konteksti. */
  contextBlock?: string;
}

/**
 * Mazmun bosqichining foydalanuvchi prompti.
 *
 * Har bir slayd uchun ANIQ topshiriq beriladi: vazifasi, asosiy fikri,
 * mazmun shakli va zichlik chegaralari. Model bularni o'ylab o'tirmaydi
 * — reja allaqachon tayyor.
 */
export function buildContentUserPrompt(input: ContentPromptInput): string {
  const labels = CONTENT_LABELS[input.brief.language];
  const lines: string[] = [labels.intro, "", labels.rule, ""];

  if (input.contextBlock) {
    lines.push(input.contextBlock, "");
  }

  lines.push(`title: ${input.title}`, "");

  for (const blueprint of input.blueprints) {
    const density = blueprint.density;
    const limits: string[] = [`heading ≤ ${density.maxHeadingChars}`];

    if (density.maxKeyMessageChars > 0) {
      limits.push(`keyMessage ≤ ${density.maxKeyMessageChars}`);
    }
    if (density.maxBullets > 0) {
      limits.push(
        `bullets: ${Math.min(3, density.maxBullets)}-${density.maxBullets} ta, har biri ≤ ${density.maxBulletChars}`,
      );
    } else {
      limits.push("bullets: []");
    }
    if (density.maxCardBodyChars > 0) {
      limits.push(`card.body ≤ ${density.maxCardBodyChars}`);
    }
    if (density.maxStepBodyChars > 0) {
      limits.push(`step.body ≤ ${density.maxStepBodyChars}`);
    }

    lines.push(
      `${labels.perSlide} ${blueprint.index + 1} [type=${blueprint.slideType}]`,
      `  heading: ${blueprint.heading}`,
      `  ${labels.purpose}: ${blueprint.purpose}`,
      `  ${labels.keyMessage}: ${blueprint.keyMessage}`,
      `  ${labels.shape}: ${blueprint.contentType} → ${SHAPE_FIELDS[blueprint.contentType]}`,
      `  ${labels.limits}: ${limits.join(", ")}`,
      "",
    );
  }

  lines.push(labels.order, "", labels.noInvent);

  return lines.join("\n");
}
