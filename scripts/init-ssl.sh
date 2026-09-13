#!/usr/bin/env bash
#
# Searcher AI — Let's Encrypt sertifikatini BIRINCHI marta olish.
#
# Ishlatish:
#   ./scripts/init-ssl.sh            # haqiqiy sertifikat
#   ./scripts/init-ssl.sh --sinov    # sinov rejimi (staging)
#
# ── Muammo va yechim ─────────────────────────────────────────────────────────
# Tovuq-tuxum masalasi: Nginx konfiguratsiyasida `ssl_certificate` ko'rsatilgan,
# ya'ni sertifikat bo'lmasa Nginx UMUMAN ishga tushmaydi. Certbot esa
# tekshiruvni HTTP orqali o'tkazadi — buning uchun Nginx ishlab turishi kerak.
#
# Yechim uch qadamda:
#   1. VAQTINCHALIK o'z-o'zini imzolagan sertifikat yaratamiz (Nginx ko'tariladi)
#   2. Certbot haqiqiy sertifikatni oladi (Nginx tekshiruvni o'tkazadi)
#   3. Nginx qayta yuklanadi va haqiqiy sertifikat ishga tushadi
#
# ── Sinov rejimi haqida ──────────────────────────────────────────────────────
# Let's Encrypt haftasiga bitta domen uchun 5 ta muvaffaqiyatsiz urinishga
# ruxsat beradi. DNS hali tarqalmagan bo'lsa limitni yeb qo'yish oson,
# shuning uchun ISHONCHINGIZ komil bo'lmasa avval `--sinov` bilan urinib
# ko'ring: u cheksiz, lekin brauzer ishonmaydigan sertifikat beradi.

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

if [ -t 1 ]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi
step() { printf "\n%s▸ %s%s\n" "${BOLD}${BLUE}" "$1" "${RESET}"; }
ok()   { printf "  %s✓%s %s\n" "${GREEN}" "${RESET}" "$1"; }
warn() { printf "  %s!%s %s\n" "${YELLOW}" "${RESET}" "$1"; }
fail() { printf "\n%s✗ %s%s\n\n" "${BOLD}${RED}" "$1" "${RESET}" >&2; exit 1; }

STAGING=0
if [ "${1:-}" = "--sinov" ] || [ "${1:-}" = "--staging" ]; then
  STAGING=1
fi

[ -f "$ENV_FILE" ] || fail "$ENV_FILE topilmadi. Avval ./scripts/deploy.sh ni ishga tushiring."

set -a
# shellcheck disable=SC1090
. "./$ENV_FILE"
set +a

[ -n "${DOMAIN:-}" ]        || fail "DOMAIN $ENV_FILE da ko'rsatilmagan."
[ -n "${CERTBOT_EMAIL:-}" ] || fail "CERTBOT_EMAIL $ENV_FILE da ko'rsatilmagan."

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"

# ─── 0. DNS tekshiruvi ───────────────────────────────────────────────────────
step "DNS tekshirilmoqda: $DOMAIN"

server_ip="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo "")"
domain_ip="$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || echo "")"

if [ -n "$server_ip" ] && [ -n "$domain_ip" ]; then
  if [ "$server_ip" = "$domain_ip" ]; then
    ok "$DOMAIN → $domain_ip (shu server)"
  else
    warn "$DOMAIN → $domain_ip, lekin server IP'si $server_ip"
    warn "DNS hali tarqalmagan bo'lishi mumkin. Sertifikat olinmasa 10-30 daqiqadan keyin urinib ko'ring."
  fi
elif [ -z "$domain_ip" ]; then
  warn "$DOMAIN uchun DNS yozuvi topilmadi — A yozuvi qo'shilganmi?"
else
  warn "Server IP'sini aniqlab bo'lmadi (internet cheklanganmi?) — davom etamiz."
fi

# ─── 1. Vaqtinchalik sertifikat ──────────────────────────────────────────────
step "Nginx ko'tarilishi uchun vaqtinchalik sertifikat"

if compose run --rm --entrypoint sh certbot -c "[ -f ${CERT_PATH}/fullchain.pem ]" 2>/dev/null; then
  ok "sertifikat allaqachon bor — vaqtinchalik yaratilmadi"
