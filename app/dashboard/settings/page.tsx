import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { SettingsPanels } from "@/components/settings/settings-panels";
import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/card";

/**
 * `/dashboard/settings` — hisob sozlamalari.
 *
 * ── Nega telefon bazadan QAYTA o'qiladi ───────────────────────────────────
 * `getCurrentUser()` faqat sessiya uchun kerak bo'lgan maydonlarni
 * tanlaydi (`lib/auth/session.ts` dagi `SessionUser`) va `phone` u
 * yerda yo'q. Uni sessiya obyektiga qo'shish har sahifada keraksiz
 * ustun o'qish demakdir — bu maydon faqat shu yerda kerak.
 */
export default async function SettingsPage() {
  const user = (await getCurrentUser())!;
  const t = await getTranslations("settings");

  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { fullName: true, email: true, phone: true },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <BackLink href="/dashboard" labelKey="backToDashboard" />

      <PageHeader title={t("title")} description={t("pageHint")} />

      <div className="mt-8">
        <SettingsPanels user={record} />
      </div>
    </div>
  );
}
