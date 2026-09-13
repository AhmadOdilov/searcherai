import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { HelpLink } from "@/components/ui/help-link";

/**
 * "Sahifa topilmadi" ekrani.
 *
 * Foydalanuvchi bu yerga ikki yo'l bilan tushadi: noto'g'ri havola yoki
 * o'chirilgan materialning eski manzili. Ikkalasida ham unga kerakli
 * narsa — orqaga qaytish yo'li, tushuntirish emas. Shuning uchun
 * ekranda "404" degan raqam YO'Q: u foydalanuvchiga hech narsa
 * bildirmaydi.
 */
export default async function NotFound() {
  const t = await getTranslations("notFoundPage");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md text-center">
        <div
          aria-hidden
          className="mx-auto mb-6 flex size-16 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500"
        >
          <Compass className="size-9" />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          {t("description")}
        </p>

        <div className="mt-8">
          <LinkButton href="/dashboard" size="lg" fullWidth>
            {t("goHome")}
          </LinkButton>
        </div>

        <div className="mt-8 flex justify-center">
          <HelpLink />
        </div>
      </div>
    </main>
  );
}
