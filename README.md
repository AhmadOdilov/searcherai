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
| `npm test` | Birlik sinovlari (baza va API kaliti kerak emas) |
| `npm run test:e2e` | Uchidan-uchgacha sinovlar (serverni o'zi ko'taradi, baza kerak) |
| `npm run typecheck` | TypeScript tekshiruvi |
| `npm run lint` | ESLint |
| `npm run format` | Prettier bilan formatlash |
| `npm run ai:smoke` | AI qatlamini haqiqiy provider bilan sinash |
| `npm run db:migrate` | Migratsiya yaratish va qo'llash |
| `npm run db:studio` | Prisma Studio (bazani ko'rish) |
| `npm run db:reset` | Bazani tozalab qaytadan qurish |

---

## Autentifikatsiya

### Oqim

```
/register → hisob yaratiladi → sessiya darhol beriladi → /dashboard
/login    → parol tekshiriladi → sessiya beriladi      → /dashboard
/logout   → sessiya BAZADAN o'chiriladi + cookie tozalanadi → /login
```

### Sessiya qanday ishlaydi

Ikki qatlamli: bazadagi `Session` yozuvi + uni ko'rsatuvchi imzolangan JWT
cookie'da.

Nega faqat JWT yetarli emas: imzolangan token muddati tugamaguncha yaroqli
bo'lib qoladi, ya'ni "chiqish" faqat cookie'ni o'chiradi va o'g'irlangan
token nusxasi ishlashda davom etadi. Bazada yozuv bo'lsa — uni o'chirish
bilan sessiya **darhol** kuchdan qoladi. Buni sinov ham tekshiradi
(`chiqqandan keyin ESKI cookie ham ishlamaydi`).

Cookie sozlamalari: `httpOnly` (JS tega olmaydi — XSS bo'lsa ham
o'g'irlanmaydi), `sameSite: lax` (boshqa saytdan yuborilgan so'rovda
ketmaydi — CSRF himoyasi), productionda `secure`.

### Himoya ikki darajada

| Qatlam | Nima tekshiradi | Nima uchun |
| --- | --- | --- |
| `proxy.ts` | cookie bor va imzosi to'g'rimi | Qulaylik: foydalanuvchini `/login`ga yuboradi. Bazaga tegmaydi, chunki har so'rovda (prefetch'da ham) ishlaydi |
| `requireUser()` | sessiya bazada hali mavjudmi | **Haqiqiy himoya.** API route'lar va sahifalar shundan foydalanadi |

> Next.js 16'da `middleware.ts` eskirgan va `proxy.ts` ga nomlangan.
> Vazifasi bir xil, faqat fayl va eksport nomi boshqa.

### API route'da userId olish

`userId` **hech qachon** so'rov tanasidan olinmaydi — faqat sessiyadan:

```ts
import { requireUser } from "@/lib/auth/session";

export const POST = withErrorHandling(async (request) => {
  const user = await requireUser();        // kirmagan bo'lsa 401
  const input = await parseJsonBody(request, lessonPlanInputSchema);

  const plan = await prisma.lessonPlan.create({
    data: { ...input, userId: user.id },   // ← sessiyadan
  });
  return ok(plan, 201);
});
```

Klient yuborgan `userId` ga ishonib bo'lmaydi: uni brauzer konsolidan
o'zgartirib, boshqa foydalanuvchi nomidan yozish mumkin.

### Klientda foydalanuvchi

`useUser()` **so'rov yubormaydi** — `app/dashboard/layout.tsx` foydalanuvchini
serverda o'qib, context orqali uzatadi:

```tsx
"use client";
import { useUser } from "@/lib/hooks/use-user";

export function Greeting() {
  const user = useUser();           // { id, email, fullName, role, language }
  return <p>Salom, {user.fullName}</p>;
}
```

Bu hook faqat **ko'rsatish** uchun (ism, til, "chiqish" tugmasi). Ma'lumot
yozishda `user.id` ni API'ga yubormang — yuqoridagi `requireUser()` ga qara.

### MVP doirasidan tashqarida

Ataylab kiritilmagan: parolni tiklash, email tasdiqlash, OAuth,
rol-based ruxsatlar tizimi, CSRF tokeni (`sameSite: lax` MVP uchun yetarli),
kirishga urinishlar chekloviga (rate limit).

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

## Dars ishlanmasi moduli

### Oqim

```
Forma → POST /api/lesson-plans
  → LessonPlan yozuvi (status: PENDING)
  → AI (generateJson + zod sxema)
  → READY: content to'ldiriladi, aiDurationMs saqlanadi
  → FAILED: errorMessage saqlanadi, «Qayta urinish» tugmasi paydo bo'ladi
```

Generatsiya MVP'da **sinxron** — route AI javobini kutadi (5–40 soniya).
Fon rejimi keyingi bosqichda; yozuv `PENDING` bilan oldin yaratilgani uchun
oqim o'zgarmaydi.

### Nega yozuv AI'dan OLDIN yaratiladi

1. AI yiqilsa foydalanuvchi ro'yxatda `FAILED` yozuvni ko'radi va bir tugma
   bilan qayta urinadi — kiritgan ma'lumoti yo'qolmaydi.
