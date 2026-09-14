import { Card } from "@/components/ui/card";

/**
 * "Qanday ishlaydi" — uch qadam, orasida nuqtali yo'l.
 *
 * ── Nima uchun chiziq ─────────────────────────────────────────────────────
 * Uchta karta yonma-yon turganda ular "tanlov" kabi o'qiladi: odam
 * "qaysi birini tanlayman?" deb o'ylaydi. Nuqtali yo'l esa ularni
 * KETMA-KETLIKKA aylantiradi — 1 dan 3 gacha bitta yo'l.
 *
 * ── Nega raqam kartaning USTIDA ───────────────────────────────────────────
 * Raqam karta ichida turganda chiziqni kartalar to'sib qo'yadi va u
 * faqat oralig'idagi kichik bo'laklarda ko'rinadi — "yo'l" hissi
 * yo'qoladi. Raqam tashqariga chiqarilganda esa chiziq ular orasidan
 * to'siqsiz o'tadi.
 *
 * Telefonda yo'l tik (kartalar ustma-ust), kengroq ekranda yotiq.
 */
export function LandingSteps({
  steps,
}: {
  steps: Array<{ key: string; title: string; description: string }>;
}) {
  return (
    <ol className="relative mt-8 grid gap-0 sm:grid-cols-3 sm:gap-4">
      {/*
        Yotiq yo'l — doiralar markazi balandligida (doira 2.5rem, ya'ni
        markazi 1.25rem). Chetlari birinchi va oxirgi doiragacha
        yetadi, undan nariga o'tmaydi.
      */}
      <span
        aria-hidden
        className="absolute top-5 right-[16%] left-[16%] hidden border-t-2 border-dashed border-primary-border sm:block"
      />

      {steps.map((step, index) => (
        <li key={step.key} className="flex flex-col items-stretch">
          <span
            aria-hidden
            className="relative z-10 flex size-10 items-center justify-center self-start rounded-full border border-primary-border bg-primary-soft text-lg font-semibold text-primary-ink sm:self-center"
          >
            {index + 1}
          </span>

          <Card padding="sm" className="mt-3 h-full">
            <h3 className="text-lg font-semibold text-neutral-900">{step.title}</h3>
            <p className="mt-1 text-base leading-relaxed text-neutral-600">
              {step.description}
            </p>
          </Card>

          {/* Tik yo'l — faqat telefonda va faqat kartalar ORASIDA. */}
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className="ml-5 h-6 border-l-2 border-dashed border-primary-border sm:hidden"
            />
          )}
        </li>
      ))}
    </ol>
  );
}
