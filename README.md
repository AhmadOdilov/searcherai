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

## Prezentatsiya moduli (.pptx)

### Ikki kirish nuqtasi

```
A) Dars ishlanmasidan (ASOSIY oqim)
   { "mode": "from-lesson-plan", "lessonPlanId": "..." }
   → mavzu, fan, sinf va TIL yozuvning o'zidan olinadi
   → promptga dars maqsadi, natijalari va BOSQICHLARI kiritiladi
   → har bir dars bosqichiga taxminan bitta slayd to'g'ri keladi

B) Mustaqil
   { "mode": "standalone", "topic": "...", "subject": "...", "grade": "..." }
```

Sxema `z.discriminatedUnion("mode", ...)` — oddiy `.optional()` maydonlar
bilan qilinsa, "lessonPlanId ham, topic ham berilgan" yoki "ikkisi ham yo'q"
kabi mantiqsiz holatlar o'tib ketardi.

### Qatlamlar

| Qatlam | Javobgarligi |
| --- | --- |
| `lib/pptx/generate.ts` | Slaydlar JSON → .pptx Buffer. **AI, baza va sessiyadan MUSTAQIL** |
| `lib/pptx/theme.ts` | Rang, shrift, o'lchamlar — dizayn shu yerda |
| `lib/presentations/prompt.ts` | UZ/RU/EN promptlari + dars ishlanmasi konteksti |
| `lib/presentations/storage.ts` | Fayl saqlash/o'qish/o'chirish |
| `lib/presentations/service.ts` | Oqim: PENDING → AI → .pptx → READY/FAILED |

`generate.ts` ning mustaqilligi ataylab: uni sinovda hech narsa mock
qilmasdan chaqirish mumkin, va fayl formatini o'zgartirganda AI qatlamiga
tegish kerak emas.

### Fayllar qayerda saqlanadi

`storage/presentations/` — **`public/` da EMAS**.

`public/` ichidagi hamma narsani Next.js statik tarqatadi: havolani bilgan
har qanday odam, hatto tizimga kirmagan bo'lsa ham, faylni olardi — ya'ni
yuklab olish route'idagi egalik tekshiruvi bekor bo'lardi. Fayl faqat
`GET /api/presentations/[id]/download` orqali beriladi va har so'rovda
foydalanuvchi hamda egalik tekshiriladi.

Ikkinchi sabab: productionda (Vercel kabi) fayl tizimi faqat o'qish uchun
ochiq — `public/` ga runtime'da yozib bo'lmaydi. Saqlagich alohida qatlam
bo'lgani uchun S3/R2 ga o'tish faqat `storage.ts` ni o'zgartirishni talab
qiladi.

### Yuklab olish

```
content-type: application/vnd.openxmlformats-officedocument.presentationml.presentation
content-disposition: attachment; filename="..."; filename*=UTF-8''...
cache-control: private, no-store
```

`filename` va `filename*` ikkalasi ham beriladi: `oʻ`, `gʻ` va kirill
harflari ASCII `filename` da ishlamaydi, `filename*` esa eski mijozlarda
qo'llab-quvvatlanmaydi.

### Routelar

| Route | Vazifasi |
| --- | --- |
| `POST /api/presentations` | Generatsiya (ikki rejim) |
| `GET /api/presentations` | Ro'yxat |
| `GET /api/presentations/[id]` | Bitta yozuv |
| `GET /api/presentations/[id]/download` | .pptx yuklab olish |
| `DELETE /api/presentations/[id]` | O'chirish (yozuv + fayl) |
| `POST /api/presentations/[id]/regenerate` | Qayta generatsiya |

### Ma'lum cheklov

Foydalanuvchi o'chirilsa prezentatsiya va kalendar reja yozuvlari cascade
bilan o'chadi, lekin **diskdagi fayllar qoladi** — baza cascade'i fayl tizimini bilmaydi.
Hozircha hisobni o'chirish funksiyasi yo'q, shuning uchun bu amalda
uchramaydi. Qo'shilganda: avval fayllarni o'chirib, keyin foydalanuvchini
o'chirish kerak (`tests/e2e/helpers/client.ts` dagi `cleanupTestUsers`
xuddi shunday qiladi).

---

## Kalendar-tematik reja moduli (.xlsx)

### Oqim

```
Forma → POST /api/calendar-plans
  → CalendarPlan yozuvi (PENDING)
  → hafta sanalari KODDA hisoblanadi va promptga qo'shiladi
  → AI mavzularni haftalarga taqsimlaydi
  → exceljs jadvalni yasaydi
  → READY: filePath, rowCount, aiDurationMs
```

### Sanalarni AI hisoblamaydi