else
  compose run --rm --entrypoint sh certbot -c "
    set -e
    mkdir -p ${CERT_PATH}
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout ${CERT_PATH}/privkey.pem \
      -out ${CERT_PATH}/fullchain.pem \
      -subj '/CN=${DOMAIN}' 2>/dev/null
  "
  ok "vaqtinchalik (o'z-o'zini imzolagan) sertifikat yaratildi"
fi

# ─── 2. Nginx ────────────────────────────────────────────────────────────────
step "Nginx ishga tushirilmoqda"

compose up -d nginx
sleep 3

if ! compose ps nginx --format '{{.State}}' | grep -q running; then
  compose logs --tail 30 nginx
  fail "Nginx ko'tarilmadi. Yuqoridagi logga qarang."
fi
ok "Nginx ishlayapti (80 va 443 portlarida)"

# ─── 3. Haqiqiy sertifikat ───────────────────────────────────────────────────
step "Let's Encrypt sertifikati so'ralmoqda"

staging_flag=""
if [ "$STAGING" = "1" ]; then
  staging_flag="--staging"
  warn "SINOV rejimi: brauzer bu sertifikatga ishonmaydi (bu normal)."
fi

# Vaqtinchalik sertifikatni olib tashlaymiz — aks holda certbot uni
# "allaqachon bor" deb hisoblab, yangilashdan bosh tortishi mumkin.
compose run --rm --entrypoint sh certbot -c "rm -rf ${CERT_PATH} /etc/letsencrypt/archive/${DOMAIN} /etc/letsencrypt/renewal/${DOMAIN}.conf" || true

if compose run --rm --entrypoint certbot certbot \
    certonly --webroot -w /var/www/certbot \
    --domain "$DOMAIN" \
    --email "$CERTBOT_EMAIL" \
    --agree-tos --no-eff-email \
    --non-interactive \
    $staging_flag; then
  ok "sertifikat olindi"
else
  cat >&2 <<YORIQNOMA

  ${RED}✗${RESET} Sertifikat olinmadi. Eng ko'p uchraydigan sabablar:

    1. DNS A yozuvi hali bu serverga ko'rsatmayapti
       Tekshirish:  dig +short ${DOMAIN}

    2. 80-port tashqaridan yopiq (VPS provayderning firewall'i)
       Tekshirish:  sudo ufw status
       Ochish:      sudo ufw allow 80/tcp && sudo ufw allow 443/tcp

    3. Limitga yetildi (haftasiga 5 ta muvaffaqiyatsiz urinish)
       Yechim: bir necha soat kuting yoki avval  ./scripts/init-ssl.sh --sinov

  Nginx hozir VAQTINCHALIK sertifikat bilan ishlab turibdi — sayt ochiladi,
  lekin brauzer ogohlantirish beradi.

YORIQNOMA
  exit 1
fi

# ─── 4. Nginx'ni qayta yuklash ───────────────────────────────────────────────
step "Nginx yangi sertifikat bilan qayta yuklanmoqda"

compose exec nginx nginx -s reload
ok "qayta yuklandi"

# ─── 5. Tekshiruv ────────────────────────────────────────────────────────────
step "Sayt tekshirilmoqda"

curl_flags="-fsS --max-time 15"
[ "$STAGING" = "1" ] && curl_flags="$curl_flags -k"

# shellcheck disable=SC2086
if response="$(curl $curl_flags "https://${DOMAIN}/api/health" 2>&1)"; then
  printf "  %s\n" "$response"
  ok "https://${DOMAIN} ishlayapti"
else
  warn "Tashqaridan tekshirib bo'lmadi: $response"
  warn "Brauzerda ochib ko'ring: https://${DOMAIN}"
fi

cat <<YAKUN

${BOLD}${GREEN}SSL sozlandi.${RESET}

  Sayt:  https://${DOMAIN}

Sertifikat 90 kun amal qiladi va `certbot` konteyneri uni avtomatik
yangilab turadi (har 12 soatda tekshiradi, oxirgi 30 kunda yangilaydi).
Sizdan hech narsa talab qilinmaydi.

YAKUN
