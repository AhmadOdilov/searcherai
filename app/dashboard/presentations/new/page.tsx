import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listLessonPlanOptions } from "@/lib/presentations/service";
import { NewPresentationForm } from "@/components/presentations/new-form";
import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/card";
import { HelpLink } from "@/components/ui/help-link";

/**
 * `/dashboard/presentations/new` — prezentatsiya yaratish.
 *
 * Server Component: dars ishlanmalari ro'yxatini bazadan oladi va formaga
 * uzatadi. Forma o'zi klient komponenti (interaktiv), lekin ro'yxat uchun
 * qo'shimcha so'rov yubormaydi.
 *
 * `?lessonPlanId=` — dars ishlanmasi sahifasidagi "Shu darsdan
 * prezentatsiya yaratish" tugmasi shu parametr bilan keladi va forma
 * darhol to'g'ri rejimda ochiladi.
 */
export default async function NewPresentationPage({
  searchParams,
}: PageProps<"/dashboard/presentations/new">) {
  const user = (await getCurrentUser())!;
  const params = await searchParams;

  const lessonPlans = await listLessonPlanOptions(user.id);

  const t = await getTranslations("presentations");

  const requested = params.lessonPlanId;
  const preselectedId = typeof requested === "string" ? requested : null;
  // Faqat foydalanuvchining O'Z ro'yxatidagi yozuv qabul qilinadi —
  // begona manzil orqali kelsa e'tiborsiz qoldiriladi.
  const preselected =
    preselectedId !== null && lessonPlans.some((plan) => plan.id === preselectedId)
      ? preselectedId
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <BackLink href="/dashboard/presentations" />

      <div className="mt-4">
        <PageHeader title={t("new.title")} description={t("new.subtitle")} />
      </div>

      <NewPresentationForm
        lessonPlans={lessonPlans.map((plan) => ({
          id: plan.id,
          topic: plan.topic,
          subject: plan.subject,
          grade: plan.grade,
        }))}
        preselectedLessonPlanId={preselected}
      />

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6">
        <HelpLink />
      </div>
    </div>
  );
}
