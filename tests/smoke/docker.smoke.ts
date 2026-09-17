import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTAINER_NAME,
  IMAGE_TAG,
  SMOKE_BASE_URL,
  docker,
  waitForHealth,
} from "./helpers/target.ts";

/**
 * Docker yo'li — HAQIQATAN joylashtiriladigan image.
 *
 * `standalone.smoke.ts` build natijasiga qaraydi; bu yerda esa
 * `Dockerfile` dan yig'ilgan image va undan ko'tarilgan konteyner
 * tekshiriladi. Ikkalasi bir xil emas: image'ga faqat `runner`
 * bosqichiga ko'chirilgan narsa tushadi va aynan o'sha nusxa serverga
 * boradi.
 *
 * Bu fayl to'plamning OXIRIDA ishlaydi (`package.json` dagi tartib):
 * ichida konteynerni to'xtatib qayta ishga tushiradigan sinov bor va
 * u boshqa fayllarga xalaqit bermasligi kerak.
 */

/** `docker inspect` natijasidan bitta maydonni oladi. */
async function inspect(target: string, format: string): Promise<string> {
  const stdout = await docker(["inspect", "--format", format, target]);
  return stdout.trim();
}

describe("image — sirlar va tarkib", () => {
  it("image muhitida AUTH_SECRET / DATABASE_URL / AI_API_KEY YO'Q", async () => {
    /*
      Eng ehtimolli sizish yo'li aynan shu: `Dockerfile` da build
      uchun qo'yilgan `ENV AUTH_SECRET=...` yakuniy bosqichga o'tib
      ketishi mumkin. `docker image inspect` uni darhol ko'rsatadi.
    */
    const raw = await inspect(IMAGE_TAG, "{{json .Config.Env}}");
    const env = JSON.parse(raw) as string[];
    const names = env.map((entry) => entry.split("=")[0]);

    for (const secret of ["AUTH_SECRET", "DATABASE_URL", "AI_API_KEY", "S3_SECRET_KEY"]) {
      assert.ok(!names.includes(secret), `image muhitida ${secret} qolgan`);
    }
  });

  it("image ichida .env fayli YO'Q", async () => {
    const stdout = await docker([
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      IMAGE_TAG,
      "-c",
      "find /app -maxdepth 2 -name '.env*' -not -path '*/node_modules/*' 2>/dev/null || true",
    ]);

    assert.equal(stdout.trim(), "", `image ichida .env topildi:\n${stdout}`);
  });

  it("image ichidagi fayllarda sir qiymati YO'Q", async () => {
    /*
      Qidiriladigan qiymatlar konteynerga STDIN orqali beriladi —
      buyruq qatorida emas. Aks holda ular `docker inspect` va
      xostdagi `ps` chiqishida ko'rinib qolardi.
    */
    const secrets = ["AUTH_SECRET", "AI_API_KEY", "DATABASE_URL"]
      .map((name) => process.env[name])
      .filter((value): value is string => value !== undefined && value.length >= 16);

    assert.ok(secrets.length > 0, "tekshirish uchun sir topilmadi — muhit sozlanmagan");

    const stdout = await docker(
      [
        "run",
        "--rm",
        "-i",
        "--entrypoint",
        "sh",
        IMAGE_TAG,
        "-c",
        "grep -rlF -f - /app/server.js /app/.next 2>/dev/null || true",
      ],
      `${secrets.join("\n")}\n`,
    );

    // Faqat YO'L chiqadi, qiymat emas.
    assert.equal(stdout.trim(), "", `image faylida sir qiymati topildi:\n${stdout}`);
  });

  it("image'da o'qituvchilarning fayllari va manba kodi YO'Q", async () => {
    const stdout = await docker([
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      IMAGE_TAG,
      "-c",
      "find /app/storage -type f 2>/dev/null; " +
        "find /app -maxdepth 2 \\( -name tests -o -name '*.md' -o -name Dockerfile " +
        "-o -name 'docker-compose*' -o -name nginx -o -name prisma \\) " +
        "-not -path '*/node_modules/*' 2>/dev/null || true",
    ]);

    assert.equal(stdout.trim(), "", `image'da ortiqcha fayllar bor:\n${stdout}`);
  });
});

