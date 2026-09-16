"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { useUnsavedGuard } from "@/lib/hooks/use-unsaved-guard";

/**
 * Tahrirlash qoralamasi — uchala muharrir uchun UMUMIY asos.
 *
 * ── Nega bitta hook ───────────────────────────────────────────────────────
 * Prezentatsiya, kalendar reja va dars ishlanmasi muharrirlari boshqa
 * narsani tahrirlaydi, lekin ATROFIDAGI mantiq bir xil: qoralama holati,
 * "o'zgartirildimi" belgisi, saqlash so'rovi, saqlash holati, saqlanmagan
 * o'zgarishlar ogohlantirishi. Uchta nusxa uchta xil xatoga olib kelardi.
 *
 * ── Nega avtosaqlash YO'Q ─────────────────────────────────────────────────
 * Avtosaqlash har bosishda .pptx/.xlsx faylni qayta yasardi — bu server
 * ishi va foydalanuvchi uchun ko'rinmas. Bundan tashqari o'qituvchi
 * "tasodifan o'chirib yubordim" degan holatda ortga qaytish imkonini
 * yo'qotardi. Shuning uchun saqlash ANIQ: tugma bosiladi.
 *
 * ── Holat nomlari real ────────────────────────────────────────────────────
 * `saving` faqat so'rov ketayotganda, `saved` faqat server tasdiqlagach.
 * Soxta progress yo'q: fayl qayta yasalishi odatda bir soniyadan kam.
 */

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseEditorDraftOptions<T> {
  /** API manzili, masalan "/api/presentations/abc123". */
  endpoint: string;
  /** Serverdan kelgan boshlang'ich mazmun. */
  initial: T;
  /** So'rov tanasining kaliti — serverdagi sxemaga mos ("content"). */
  bodyKey?: string;
}

export interface UseEditorDraftResult<T> {
  draft: T;
  /** Qoralamani o'zgartiradi. Funksiya ham berilishi mumkin. */
  update: (next: T | ((current: T) => T)) => void;
  /** Saqlanmagan o'zgarish bormi. */
  dirty: boolean;
  status: SaveStatus;
  /** Saqlash xatosi — foydalanuvchiga ko'rsatiladigan matn. */
  error: string | null;
  /** Maydon bo'yicha xatolar — server tekshiruvi rad etgan bo'lsa. */
  fieldErrors: Record<string, string[]> | null;
  save: () => Promise<boolean>;
  /** Qoralamani oxirgi saqlangan holatga qaytaradi. */
  discard: () => void;
}

export function useEditorDraft<T>({
  endpoint,
  initial,
  bodyKey = "content",
}: UseEditorDraftOptions<T>): UseEditorDraftResult<T> {
  const router = useRouter();

  const [draft, setDraft] = useState<T>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);

  /*
    Oxirgi SAQLANGAN holat.

    `initial` prop'i emas: saqlagandan keyin qoralama yangi asosga
    aylanadi, aks holda "saqlanmagan o'zgarish bor" belgisi saqlashdan
    keyin ham yonib turardi.
  */
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(initial));

  const serialized = useMemo(() => JSON.stringify(draft), [draft]);
  const dirty = serialized !== baseline;

  const update = useCallback((next: T | ((current: T) => T)) => {
    setDraft((current) =>
      typeof next === "function" ? (next as (c: T) => T)(current) : next,
    );
    /*
      Har qanday o'zgarishda "saqlandi" belgisi so'nadi — aks holda
      foydalanuvchi o'zgartirgandan keyin ham yashil "Saqlandi" ni ko'rib,
      ishi saqlangan deb o'ylardi.
    */
    setStatus((current) => (current === "saved" ? "idle" : current));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    setStatus("saving");
    setError(null);
    setFieldErrors(null);

    try {
      await apiRequest(endpoint, {
        method: "PATCH",
        body: { [bodyKey]: draft },
      });

      setBaseline(JSON.stringify(draft));
      setStatus("saved");
      /*
        Server Component'ni qayta o'qitamiz: yuklab olish paneli yangi
        fayl hajmini va slaydlar sonini ko'rsatishi kerak.
      */
      router.refresh();
      return true;
    } catch (caught) {
      setStatus("error");
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors ?? null);
      } else {
        // Tarmoq uzilgan yoki server javob bermadi.
        setError(null);
      }
      return false;
    }
  }, [bodyKey, draft, endpoint, router]);

  const discard = useCallback(() => {
    setDraft(JSON.parse(baseline) as T);
    setStatus("idle");
    setError(null);
    setFieldErrors(null);
  }, [baseline]);

  /*
    ── Saqlanmagan o'zgarishlar: brauzer darajasi ─────────────────────────
    Sahifani yopish, yangilash yoki boshqa saytga o'tishda brauzer o'z
    ogohlantirishini ko'rsatadi. Matnni belgilab bo'lmaydi — brauzerlar
    uni ataylab e'tiborsiz qoldiradi (foydalanuvchini qo'rqitadigan
    soxta xabarlarning oldini olish uchun).

    Ilova ICHIDAGI o'tishlar bu hodisani ishga tushirmaydi — ular
    pastdagi qo'riqchi orqali tekshiriladi.
  */
  /*
    `dirty` ni ref'da saqlaymiz: hodisa tinglovchisi BIR MARTA
    ro'yxatdan o'tadi va u yaratilgan paytdagi qiymatni "yodda tutib"
    qolmasligi kerak. Ref render paytida emas, effekt ichida
    yangilanadi — React qoidasi shuni talab qiladi.
  */
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /*
    ── Saqlanmagan o'zgarishlar: ILOVA ICHIDAGI o'tishlar ─────────────────
    `beforeunload` klient navigatsiyasida UMUMAN ishga tushmaydi —
    brauzer uchun hujjat o'zgarmaydi. Ya'ni sarlavhadagi nom yoki
    sozlamalar havolasi bosilganda qoralama jimgina yo'qolardi.

    Qo'riqchi shu bo'shliqni yopadi: u maketda turadi va o'tish
    yo'llarining hammasi (havolalar, chiqish tugmasi, muharrirning o'z
    «orqaga» tugmasi) undan so'rab o'tadi.
    Batafsil: lib/hooks/use-unsaved-guard.tsx
  */
  const { setDirty, setSave } = useUnsavedGuard();

  useEffect(() => {
    setDirty(dirty);
    /*
      Muharrir yopilganda belgi TOZALANADI. Aks holda foydalanuvchi
      muharrirdan chiqqandan keyin ham butun ilova bo'ylab
      ogohlantirish olaverardi.
    */
    return () => setDirty(false);
  }, [dirty, setDirty]);

  useEffect(() => {
    setSave(save);
    return () => setSave(null);
  }, [save, setSave]);

  return { draft, update, dirty, status, error, fieldErrors, save, discard };
}
