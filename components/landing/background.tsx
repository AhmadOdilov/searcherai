/**
 * Bosh sahifaning fon qatlami — yumshoq gradient + nuqtali naqsh.
 *
 * ── Nega FAQAT shu sahifada ───────────────────────────────────────────────
 * Ichki sahifalar — ish quroli: u yerda fon jim bo'lishi kerak, chunki
 * o'qituvchi formani to'ldiradi va natijani o'qiydi. Bosh sahifa esa
 * birinchi taassurot: uning vazifasi "bu jiddiy, tayyor mahsulot"
 * degan hissni berish. Shuning uchun bezak shu yerda qoladi va
 * `components/ui/` dagi umumiy komponentlarga tegmaydi.
 *
 * ── Nega rasm emas ────────────────────────────────────────────────────────
 * Sekin internetda fon rasmi sahifani kechiktiradi va u eng yomon
 * joyda — birinchi ekranda ko'rinadi. Bu yerda esa bayt umuman yo'q:
 * gradient CSS'da, naqsh — bir necha qatorlik SVG.
 *
 * Ranglar TOKENLARDAN olingan (`var(--color-*)`), shuning uchun
 * qorong'i rejimda ular o'zi moslashadi — bu yerda `dark:` yozilmagan.
 */
export function LandingBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] overflow-hidden"
    >
      {/*
        Ikki dog': tepada markazda zumrad, o'ngroqda kichik amber.
        Ikkinchisi ataylab zaif — u faqat birinchisining sovuqligini
        yumshatadi, ko'zga alohida tashlanmasligi kerak.
      */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(60rem 26rem at 50% -8rem, var(--color-primary-soft), transparent 70%), " +
            "radial-gradient(38rem 18rem at 88% 6rem, var(--color-accent-soft), transparent 70%)",
        }}
      />

      {/*
        Nuqtali to'r — "daftar varag'i" hissi. Pastga qarab so'nadi,
        aks holda u mazmun bilan raqobatlashardi.
      */}
      <svg
        className="absolute inset-0 size-full text-primary-border opacity-60"
        style={{
          maskImage: "linear-gradient(to bottom, black, transparent 75%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 75%)",
        }}
      >
        <defs>
          <pattern id="landing-dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#landing-dots)" />
      </svg>
    </div>
  );
}