2. `aiDurationMs` saqlanadi — Step 5 (performance) uchun o'lchov.
3. Fon rejimiga o'tishda kod tuzilishi o'zgarmaydi.

### Sxemalar

`lib/validations/lesson-plan.ts` da **ikki xil** sxema bor, ularni
aralashtirmaslik kerak:

| Sxema | Nima uchun |
| --- | --- |
| `lessonPlanInputSchema` | Foydalanuvchi formasidan keladigan ma'lumot |
| `lessonPlanContentSchema` | AI qaytaradigan struktura + bazadagi `content` ni qayta o'qish |
| `lessonPlanContentSchemaFor(dur)` | Yuqoridagi + bosqichlar vaqti yig'indisi tekshiruvi |

`content` — Json ustun, ya'ni TypeScript uchun `unknown`. Uni `as` bilan
tiplashtirish xavfli (eski yozuvlar boshqa shaklda bo'lishi mumkin), shuning
uchun **har doim** `parseLessonPlanContent()` orqali o'qiladi — mos kelmasa
`null` qaytadi va sahifa qulamaydi.

### Vaqt yig'indisi

Promptda bosqichlar yig'indisi dars davomiyligiga teng bo'lishi aniq son
bilan talab qilinadi. Sxema esa **keng chegara** (50%–150%) qo'yadi:

- qat'iy tenglik talab qilsak, 45 o'rniga 44 qaytganda butun generatsiya
  yiqilardi — foydalanuvchi uchun bu "AI ishlamadi", holbuki natija yaroqli;
- keng chegara mantiqsiz javoblarni (45 daqiqalik darsga 9 daqiqa) tutadi va
  `generateJson` modelga xatoni aytib qayta so'raydi.

Aniq yig'indi natija sahifasida ko'rsatiladi — mos kelmasa o'qituvchi ko'radi.

### Ko'p tillilik

Promptlar **to'liq** tarjima qilingan (`lib/lesson-plans/prompt.ts`), "javobni
rus tilida ber" degan qo'shimcha emas. Sabab: model bunday ko'rsatmani
ko'pincha qisman bajaradi — sarlavhalarni tarjima qilib, matnni prompt tilida
qoldiradi.

JSON **maydon nomlari** hamma tilda inglizcha qoladi — ular zod sxemasining
kalitlari. Buni sinov tekshiradi.

### Routelar

| Route | Vazifasi |
| --- | --- |
| `POST /api/lesson-plans` | Yangi generatsiya |
| `GET /api/lesson-plans` | Ro'yxat (`?status=`, `?limit=`, `?cursor=`) |
| `GET /api/lesson-plans/[id]` | Bitta ishlanma |
| `DELETE /api/lesson-plans/[id]` | O'chirish |
| `POST /api/lesson-plans/[id]/regenerate` | Qayta generatsiya (o'rnida) |

Egalik har bir so'rovda `where: { id, userId }` bilan tekshiriladi. Begona
yozuv uchun **404** qaytadi, 403 emas — 403 "bu yozuv bor, lekin sizga
tegishli emas" degan ma'noni berib, boshqa foydalanuvchilarning yozuvlari
borligini oshkor qilardi.

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
  api/auth/{register,login,logout,me}/route.ts
  api/lesson-plans/...        dars ishlanmasi API'si
  login/ register/ dashboard/
  dashboard/lesson-plans/     ro'yxat, /new forma, /[id] natija
proxy.ts                     himoyalangan sahifalar (Next 16: middleware o'rniga)
components/
  auth-form.tsx              login/register uchun umumiy forma
  logout-button.tsx  user-greeting.tsx
lib/
  env.ts                     muhit o'zgaruvchilari — YAGONA o'qish joyi
  db.ts                      Prisma klient singleton
  api-client.ts              brauzerdan API chaqirish
  auth/
    jwt.ts                   JWT imzo/tekshiruv (proxy ham ishlatadi)
    session.ts               sessiya, parol hash, requireUser()
  hooks/use-user.tsx         UserProvider + useUser()
  lesson-plans/
    service.ts               generatsiya, ro'yxat, egalik tekshiruvi
    prompt.ts                UZ/RU/EN promptlari
    labels.ts                UI yorliqlari (keyinchalik i18n ga ko'chadi)
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
    auth.ts                  register/login sxemalari
    lesson-plan.ts           kirish + AI kontent sxemalari
prisma/
  schema.prisma              DB sxemasi
  migrations/                migratsiyalar
tests/                       birlik sinovlari (mock AI server bilan)
  e2e/                       uchidan-uchgacha (haqiqiy server + baza)
```

---

## Modullar holati

| Modul | Holat |
| --- | --- |
| Skelet, DB, AI qatlami | ✅ tayyor |
| Autentifikatsiya | ✅ tayyor |
| Dars ishlanmasi generatsiyasi | ✅ tayyor |
| Prezentatsiya (.pptx) | ⬜ |
| Excel reja (.xlsx) | ⬜ |
| .docx / .pdf eksport | ⬜ |
| Ko'p tillilik (UZ/RU/EN) | ⬜ |
| AI qidiruv (Searcher) | ⬜ |