describe("konteyner — ishlash sharoiti", () => {
  it("root EMAS foydalanuvchi nomidan ishlaydi", async () => {
    const uid = (await docker(["exec", CONTAINER_NAME, "id", "-u"])).trim();

    assert.notEqual(uid, "0", "konteyner root nomidan ishlayapti");
    assert.equal(uid, "1001", "kutilgan uid 1001 (nextjs)");
  });

  it("faqat saqlagich papkasi yozuvga ochiq", async () => {
    const writableStorage = await docker([
      "exec",
      CONTAINER_NAME,
      "sh",
      "-c",
      "touch /app/storage/.smoke-yozuv && rm /app/storage/.smoke-yozuv && echo ha",
    ]);
    assert.equal(writableStorage.trim(), "ha", "saqlagich yozuvga ochiq emas");

    const appRoot = await docker([
      "exec",
      CONTAINER_NAME,
      "sh",
      "-c",
      "touch /app/.smoke-yozuv 2>/dev/null && echo ochiq || echo yopiq",
    ]);
    assert.equal(appRoot.trim(), "yopiq", "ilova ildizi yozuvga ochiq qolgan");
  });

  it("faqat 3000-port e'lon qilingan", async () => {
    const raw = await inspect(IMAGE_TAG, "{{json .Config.ExposedPorts}}");
    const ports = Object.keys(JSON.parse(raw) as Record<string, unknown>);

    assert.deepEqual(ports, ["3000/tcp"]);
  });

  it("Docker HEALTHCHECK `healthy` holatiga o'tadi", async () => {
    /*
      `Dockerfile` da `--start-period=40s`, ya'ni birinchi natija
      darhol kelmaydi. Bu tekshiruv orkestratorning (compose, swarm)
      "ilova tayyor" qarori aynan shu image'da ishlashini isbotlaydi.
    */
    const deadline = Date.now() + 150_000;
    let status = "";

    while (Date.now() < deadline) {
      status = await inspect(CONTAINER_NAME, "{{.State.Health.Status}}");
      if (status === "healthy") break;
      assert.notEqual(status, "unhealthy", "healthcheck `unhealthy` qaytardi");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    assert.equal(status, "healthy", `healthcheck holati: ${status}`);
  });
});

describe("konteyner — to'xtatish va qayta ko'tarilish", () => {
  it("SIGTERM bilan TOZA to'xtaydi va qaytadan ko'tariladi", async () => {
    /*
      Nega muhim: deploy har safar konteynerga SIGTERM yuboradi. Agar
      jarayon unga javob bermasa, Docker kutib turadi va keyin
      SIGKILL qiladi (exit 137) — ya'ni har bir deploy ishlayotgan
      so'rovlarni o'rtasidan uzadi.

      Toza to'xtash 143 (128 + SIGTERM) qaytaradi.
    */
    const startedAt = Date.now();
    await docker(["stop", "-t", "30", CONTAINER_NAME]);
    const elapsed = Date.now() - startedAt;

    const exitCode = await inspect(CONTAINER_NAME, "{{.State.ExitCode}}");
    assert.equal(exitCode, "143", `kutilgan 143 (SIGTERM), kelgan ${exitCode}`);
    assert.ok(elapsed < 20_000, `to'xtash juda uzoq davom etdi: ${elapsed}ms`);

    // Qayta ko'tarilish — restart siyosati shu holatga tayanadi.
    await docker(["start", CONTAINER_NAME]);
    await waitForHealth(SMOKE_BASE_URL);

    const response = await fetch(`${SMOKE_BASE_URL}/api/health`);
    assert.equal(response.status, 200, "qayta ko'tarilgandan keyin javob bermadi");
  });
});
