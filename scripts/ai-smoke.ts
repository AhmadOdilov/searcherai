/**
 * AI qatlamini tekshiruvchi skript.
 *
 * Ishga tushirish:
 *   npm run ai:smoke
 *   npm run ai:smoke -- "O'zingizning savolingiz"
 *
 * Nimani tekshiradi:
 *  1. .env to'g'ri o'qilayaptimi
 *  2. tanlangan provider bilan aloqa bormi (oddiy matn so'rovi)
 *  3. jsonMode + zod validatsiyasi ishlayaptimi
 *
 * Kalit sozlanmagan bo'lsa — xato bermaydi, tushunarli xabar chiqaradi.
 */
import "dotenv/config";
import { z } from "zod";
import { aiInfo, generateJson, generateText } from "@/lib/ai/provider";
import { AiError } from "@/lib/ai/types";

async function main(): Promise<number> {
  const info = aiInfo();

  console.log("── Sozlama ──────────────────────────────────────────────");
  console.log(`  provider : ${info.provider}`);
  console.log(`  model    : ${info.model}`);
  console.log(`  baseUrl  : ${info.baseUrl}`);
  console.log(`  kalit    : ${info.configured ? "sozlangan ✓" : "YO'Q ✗"}`);
  console.log();

  if (!info.configured) {
    console.log("AI_API_KEY sozlanmagan — .env faylini to'ldiring.");
    console.log("AI qatlami kodi tayyor, faqat kalit kutilyapti.");
    return 0;
  }

  const prompt = process.argv[2] ?? "Salom de va o'zingni bir gapda tanishtir.";

  // ── 1-sinov: oddiy matn ────────────────────────────────────────────────
  console.log("── 1-sinov: matn generatsiyasi ──────────────────────────");
  console.log(`  so'rov: ${prompt}`);
  try {
    const result = await generateText({
      prompt,
      systemPrompt: "Sen o'zbek tilida javob beradigan yordamchisan. Qisqa javob ber.",
      maxTokens: 300,
    });
    console.log(`  javob  : ${result.text}`);
    console.log(
      `  model  : ${result.model} | ${result.durationMs} ms | ` +
        `tokenlar: ${result.usage.inputTokens}→${result.usage.outputTokens} | ` +
        `urinish: ${result.attempts}`,
    );
    console.log("  natija : ✓ OK");
  } catch (error) {
    reportError(error);
    return 1;
  }
  console.log();

  // ── 2-sinov: JSON + zod ────────────────────────────────────────────────
  console.log("── 2-sinov: JSON generatsiyasi + zod tekshiruvi ─────────");
  const schema = z.object({
    greeting: z.string().min(1),
    language: z.string().min(1),
    items: z.array(z.string()).min(2),
  });
  try {
    const { data, meta } = await generateJson({
      schema,
      prompt:
        "Menga quyidagi maydonlar bilan JSON qaytar: " +
        `greeting (o'zbek tilida salomlashish), language (til nomi), ` +
        `items (o'qituvchi ishidagi 3 ta vazifa nomi massivi).`,
      maxTokens: 500,
    });
    console.log(`  greeting: ${data.greeting}`);
    console.log(`  language: ${data.language}`);
    console.log(`  items   : ${data.items.join(", ")}`);
    console.log(`  vaqt    : ${meta.durationMs} ms`);
    console.log("  natija  : ✓ OK");
  } catch (error) {
    reportError(error);
    return 1;
  }

  console.log();
  console.log("Hammasi ishlayapti ✓");
  return 0;
}

function reportError(error: unknown): void {
  if (error instanceof AiError) {
    console.error(`  natija : ✗ XATO (${error.kind})`);
    console.error(`  texnik : ${error.message}`);
    console.error(`  tarjima kaliti: ${error.messageKey}`);
    if (error.kind === "auth") {
      console.error("  → AI_API_KEY ni tekshiring.");
    }
    if (error.kind === "bad_request") {
      console.error("  → AI_MODEL nomi va AI_BASE_URL ni tekshiring.");
    }
  } else {
    console.error("  natija : ✗ kutilmagan xatolik", error);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Skript qulab tushdi:", error);
    process.exit(1);
  });
