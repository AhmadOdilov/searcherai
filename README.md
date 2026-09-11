# Searcher AI

O'qituvchilar uchun AI-yordamchi platforma: dars ishlanmasi, prezentatsiya
(.pptx), Excel reja va ko'p tilli kontent generatsiyasi.

**Jamoa:** Expelled Coders · **Topshirish muddati:** 05.10.2026

---

## Stack

| Qatlam | Texnologiya |
| --- | --- |
| Frontend + Backend | Next.js 16 (App Router, Turbopack) |
| Til | TypeScript |
| Uslub | Tailwind CSS 4 |
| ORM | Prisma 7 (`@prisma/adapter-pg` driver adapter) |
| Baza | PostgreSQL 18 |
| Validatsiya | zod 4 |
| AI | provider-agnostik qatlam — OpenAI-mos yoki Anthropic |

---

## Ishga tushirish

### 1. Bog'liqliklar

```bash
npm install
```

### 2. Muhit o'zgaruvchilari

```bash
cp .env.example .env
```

Keyin `.env` ni tahrirlang. Eng kamida `DATABASE_URL` kerak; `AI_API_KEY`
bo'lmasa ilova ishlaydi, faqat AI funksiyalari o'chadi.

### 3. Ma'lumotlar bazasi

Ikki variantdan bittasini tanlang.

**A) Docker (tavsiya etiladi)** — host portida `5433`:

```bash
docker compose up -d
```

`.env` da:

```
DATABASE_URL="postgresql://searcher:searcher_dev_password@localhost:5433/searcher_ai?schema=public"
```

**B) Mahalliy PostgreSQL** — host portida `5432`:

```bash
psql -U postgres -c "CREATE ROLE searcher LOGIN PASSWORD 'searcher_dev_password' CREATEDB"
psql -U postgres -c "CREATE DATABASE searcher_ai OWNER searcher"
```

### 4. Migratsiya

```bash
npm run db:migrate
```

### 5. Ishga tushirish

```bash
npm run dev
```

Tekshirish: <http://localhost:3000/api/health>

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "database": { "connected": true, "latencyMs": 56 },
    "ai": { "provider": "openai", "model": "gpt-4o-mini", "configured": false }
  }
}
```

---

## Skriptlar

| Buyruq | Vazifasi |
| --- | --- |
| `npm run dev` | Ishlab chiqish serveri |
| `npm run build` | Production build |
| `npm test` | Sinovlar (haqiqiy API kaliti kerak emas) |
| `npm run typecheck` | TypeScript tekshiruvi |
| `npm run lint` | ESLint |
| `npm run format` | Prettier bilan formatlash |
| `npm run ai:smoke` | AI qatlamini haqiqiy provider bilan sinash |
| `npm run db:migrate` | Migratsiya yaratish va qo'llash |
| `npm run db:studio` | Prisma Studio (bazani ko'rish) |
| `npm run db:reset` | Bazani tozalab qaytadan qurish |

---

## AI qatlami

Butun ilova AI bilan **faqat** `lib/ai/provider.ts` orqali gaplashadi.
Modullar qaysi provider ishlatilayotganini bilmaydi.

```ts
import { generateText, generateJson } from "@/lib/ai/provider";

// Oddiy matn
const result = await generateText({
  prompt: "Fotosintez nima?",
  systemPrompt: "Sen o'qituvchiga yordam beradigan yordamchisan.",
});

// Struktura qilingan JSON — zod sxemasi bilan kafolatlangan
const { data } = await generateJson({
  schema: z.object({ title: z.string(), steps: z.array(z.string()) }),
  prompt: "Dars rejasini tuz",
});
```

### Provider almashtirish

`.env` dagi bir-ikki qatorni o'zgartirish yetarli — kod tegilmaydi:

| Xizmat | `AI_PROVIDER` | `AI_BASE_URL` |
| --- | --- | --- |
| OpenAI | `openai` | (bo'sh) |
| OpenRouter | `openai` | `https://openrouter.ai/api/v1` |
| Gemini | `openai` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Groq | `openai` | `https://api.groq.com/openai/v1` |
| Ollama (mahalliy) | `openai` | `http://localhost:11434/v1` |
| Anthropic | `anthropic` | (bo'sh) |

### Xatoliklarni qayta ishlash

`generateText` faqat `AiError` tashlaydi. Unda ikki xil xabar bor:

- `error.message` — texnik tafsilot, **faqat log uchun**
- `error.userMessage` — foydalanuvchiga ko'rsatish uchun xavfsiz xabar

Turlari: `not_configured`, `auth`, `rate_limit`, `quota`, `timeout`,
`network`, `bad_request`, `server`, `bad_response`, `aborted`, `unknown`.
Vaqtinchalik xatolar (`rate_limit`, `timeout`, `network`, `server`) avtomatik
qayta urinadi — eksponensial kutish va `Retry-After` hurmati bilan.

---

## API route yozish

Har bir modulda `try/catch` takrorlanmaydi — umumiy wrapper bor:

```ts
// app/api/lesson-plans/route.ts
import { withErrorHandling, parseJsonBody, ok } from "@/lib/api/with-error-handling";
import { lessonPlanInputSchema } from "@/lib/validations";

export const POST = withErrorHandling(async (request) => {
  const input = await parseJsonBody(request, lessonPlanInputSchema);
  const plan = await createLessonPlan(input);
  return ok(plan, 201);
});
```

Javoblar har doim bir xil shaklda:

```ts
{ ok: true,  data: { ... } }
{ ok: false, error: { code, message, fieldErrors? } }
```

---

## Loyiha tuzilishi

```
app/
  api/health/route.ts        sog'lik tekshiruvi
lib/
  env.ts                     muhit o'zgaruvchilari — YAGONA o'qish joyi
  db.ts                      Prisma klient singleton
  ai/
    provider.ts              AI qatlamining kirish nuqtasi
    types.ts                 umumiy tiplar va AiError
    json.ts                  javobdan JSON ajratish
    transports/
      http.ts                umumiy HTTP + xatolik tarjimasi
      openai-compatible.ts   /chat/completions
      anthropic.ts           /v1/messages
  api/
    errors.ts                ApiError
    with-error-handling.ts   route wrapper
  validations/
    common.ts                umumiy zod bo'laklari
prisma/
  schema.prisma              DB sxemasi
  migrations/                migratsiyalar
tests/                       sinovlar (mock AI server bilan)
```

---

## Modullar holati

| Modul | Holat |
| --- | --- |
| Skelet, DB, AI qatlami | ✅ tayyor |
| Autentifikatsiya | ⬜ keyingi bosqich |
| Dars ishlanmasi generatsiyasi | ⬜ |
| Prezentatsiya (.pptx) | ⬜ |
| Excel reja (.xlsx) | ⬜ |
| .docx / .pdf eksport | ⬜ |
| Ko'p tillilik (UZ/RU/EN) | ⬜ |
| AI qidiruv (Searcher) | ⬜ |
