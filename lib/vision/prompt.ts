import type { LanguageCode } from "@/lib/validations/common";
import type { VisionInput } from "@/lib/validations/vision";

/**
 * Rasm tahlili promptlari.
 *
 * ── Eng muhim ko'rsatma: "o'ylab topma" ───────────────────────────────────
 * Vision modellari rasmda yo'q narsani ishonch bilan yozib yuborishga
 * moyil: xira suratdan ham "6-sinf biologiya, fotosintez mavzusi" deb
 * chiqaradi. O'qituvchi esa shunga ishonib dars tayyorlaydi.
 *
 * Shuning uchun promptda `usable` maydoni bor va model rasmni o'qiy
 * olmasa buni AYTISHI talab qilinadi — bo'sh taxmin qilish emas.
 */

const SYSTEM: Record<LanguageCode, string> = {
  UZ: `Sen O'zbekiston maktab o'qituvchilariga yordam beradigan yordamchisan.

Senga darslik sahifasi, chizma, jadval yoki qo'lyozma surati beriladi.
Vazifang — unda NIMA borligini aniqlab, o'qituvchi dars tayyorlashi uchun
foydali shaklga keltirish.

Qoidalar:
· FAQAT rasmda ko'rgan narsani yoz. Ko'rmagan narsangni qo'shma.
· Matnni o'qiy olmasang yoki rasm xira bo'lsa — "usable": false qilib,
  "problem" da sababini ayt. Taxmin qilib to'ldirma.
· Rasmda dars materiali umuman bo'lmasa (masalan oddiy surat, selfie) —
  ham "usable": false.
· Fan va sinfni rasm mazmuniga qarab ayt. Aniq bilmasang, eng ehtimoliy
  variantni ber, lekin mazmunga zid bo'lmasin.
· "keyContent" — rasmdagi ASOSIY ma'lumot: qoidalar, ta'riflar, misollar,
  jadval qatorlari. Bu matn keyin dars ishlanmasi tayyorlashda
  ishlatiladi, shuning uchun aniq va to'liq bo'lsin.
· Faqat JSON qaytar, boshqa hech narsa yozma.`,

  RU: `Ты помощник для школьных учителей Узбекистана.

Тебе дают фотографию страницы учебника, схемы, таблицы или рукописи.
Твоя задача — определить, ЧТО на ней, и привести это к виду, полезному
для подготовки урока.

Правила:
· Пиши ТОЛЬКО то, что видишь на изображении. Не добавляй того, чего нет.
· Если текст не читается или снимок размытый — поставь "usable": false и
  укажи причину в "problem". Не додумывай.
· Если на изображении вообще нет учебного материала (обычное фото, селфи) —
  тоже "usable": false.
· Предмет и класс определи по содержанию. Если точно не знаешь, дай самый
  вероятный вариант, но не противоречащий содержанию.
· "keyContent" — основная информация с изображения: правила, определения,
  примеры, строки таблицы. Этот текст потом используется при подготовке
  плана урока, поэтому он должен быть точным и полным.
· Верни только JSON, ничего больше.`,

  EN: `You are an assistant for school teachers in Uzbekistan.

You are given a photo of a textbook page, diagram, table, or handwriting.
Your task is to identify WHAT is on it and turn it into something useful
for preparing a lesson.

Rules:
· Write ONLY what you see in the image. Do not add anything that is not there.
· If the text is unreadable or the photo is blurry, set "usable": false and
  explain why in "problem". Do not guess.
· If the image contains no teaching material at all (an ordinary photo, a
  selfie), also set "usable": false.
· Determine subject and grade from the content. If unsure, give the most
  likely option, but never one that contradicts the content.
· "keyContent" is the main information from the image: rules, definitions,
  examples, table rows. This text is later used to prepare a lesson plan,
  so it must be accurate and complete.
· Return JSON only, nothing else.`,
};

const SHAPE: Record<LanguageCode, string> = {
  UZ: `Javob shakli (JSON):
{
  "description": "rasmda nima ko'rsatilgan — 2-5 jumla",
  "subject": "fan nomi",
  "grade": "taxminiy sinf, masalan 7-sinf",
  "topic": "dars mavzusi sifatida ishlatiladigan nom",
  "keyContent": ["rasmdagi asosiy ma'lumot", "..."],   // 2-8 ta
  "usable": true,
  "problem": "rasm yaroqsiz bo'lsa — sababi"           // usable: false bo'lsagina
}`,
  RU: `Формат ответа (JSON):
{
  "description": "что изображено — 2-5 предложений",
  "subject": "название предмета",
  "grade": "предполагаемый класс, например 7 класс",
  "topic": "название, которое подойдёт как тема урока",
  "keyContent": ["основная информация с изображения", "..."],   // 2-8 штук
  "usable": true,
  "problem": "причина, если изображение непригодно"             // только при usable: false
}`,
  EN: `Response shape (JSON):
{
  "description": "what is shown, 2-5 sentences",
  "subject": "subject name",
  "grade": "likely grade, e.g. grade 7",
  "topic": "a name usable as a lesson topic",
  "keyContent": ["main information from the image", "..."],   // 2-8 items
  "usable": true,
  "problem": "why the image is unusable"                      // only when usable is false
}`,
};

const HINT_LABELS: Record<
  LanguageCode,
  { subject: string; grade: string; task: string }
> = {
  UZ: {
    subject: "O'qituvchi aytgan fan",
    grade: "O'qituvchi aytgan sinf",
    task: "Shu rasmni tahlil qil",
  },
  RU: {
    subject: "Предмет, указанный учителем",
    grade: "Класс, указанный учителем",
    task: "Проанализируй это изображение",
  },
  EN: {
    subject: "Subject given by the teacher",
    grade: "Grade given by the teacher",
    task: "Analyse this image",
  },
};

export function buildVisionSystemPrompt(language: LanguageCode): string {
  return SYSTEM[language];
}

export function buildVisionUserPrompt(input: VisionInput): string {
  const labels = HINT_LABELS[input.language];
  const lines: string[] = [];

  /*
    Foydalanuvchi bergan fan/sinf — ISHORA, buyruq emas.

    Nega muhim: o'qituvchi "Matematika" deb yozib, adashib biologiya
    sahifasini yuklashi mumkin. Model ishorani ko'r-ko'rona qabul qilsa,
    rasmda yo'q narsani "matematika" deb ta'riflardi.
  */
  if (input.subject !== undefined) lines.push(`${labels.subject}: ${input.subject}`);
  if (input.grade !== undefined) lines.push(`${labels.grade}: ${input.grade}`);

  lines.push(`${labels.task}.`, "", SHAPE[input.language]);

  return lines.join("\n");
}
