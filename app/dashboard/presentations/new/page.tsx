import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { listLessonPlanOptions } from "@/lib/presentations/service";
import { NewPresentationForm } from "@/components/presentations/new-form";

/**
 * `/dashboard/presentations/new` — prezentatsiya yaratish.
 *
 * Server Component: dars ishlanmalari ro'yxatini bazadan oladi va formaga
 * uzatadi. Forma o'zi klient komponenti (interaktiv), lekin ro'yxat uchun
 * qo'shimcha HTTP so'rov yubormaydi.
 *
 * `?lessonPlanId=` — dars ishlanmasi sahifasidagi "Shundan prezentatsiya
 * yaratish" tugmasi shu parametr bilan keladi va forma darhol to'g'ri
 * rejimda ochiladi.
 */
export default async function NewPresentationPage({
  searchParams,
}: PageProps<"/dashboard/presentations/new">) {
  const user = (await getCurrentUser())!;
  const params = await searchParams;

  const lessonPlans = await listLessonPlanOptions(user.id);

  const requested = params.lessonPlanId;
  const preselectedId = typeof requested === "string" ? requested : null;
  // Faqat foydalanuvchining O'Z ro'yxatidagi id qabul qilinadi — begona
  // id URL orqali kelsa e'tiborsiz qoldiriladi.
  const preselected =
    preselectedId !== null && lessonPlans.some((plan) => plan.id === preselectedId)
      ? preselectedId
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/dashboard/presentations"
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        ← Ro&apos;yxatga qaytish
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-slate-900">Yangi prezentatsiya</h1>
      <p className="mt-1 text-sm text-slate-500">
        Mavjud dars ishlanmasidan yoki mustaqil ravishda yaratish mumkin.
      </p>

      <NewPresentationForm
        lessonPlans={lessonPlans.map((plan) => ({
          id: plan.id,
          topic: plan.topic,
          subject: plan.subject,
          grade: plan.grade,
        }))}
        preselectedLessonPlanId={preselected}
      />
    </div>
  );
}
