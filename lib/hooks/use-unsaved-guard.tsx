"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { UnsavedDialog } from "@/components/editor/unsaved-dialog";

/**
 * Saqlanmagan o'zgarishlar qo'riqchisi — ILOVA ICHIDAGI o'tishlar uchun.
 *
 * ── Qanday bo'shliqni yopadi ──────────────────────────────────────────────
 * `useEditorDraft` dagi `beforeunload` FAQAT brauzer darajasidagi
 * chiqishni ushlaydi: sahifani yopish, yangilash, begona saytga o'tish.
 * Ilova ichidagi o'tish (`<Link>`, `router.push`) bu hodisani UMUMAN
 * ishga tushirmaydi — brauzer uchun hujjat o'zgarmagan.
 *
 * Natijada muharrirdagi saqlanmagan tahrir sarlavhadagi nom yoki
 * sozlamalar belgisini bosish bilan JIMGINA yo'qolardi: ogohlantirish
 * ham, tiklash yo'li ham yo'q edi.
 *
 * ── Nega AYNAN shu yechim ─────────────────────────────────────────────────
 * Next.js 16.3 da o'tishni to'xtatishning YAGONA rasmiy yo'li —
 * `<Link>` ning `onNavigate` propi (`preventDefault()` bilan). Hujjatda
 * bu aynan saqlanmagan forma misolida ko'rsatilgan ("Blocking
 * navigation"):
 * node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md
 *
 * Router darajasida (`router.push`) yoki brauzerning "orqaga" tugmasi
 * uchun rasmiy to'xtatuvchi YO'Q — `useRouter()` hujjatida bunday API
 * umuman sanalmagan. Shuning uchun programmatik o'tishlar
 * `requestLeave()` ni O'ZI chaqiradi.
 *
 * ── Nega `window.confirm()` emas ──────────────────────────────────────────
 * Hujjatdagi misol `window.confirm()` ishlatadi, lekin bu ilovada u mos
 * kelmaydi: brauzer oynasi inglizcha tugmalar bilan chiqadi va
 * tarjima qilinmaydi. Kod bazasida allaqachon boshqa qoida bor
 * (`record-actions.tsx`, `slide-preview.tsx`): tasdiq — sahifaning
 * o'zida, o'zbekcha matn va aniq tugmalar bilan.
 *
 * `onNavigate` SINXRON: `preventDefault()` javobni kutib bo'lmaydi.
 * Shuning uchun oqim ikki bosqichli — avval o'tish to'xtatiladi, keyin
 * foydalanuvchi qarori bo'yicha `run()` bajariladi.
 *
 * ── Nega bitta kontekst, har muharrirda alohida emas ──────────────────────
 * Chiqish yo'llari muharrir komponentidan TASHQARIDA: sarlavhadagi nom,
 * sozlamalar havolasi, chiqish tugmasi — hammasi maketda. Muharrirning
 * o'z holatiga ular yeta olmaydi.
 *
 * ── QAMRAB OLINMAGANI (halol aytilishi kerak) ─────────────────────────────
 * Brauzerning "orqaga"/"oldinga" tugmalari bu yerda USHLANMAYDI.
 * Next.js App Router `popstate` ni o'zi tinglaydi va `history.pushState`
 * ni o'zi almashtirgan (`node_modules/next/dist/client/components/
 * app-router.js`). Sentinel yozuv qo'yish odatiy hiylasi o'sha
 * ishlovchiga urilib, `__NA` belgisi yo'q yozuvda `location.reload()`
 * ga olib keladi — ya'ni qoralama TO'LIQ yo'qoladi. Xavf foydadan
 * yuqori, shuning uchun bu holat ataylab ochiq qoldirilgan.
 */

