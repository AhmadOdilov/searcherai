import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE_URL, TestClient, cleanupTestUsers, testEmail } from "./helpers/client";

/**
 * Ikki tilli interfeys — uchidan-uchgacha.
 *
 * Sahifalar HAQIQATAN ikkala tilda render bo'lishini tekshiradi: birlik
 * sinovlari faqat tarjima fayllarini solishtiradi, lekin kalit
 * ishlatilmay qolgan bo'lsa (masalan sahifada qattiq matn qolgan) buni
 * faqat render qilingan HTML'dan ko'rish mumkin.
 */

const PASSWORD = "juda-maxfiy-parol";

/** Sahifani berilgan til bilan oladi. */
async function fetchPage(
  path: string,
  options: { cookie?: string; acceptLanguage?: string } = {},
): Promise<{ status: number; html: string }> {
  const headers: Record<string, string> = {};
  if (options.cookie !== undefined) headers.cookie = options.cookie;
  if (options.acceptLanguage !== undefined) {
    headers["accept-language"] = options.acceptLanguage;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    headers,
    redirect: "manual",
  });
  return { status: response.status, html: await response.text() };
}

/** Kirgan mijoz + uning cookie satri. */
async function signedIn(suffix: string): Promise<{
  client: TestClient;
  cookie: string;
}> {
  const client = new TestClient();
  const result = await client.request("/api/auth/register", {
    method: "POST",
    body: {
      email: testEmail(suffix),
      password: PASSWORD,
      fullName: "Sinov O'qituvchi",
    },
  });
  assert.equal(result.status, 201);

  const jar = (client as unknown as { cookies: Map<string, string> }).cookies;
  const cookie = [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");

  return { client, cookie };
}

before(async () => {
  await cleanupTestUsers();
});
after(async () => {
  await cleanupTestUsers();
});

describe("i18n — kirmagan foydalanuvchi", () => {
  it("standart tilda (o'zbek) render bo'ladi", async () => {
    const { status, html } = await fetchPage("/login");

    assert.equal(status, 200);
    assert.match(html, /lang="uz"/);
    assert.match(html, /Hisobingizga kiring/);
  });

  it("cookie orqali rus tiliga o'tadi", async () => {
    const { status, html } = await fetchPage("/login", {
      cookie: "searcher_locale=ru",
    });

    assert.equal(status, 200);
    assert.match(html, /lang="ru"/);
    assert.match(html, /Войдите в свой аккаунт/);
    assert.ok(!html.includes("Hisobingizga kiring"));
  });

  it("brauzer tilini hisobga oladi", async () => {
    const { html } = await fetchPage("/login", {
      acceptLanguage: "ru-RU,ru;q=0.9,en;q=0.8",
    });

    assert.match(html, /lang="ru"/);
    assert.match(html, /Войдите/);
  });

  it("noma'lum brauzer tilida standart tilga tushadi", async () => {
    const { html } = await fetchPage("/login", {
      acceptLanguage: "de-DE,de;q=0.9",
    });

    assert.match(html, /lang="uz"/);
  });

  it("cookie brauzer tilidan USTUN turadi", async () => {
    const { html } = await fetchPage("/login", {
      cookie: "searcher_locale=uz",
      acceptLanguage: "ru-RU,ru;q=0.9",
    });

    assert.match(html, /lang="uz"/);
    assert.match(html, /Hisobingizga kiring/);
  });

  it("ro'yxatdan o'tish sahifasi ham ikki tilda", async () => {
    const uz = await fetchPage("/register");
    assert.match(uz.html, /Yangi hisob yarating/);

    const ru = await fetchPage("/register", { cookie: "searcher_locale=ru" });
    assert.match(ru.html, /Создайте новый аккаунт/);
  });

  it("bosh sahifa ham ikki tilda", async () => {
    const uz = await fetchPage("/");
    assert.match(uz.html, /Ro&#x27;yxatdan o&#x27;tish|Ro'yxatdan o'tish/);

    const ru = await fetchPage("/", { cookie: "searcher_locale=ru" });
    assert.match(ru.html, /Зарегистрироваться/);
  });
});

describe("i18n — kirgan foydalanuvchi", () => {
  it("User.language cookie'dan USTUN turadi", async () => {
    // Foydalanuvchi boshqa qurilmadan kirsa ham o'z tilini ko'rishi kerak.
    const { client, cookie } = await signedIn("i18n-ustunlik");

    // Tilni ruschaga o'tkazamiz.
    const changed = await client.request("/api/user/language", {
      method: "PUT",
      body: { locale: "ru" },
    });
    assert.equal(changed.status, 200);

    // Cookie'ni ATAYLAB "uz" qilib yuboramiz — baza qiymati yutishi kerak.
    const withUzCookie = `${cookie}; searcher_locale=uz`;
    const { html } = await fetchPage("/dashboard", { cookie: withUzCookie });

    assert.match(html, /lang="ru"/);
    assert.match(html, /Добро пожаловать/);
  });

  it("dashboard ikkala tilda render bo'ladi", async () => {
    const { client, cookie } = await signedIn("i18n-dashboard");

    const uz = await fetchPage("/dashboard", { cookie });
    assert.equal(uz.status, 200);
    assert.match(uz.html, /Xush kelibsiz/);
    assert.match(uz.html, /Dars ishlanmasi/);

    await client.request("/api/user/language", {
      method: "PUT",
      body: { locale: "ru" },
    });

    const ru = await fetchPage("/dashboard", { cookie });
    assert.match(ru.html, /Добро пожаловать/);
    assert.match(ru.html, /План урока/);
    assert.ok(!ru.html.includes("Xush kelibsiz"));
  });

  it("har uch modulning RO'YXAT sahifasi ikkala tilda", async () => {
    const { client, cookie } = await signedIn("i18n-royxat");

    const pages = [
      {
        path: "/dashboard/lesson-plans",
        uz: "Dars ishlanmalari",
        ru: "Планы уроков",
      },
      {
        path: "/dashboard/presentations",
        uz: "Prezentatsiyalar",
        ru: "Презентации",
      },
      {
        path: "/dashboard/calendar-plans",
        uz: "Kalendar-tematik rejalar",
        ru: "Календарно-тематические планы",
      },
    ];

    for (const page of pages) {
      const uz = await fetchPage(page.path, { cookie });
      assert.equal(uz.status, 200, `${page.path} ochilishi kerak`);
      assert.ok(uz.html.includes(page.uz), `${page.path}: "${page.uz}" yo'q`);
    }

    await client.request("/api/user/language", {
      method: "PUT",
      body: { locale: "ru" },
    });

    for (const page of pages) {
      const ru = await fetchPage(page.path, { cookie });
      assert.equal(ru.status, 200);
      assert.ok(ru.html.includes(page.ru), `${page.path}: "${page.ru}" yo'q`);
      assert.ok(
        !ru.html.includes(page.uz),
        `${page.path}: rus tilida o'zbekcha "${page.uz}" qolgan`,
      );
    }
  });

  it("har uch modulning FORMA sahifasi ikkala tilda", async () => {
    const { client, cookie } = await signedIn("i18n-forma");

    const pages = [
      {
        path: "/dashboard/lesson-plans/new",
        uz: "Yangi dars ishlanmasi",
        ru: "Новый план урока",
      },
      {
        path: "/dashboard/presentations/new",
        uz: "Yangi prezentatsiya",
        ru: "Новая презентация",
      },
      {
        path: "/dashboard/calendar-plans/new",
        uz: "Yangi kalendar-tematik reja",
        ru: "Новый календарно-тематический план",
      },
    ];

    for (const page of pages) {
      const uz = await fetchPage(page.path, { cookie });
      assert.equal(uz.status, 200, `${page.path} ochilishi kerak`);
      assert.ok(uz.html.includes(page.uz), `${page.path}: "${page.uz}" yo'q`);
    }

    await client.request("/api/user/language", {
      method: "PUT",
      body: { locale: "ru" },
    });

    for (const page of pages) {
      const ru = await fetchPage(page.path, { cookie });
      assert.equal(ru.status, 200);
      assert.ok(ru.html.includes(page.ru), `${page.path}: "${page.ru}" yo'q`);
    }
  });

  it("GENERATSIYA tili tanlovi INTERFEYS tilidan mustaqil qoladi", async () => {
    // Interfeys ruscha bo'lsa ham, dars ishlanmasi formasida uch til
    // (UZ/RU/EN) tanlovi qolishi kerak — o'qituvchi darsni boshqa tilda
    // so'rashi mumkin.
    const { client, cookie } = await signedIn("i18n-generatsiya");

    await client.request("/api/user/language", {
      method: "PUT",
      body: { locale: "ru" },
    });

    const { html } = await fetchPage("/dashboard/lesson-plans/new", { cookie });

    // Interfeys ruscha
    assert.match(html, /Новый план урока/);
    // Lekin generatsiya tillari ro'yxati — uchala til
    assert.match(html, /value="UZ"/);
    assert.match(html, /value="RU"/);
    assert.match(html, /value="EN"/, "inglizcha generatsiya tanlovi qolishi kerak");
    // Va ular rus tilida nomlanadi
    assert.match(html, /Узбекский/);
    assert.match(html, /Английский/);
  });
});

describe("i18n — til almashtirish API'si", () => {
  it("kirgan foydalanuvchining tilini bazaga saqlaydi", async () => {
    const { client } = await signedIn("i18n-saqlash");

    const result = await client.request<{ locale: string }>("/api/user/language", {
      method: "PUT",
      body: { locale: "ru" },
    });

    assert.equal(result.status, 200);
    assert.equal(result.data!.locale, "ru");

    // `/api/auth/me` bazadagi qiymatni ko'rsatishi kerak.
    const me = await client.request<{ user: { language: string } }>("/api/auth/me");
    assert.equal(me.data!.user.language, "RU");
  });

  it("KIRMAGAN foydalanuvchi uchun ham ishlaydi (cookie'ga saqlaydi)", async () => {
    const anonymous = new TestClient();

    const result = await anonymous.request("/api/user/language", {
      method: "PUT",
      body: { locale: "ru" },
    });

    assert.equal(result.status, 200, "kirish talab qilinmasligi kerak");
    assert.ok(anonymous.hasCookie("searcher_locale"), "til cookie'si qo'yilishi kerak");
  });

  it("noma'lum tilni rad etadi", async () => {
    const client = new TestClient();

    const result = await client.request("/api/user/language", {
      method: "PUT",
      body: { locale: "de" },
    });

    assert.equal(result.status, 400);
    assert.equal(result.error!.code, "validation_error");
  });
});

describe("i18n — xato xabarlari", () => {
  it("validatsiya xatolari SO'ROV TILIDA qaytadi", async () => {
    const uzClient = new TestClient();
    const uzResult = await uzClient.request("/api/auth/register", {
      method: "POST",
      body: { email: "email-emas", password: "qisqa", fullName: "" },
    });

    assert.equal(uzResult.status, 400);
    const uzFields = uzResult.error!.fieldErrors!;
    assert.ok(
      uzFields.email[0].includes("format"),
      `o'zbekcha xato kutilgan, keldi: ${uzFields.email[0]}`,
    );
    // Kalit emas, tarjima qilingan matn bo'lishi kerak.
    assert.ok(!uzFields.email[0].startsWith("errors."));

    // Endi ruscha
    const ruResult = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "searcher_locale=ru",
      },
      body: JSON.stringify({
        email: "email-emas",
        password: "qisqa",
        fullName: "",
      }),
    });

    assert.equal(ruResult.status, 400);
    const ruJson = (await ruResult.json()) as {
      error: { fieldErrors: Record<string, string[]> };
    };
    assert.match(ruJson.error.fieldErrors.email[0], /[а-яА-Я]/, "ruscha xato kutilgan");
    assert.match(ruJson.error.fieldErrors.password[0], /8 символов/);
  });

  it("domen xatolari ham tarjima qilinadi", async () => {
    const { client, cookie } = await signedIn("i18n-domen");

    // DIQQAT: kirgan foydalanuvchi uchun `User.language` cookie'dan USTUN
    // turadi, shuning uchun tilni API orqali o'zgartiramiz — cookie'ni
    // qo'lda qo'yish yetarli emas.
    await client.request("/api/user/language", {
      method: "PUT",
      body: { locale: "ru" },
    });

    const ru = await fetch(`${BASE_URL}/api/lesson-plans/umuman-mavjud-emas`, {
      headers: { cookie },
    });

    assert.equal(ru.status, 404);
    const json = (await ru.json()) as {
      error: { message: string; messageKey: string };
    };
    assert.equal(json.error.messageKey, "errors.domain.lessonPlanNotFound");
    assert.match(json.error.message, /[а-яА-Я]/, "ruscha xabar kutilgan");
  });

  it("javobda kalit ham, tarjima ham bo'ladi", async () => {
    const anonymous = new TestClient();
    const result = await anonymous.request("/api/lesson-plans");

    assert.equal(result.status, 401);
    assert.equal(result.error!.code, "unauthorized");
    // Ikkalasi ham: klient xohlasa kalitdan foydalanadi.
    assert.ok(result.error!.message.length > 0);
  });
});
