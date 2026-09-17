import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { BASE_URL, TestClient, cleanupTestUsers, testEmail } from "./helpers/client";
import { htmlIncludes, text } from "./helpers/messages";

/**
 * "Biz haqimizda" sahifasi — uchidan-uchgacha.
 *
 * Uch narsa tekshiriladi:
 *  1. sahifa to'liq render bo'ladi (barcha beshta bo'lim);
 *  2. u HAMMAGA ochiq — kirgan foydalanuvchi ham `/dashboard` ga
 *     YO'NALTIRILMAYDI (bosh sahifadan asosiy farqi shu);
 *  3. bosh sahifadan unga havola BOR — sahifa mavjud bo'lib, hech
 *     kimga ko'rinmasligi eng oson sodir bo'ladigan nosozlik.
 */

const PASSWORD = "juda-maxfiy-parol";

after(async () => {
  await cleanupTestUsers();
});

async function fetchAbout(
  options: { cookie?: string } = {},
): Promise<{ status: number; html: string }> {
  const headers: Record<string, string> = {};
  if (options.cookie !== undefined) headers.cookie = options.cookie;

  const response = await fetch(`${BASE_URL}/about`, { headers, redirect: "manual" });
  return { status: response.status, html: await response.text() };
}

describe("«biz haqimizda» sahifasi", () => {
  it("ochiladi va sarlavha bilan yetakchi matnni ko'rsatadi", async () => {
    const { status, html } = await fetchAbout();

    assert.equal(status, 200, "sahifa hammaga ochiq bo'lishi kerak");
    assert.ok(htmlIncludes(html, text("uz", "about.title")), "sarlavha yo'q");
    assert.ok(htmlIncludes(html, text("uz", "about.lead")), "yetakchi matn yo'q");
  });

  it("loyiha hikoyasi uchala paragraf bilan to'liq", async () => {
    /*
      Uchinchi paragraf ALOHIDA muhim: u "AI o'qituvchining o'rnini
      bosadi" degan qo'rquvga javob beradi. Matn qisqartirilganda
      birinchi bo'lib o'sha yo'qoladi.
    */
    const { html } = await fetchAbout();

    for (const paragraph of ["p1", "p2", "p3"]) {
      assert.ok(
        htmlIncludes(html, text("uz", `about.story.${paragraph}`)),
        `hikoyaning ${paragraph} qismi yo'q`,
      );
    }
  });

  it("jamoa nomi va joylashuvi ko'rsatilgan", async () => {
    const { html } = await fetchAbout();

    assert.ok(htmlIncludes(html, text("uz", "about.team.name")), "jamoa nomi yo'q");
    assert.ok(
      htmlIncludes(html, text("uz", "about.team.location")),
      "jamoa joylashuvi yo'q",
    );
    assert.ok(
      htmlIncludes(html, text("uz", "about.team.description")),
      "jamoa tavsifi yo'q",
    );
  });

  it("«qanday ishlaydi» to'rtala bandi bilan tushuntirilgan", async () => {
    const { html } = await fetchAbout();

    for (const item of ["ai", "curriculum", "files", "privacy"]) {
      assert.ok(
        htmlIncludes(html, text("uz", `about.how.${item}.title`)),
        `${item} bandi sahifada yo'q`,
      );
      assert.ok(
        htmlIncludes(html, text("uz", `about.how.${item}.description`)),
        `${item} bandining tavsifi yo'q`,
      );
    }
  });

  it("narx va cheklov BIRGA aytilgan", async () => {
    /*
      "Bepul" so'zi yolg'iz qolsa, birinchi cheklovga urilgan odam
      aldanganday his qiladi — shuning uchun ikkalasi ham shart.
    */
    const { html } = await fetchAbout();

    assert.ok(
      htmlIncludes(html, text("uz", "about.price.description")),
      "narx haqida aytilmagan",
    );
    assert.ok(htmlIncludes(html, text("uz", "about.price.note")), "cheklov aytilmagan");
  });

  it("bog'lanish uchun Telegram havolasi bor", async () => {
    const { html } = await fetchAbout();

    assert.ok(
      htmlIncludes(html, text("uz", "about.contact.description")),
      "bog'lanish matni yo'q",
    );
    // Manzil `lib/ui/support.ts` da — sahifaga qo'lda yozilmagan.
    assert.match(html, /href="https:\/\/t\.me\//, "Telegram havolasi yo'q");
  });

  it("bosh sahifaga qaytish yo'li bor", async () => {
    const { html } = await fetchAbout();

    assert.ok(htmlIncludes(html, text("uz", "about.backHome")), "qaytish havolasi yo'q");
    assert.match(html, /href="\/"/);
  });

  it("rus tilida ham render bo'ladi", async () => {
    const { status, html } = await fetchAbout({ cookie: "searcher_locale=ru" });

    assert.equal(status, 200);
    assert.match(html, /lang="ru"/);
    assert.ok(htmlIncludes(html, text("ru", "about.story.p1")));
    assert.ok(!htmlIncludes(html, text("uz", "about.story.p1")));
  });

  it("kirgan foydalanuvchi uchun ham ochiq qoladi", async () => {
    /*
      Bosh sahifadan asosiy farqi: `/` kirgan odamni `/dashboard` ga
      yo'naltiradi, `/about` esa YO'Q. "Biz kimmiz?" savoli ro'yxatdan
      o'tgandan keyin ham paydo bo'ladi.
    */
    const client = new TestClient();
    const registered = await client.request("/api/auth/register", {
      method: "POST",
      body: {
        email: testEmail("about-ochiq"),
        password: PASSWORD,
        fullName: "Sinov O'qituvchi",
      },
    });
    assert.equal(registered.status, 201);

    const visited = await client.visit("/about");

    assert.equal(visited.status, 200, `kutilgan 200, kelgan: ${visited.status}`);
  });
});

describe("bosh sahifadagi havola", () => {
  it("«biz haqimizda» sahifasiga olib boradi", async () => {
    const response = await fetch(`${BASE_URL}/`, { redirect: "manual" });
    const html = await response.text();

    assert.ok(htmlIncludes(html, text("uz", "landing.about")), "havola matni yo'q");
    assert.match(html, /href="\/about"/, "havola manzili yo'q");
  });
});