export interface UnsavedGuardApi {
  /** Muharrir saqlanmagan o'zgarish borligini bildiradi. */
  setDirty: (dirty: boolean) => void;
  /**
   * "Saqlab chiqish" tugmasi uchun saqlash funksiyasi.
   *
   * Muharrir yopilganda `null` bilan tozalanadi — aks holda qo'riqchi
   * mavjud bo'lmagan muharrirning saqlashini chaqirishga urinardi.
   */
  setSave: (save: (() => Promise<boolean>) | null) => void;
  /**
   * Saqlanmagan o'zgarish bo'lsa `run()` ni KECHIKTIRADI va `true`
   * qaytadi; u faqat foydalanuvchi rozi bo'lganda bajariladi.
   *
   * Toza bo'lsa hech narsa qilmaydi va `false` qaytadi — chaqiruvchi
   * o'tishni O'Z yo'li bilan davom ettiradi.
   *
   * Aynan shu shakl `<Link onNavigate>` uchun kerak: u yerda o'tishni
   * Next.js'ning o'zi bajaradi va biz uni TAKRORLAMASLIGIMIZ kerak.
   */
  deferIfDirty: (run: () => void) => boolean;
  /**
   * O'tishni so'raydi: toza bo'lsa `run()` DARHOL bajariladi.
   *
   * Programmatik o'tishlar uchun (`router.push`, chiqish tugmasi) —
   * u yerda bajaruvchi boshqa hech kim yo'q.
   */
  requestLeave: (run: () => void) => void;
}

/**
 * Standart qiymat — qo'riqchisiz ham kod ishlashi kerak.
 *
 * Provayder faqat `/dashboard` maketida turadi. Undan tashqarida
 * (masalan kirish sahifasida) `requestLeave` shunchaki o'tishni
 * bajaradi va hech narsa bloklanmaydi.
 */
const UnsavedGuardContext = createContext<UnsavedGuardApi>({
  setDirty: () => {},
  setSave: () => {},
  deferIfDirty: () => false,
  requestLeave: (run) => run(),
});

export function useUnsavedGuard(): UnsavedGuardApi {
  return useContext(UnsavedGuardContext);
}

export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  /*
    `dirty` REF'da, state'da emas.

    Uni faqat `requestLeave` o'qiydi va u hodisa ichida chaqiriladi.
    State qilsak, har bir tahrir bosishida butun maket (sarlavha,
    barcha havolalar) qayta render bo'lardi — foyda esa nolga teng.
  */
  const dirtyRef = useRef(false);
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);

  const [pending, setPending] = useState<{ run: () => void } | null>(null);
  const [saving, setSaving] = useState(false);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const setSave = useCallback((save: (() => Promise<boolean>) | null) => {
    saveRef.current = save;
  }, []);

  const deferIfDirty = useCallback((run: () => void) => {
    if (!dirtyRef.current) return false;
    setPending({ run });
    return true;
  }, []);

  const requestLeave = useCallback(
    (run: () => void) => {
      if (!deferIfDirty(run)) run();
    },
    [deferIfDirty],
  );

  const leave = useCallback(() => {
    const target = pending;
    setPending(null);
    if (target === null) return;
    /*
      Belgi DARHOL o'chiriladi: `run()` ichidagi `router.push` o'tish
      tugaguncha davom etadi va shu oraliqda foydalanuvchi boshqa
      havolani bosishi mumkin. Belgi qolib ketsa, u ikkinchi marta
      ogohlantirish olardi — holbuki chiqishga allaqachon rozi bo'lgan.
    */
    dirtyRef.current = false;
    target.run();
  }, [pending]);

  const saveAndLeave = useCallback(async () => {
    const save = saveRef.current;
    if (save === null) {
      leave();
      return;
    }

    setSaving(true);
    const saved = await save();
    setSaving(false);

    /*
      Saqlash yiqilsa o'tish BAJARILMAYDI va oyna ochiq qoladi.
      Aks holda foydalanuvchi "saqladim" deb o'ylab chiqib ketardi,
      ish esa yo'qolardi — bu tugmaning butun ma'nosiga zid.
    */
    if (saved) leave();
  }, [leave]);

  const api = useMemo<UnsavedGuardApi>(
    () => ({ setDirty, setSave, deferIfDirty, requestLeave }),
    [setDirty, setSave, deferIfDirty, requestLeave],
  );

  return (
    <UnsavedGuardContext.Provider value={api}>
      {children}
      {pending !== null && (
        <UnsavedDialog
          saving={saving}
          onSaveAndLeave={() => void saveAndLeave()}
          onLeave={leave}
          onStay={() => setPending(null)}
        />
      )}
    </UnsavedGuardContext.Provider>
  );
}
