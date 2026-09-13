#!/bin/sh
#
# Nginx ishga tushishidan OLDIN bajariladigan sozlash.
#
# Rasmiy nginx image'ining kirish nuqtasi `/docker-entrypoint.d/` ichidagi
# `.sh` fayllarni tartib bo'yicha bajaradi va ANDAN KEYIN nginx'ni ishga
# tushiradi. Nomi `99-` bilan boshlanadi — ya'ni shablonlar (`20-envsubst…`)
# allaqachon ishlangan bo'ladi.
#
# ── Nega `command:` o'zgartirilmadi ──────────────────────────────────────────
# Dastlab qayta yuklash sikli compose'dagi `command:` ga yozilgan edi va bu
# JIM buzilishga olib keldi: rasmiy kirish nuqtasi shablonlarni FAQAT
# buyruq `nginx` bilan boshlangandagina ishlaydi. `/bin/sh -c …` yozilgani
# uchun `${DOMAIN}` almashtirilmay qoldi va sayt 404 qaytardi.

set -e

# ── 1. Standart konfiguratsiyani olib tashlaymiz ────────────────────────────
# Image ichida `default.conf` bor va unda ham `server_name localhost`.
# Ikki server bloki bir xil nomga da'vo qilsa, nginx BIRINCHISINI (alifbo
# bo'yicha `default.conf`) tanlaydi — bizning konfiguratsiya e'tiborsiz
# qolardi.
rm -f /etc/nginx/conf.d/default.conf

# ── 2. Sertifikat yangilanganda qayta yuklash ───────────────────────────────
# Certbot sertifikatni 60 kunda bir yangilaydi, lekin Nginx uni o'zi qayta
# o'qimaydi — faylni bir marta ochib, xotirada saqlaydi. Shu sikl har 6
# soatda `reload` qiladi: ulanishlar uzilmaydi, yangi sertifikat esa
# ishga tushadi.
(
  while :; do
    sleep 6h
    nginx -s reload 2>/dev/null || true
  done
) &

exit 0