Hafta oraliqlari `lib/calendar-plans/dates.ts` da hisoblanib, promptga
**tayyor** holda beriladi; AI ularni faqat ko'chiradi.

Sabab: modellar sana arifmetikasida ishonchsiz — 30 kunli oyni 31 deb,
kabisa yilini unutib yuboradi. Oy, yil va kabisa chegaralari sinov bilan
qoplangan.

### Token chegarasi

Bu modul boshqalardan uzunroq javob qaytaradi: bir o'quv yili ≈ 100 qator.
Shuning uchun `estimateMaxTokens(weeks)` chegarani hafta soniga qarab
hisoblaydi (`weeks × 400 + 2000`, `AI_MAX_TOKENS` dan past emas, 32000 dan
yuqori emas). Standart 16000 bilan 52 haftalik reja javobi o'rtada kesilib,
JSON buzilishi mumkin edi.

### Excel formatlash

`lib/xlsx/theme.ts` — rang, shrift, ustun kengliklari bir joyda.

- Sarlavha qatori: qalin, to'q fon, oq matn
- Barcha katakchalarda chegara
- Sarlavha qatorlari **qotirilgan** (`ySplit: 2`) — 70 qatorli jadvalda
  pastga tushganda ustun nomlari ko'rinib turadi
- Bitta haftada bir nechta mavzu bo'lsa, hafta raqami va sanasi
  birlashtiriladi
- Oxirida "Jami" qatori

> **ExcelJS tuzog'i:** ustun kengligi aynan `9` bo'lsa, ExcelJS uni o'zining
> standart qiymati deb biladi va faylga **umuman yozmaydi**. Niyat jim
> yo'qoladi. Shuning uchun hafta ustuni `10`, va sinov har bir ustun
> kengligini alohida tekshiradi.

### Sekinlik — ataylab sinxron

Bu eng sekin modul (40-60 soniya). MVP'da sinxron qoldirilgan; fon rejimi
Step 5 da. Forma kutish vaqtini **oldindan** ogohlantiradi, o'tgan soniyalarni
ko'rsatadi va 45 soniyadan keyin qo'shimcha tinchlantiruvchi xabar beradi —
foydalanuvchi sahifani yopib, generatsiyani bekorga ketkazmasligi uchun.

### Routelar

| Route | Vazifasi |
| --- | --- |
| `POST /api/calendar-plans` | Generatsiya |
| `GET /api/calendar-plans` | Ro'yxat |
| `GET /api/calendar-plans/[id]` | Bitta yozuv |
| `GET /api/calendar-plans/[id]/download` | .xlsx yuklab olish |
| `DELETE /api/calendar-plans/[id]` | O'chirish (yozuv + fayl) |
| `POST /api/calendar-plans/[id]/regenerate` | Qayta generatsiya |

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
  api/presentations/...       prezentatsiya API'si + /download
  api/calendar-plans/...      kalendar reja API'si + /download
  login/ register/ dashboard/
  dashboard/lesson-plans/     ro'yxat, /new forma, /[id] natija
  dashboard/presentations/    ro'yxat, /new forma, /[id] natija
  dashboard/calendar-plans/   ro'yxat, /new forma, /[id] jadval
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
  pptx/
    generate.ts              slaydlar JSON → .pptx Buffer (AI'dan mustaqil)
    theme.ts                 rang va o'lcham sxemasi
  xlsx/
    generate.ts              reja JSON → .xlsx Buffer (AI'dan mustaqil)
    theme.ts                 rang, ustun kengliklari, chegaralar
  storage/files.ts           umumiy fayl saqlagichi (pptx + xlsx)
  calendar-plans/
    service.ts               generatsiya oqimi + token hisobi
    prompt.ts                UZ/RU/EN + tayyor hafta sanalari
    dates.ts                 hafta oraliqlarini hisoblash
  presentations/
    service.ts               generatsiya oqimi
    prompt.ts                UZ/RU/EN + dars ishlanmasi konteksti
    storage.ts               fayl saqlagichi (public'dan tashqarida)
  ui/labels.ts               modullar orasida umumiy yorliqlar
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
    presentation.ts          ikki rejim + slaydlar sxemasi
    calendar-plan.ts         kirish + haftalar/soatlar sxemasi
prisma/
  schema.prisma              DB sxemasi
  migrations/                migratsiyalar
storage/                     generatsiya qilingan .pptx va .xlsx (git'ga tushmaydi)
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
| Prezentatsiya (.pptx) | ✅ tayyor |
| Excel reja (.xlsx) | ✅ tayyor |
| .docx / .pdf eksport | ⬜ |
| Ko'p tillilik (UZ/RU/EN) | ⬜ |
| AI qidiruv (Searcher) | ⬜ |
