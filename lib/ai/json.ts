import { AiError } from "@/lib/ai/types";

/**
 * Model qaytargan matndan JSON ajratib olish.
 *
 * Nega kerak: modellar so'rasangiz ham JSON'ni ko'pincha ```json ... ```
 * ramkasi yoki "Mana natija:" kabi kirish matni bilan o'raydi. Har bir
 * modulda buni qayta-qayta tozalashdan ko'ra, bir joyda hal qilamiz.
 *
 * Bu funksiya FAQAT satrni tozalaydi. Shaklni tekshirish — zod sxemasining
 * ishi (`generateJson`).
 */
export function extractJsonText(raw: string): string {
  let text = raw.trim();

  // ```json ... ``` yoki ``` ... ``` ramkasini olib tashlaymiz.
  const fenced = text.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenced) {
    text = fenced[1].trim();
  }

  // Allaqachon toza JSON bo'lsa — shundayligicha qaytaramiz.
  if (isLikelyJson(text)) return text;

  // Aks holda matn ichidagi eng tashqi { ... } yoki [ ... ] ni topamiz.
  const sliced = sliceOutermostJson(text);
  if (sliced) return sliced;

  throw new AiError({
    kind: "bad_response",
    detail: `Javobdan JSON ajratib bo'lmadi. Javob boshlanishi: ${preview(raw)}`,
  });
}

function isLikelyJson(text: string): boolean {
  return (
    (text.startsWith("{") && text.endsWith("}")) ||
    (text.startsWith("[") && text.endsWith("]"))
  );
}

/**
 * Matn ichidan birinchi to'liq JSON obyekt/massivni kesib oladi.
 *
 * Qavslarni sanaydi, lekin SATR ichidagi qavslarni hisobga olmaydi —
 * masalan {"a": "}"} kabi holatda ham to'g'ri ishlashi uchun satr va
 * ekranlash (escape) holatini kuzatadi.
 */
function sliceOutermostJson(text: string): string | null {
  const startIndex = text.search(/[{[]/);
  if (startIndex === -1) return null;

  const openChar = text[startIndex];
  const closeChar = openChar === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === openChar) depth++;
    else if (char === closeChar) {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }

  return null;
}

/** Log uchun javobning qisqa boshlanishi. */
export function preview(text: string, limit = 200): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > limit ? `${oneLine.slice(0, limit)}…` : oneLine;
}

/**
 * jsonMode yoqilganda system promptga qo'shiladigan ko'rsatma.
 *
 * Nega prompt orqali: har bir provider JSON rejimini boshqacha nomlaydi
 * (OpenAI'da `response_format`, Anthropic'da `output_config`), ba'zi
 * OpenAI-mos endpointlar esa umuman qo'llab-quvvatlamaydi. Prompt esa
 * HAMMA joyda ishlaydi — shuning uchun u asosiy vosita, native rejim
 * ustiga qo'shimcha.
 */
export const JSON_MODE_INSTRUCTION = [
  "Javobni FAQAT to'g'ri (valid) JSON ko'rinishida qaytar.",
  "Hech qanday tushuntirish, izoh yoki ```json ramkasi qo'shma.",
  "Javob { belgisi bilan boshlanib } belgisi bilan tugashi kerak.",
].join(" ");
