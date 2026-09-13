#!/usr/bin/env bash
#
# Searcher AI — VPS'ga BIRINCHI marta o'rnatish.
#
# Ishlatish (loyiha papkasidan):
#   ./scripts/deploy.sh
#
# Skript qiladigan ishlar:
#   1. Docker va Docker Compose bor-yo'qligini tekshiradi
#   2. `.env` mavjudligini va majburiy qiymatlar to'ldirilganini tekshiradi
#   3. Butun stack'ni yig'adi va ko'taradi
#   4. Migratsiyalar qo'llanganini tasdiqlaydi
#   5. Ilova javob berayotganini `/api/health` orqali tekshiradi
#
# Skript IDEMPOTENT: qayta-qayta ishga tushirsa bo'ladi, ma'lumot yo'qolmaydi.

set -euo pipefail

# Loyiha ildiziga o'tamiz — skript qayerdan chaqirilganidan qat'i nazar.
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
ENV_EXAMPLE=".env.production.example"

# ─── Ko'rinish ───────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

step()  { printf "\n%s▸ %s%s\n" "${BOLD}${BLUE}" "$1" "${RESET}"; }
ok()    { printf "  %s✓%s %s\n" "${GREEN}" "${RESET}" "$1"; }
warn()  { printf "  %s!%s %s\n" "${YELLOW}" "${RESET}" "$1"; }
fail()  { printf "\n%s✗ %s%s\n\n" "${BOLD}${RED}" "$1" "${RESET}" >&2; exit 1; }

# ─── 1. Docker ───────────────────────────────────────────────────────────────
step "Docker tekshirilmoqda"

if ! command -v docker >/dev/null 2>&1; then
  cat >&2 <<'YORIQNOMA'

  ✗ Docker o'rnatilmagan.

  Ubuntu'da o'rnatish (rasmiy yo'l):

    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker "$USER"

  Oxirgi buyruqdan keyin tizimdan CHIQIB, qayta kiring (yoki `newgrp docker`),
  so'ng shu skriptni qaytadan ishga tushiring.

YORIQNOMA
  exit 1
fi
ok "docker: $(docker --version)"

if ! docker compose version >/dev/null 2>&1; then
  cat >&2 <<'YORIQNOMA'

  ✗ Docker Compose plagini topilmadi.

  Ubuntu'da:

    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin

  Eslatma: eski `docker-compose` (chiziqcha bilan) emas, yangi
  `docker compose` (bo'shliq bilan) kerak.

YORIQNOMA
  exit 1
fi
ok "compose: $(docker compose version --short)"

if ! docker info >/dev/null 2>&1; then
  fail "Docker demoniga ulanib bo'lmadi. \`sudo systemctl start docker\` yoki foydalanuvchini \`docker\` guruhiga qo'shing."
fi

# ─── 2. .env ─────────────────────────────────────────────────────────────────
step ".env tekshirilmoqda"

if [ ! -f "$ENV_FILE" ]; then
  if [ ! -f "$ENV_EXAMPLE" ]; then
    fail "Na $ENV_FILE, na $ENV_EXAMPLE topilmadi. Loyiha to'liq ko'chirilganmi?"
  fi
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  cat >&2 <<YORIQNOMA

  ${YELLOW}!${RESET} $ENV_FILE yo'q edi — $ENV_EXAMPLE dan nusxa olindi.

  Endi uni to'ldiring:

      nano $ENV_FILE

  ❗ belgisi qo'yilgan qatorlar majburiy:
      DOMAIN, CERTBOT_EMAIL, POSTGRES_PASSWORD, APP_URL, AUTH_SECRET, AI_API_KEY

  Sir yaratish:
      openssl rand -base64 48      # AUTH_SECRET uchun
      openssl rand -base64 32      # POSTGRES_PASSWORD uchun

  To'ldirgach shu skriptni qaytadan ishga tushiring.

YORIQNOMA
  exit 1
fi
ok "$ENV_FILE mavjud"

# Majburiy qiymatlarni tekshiramiz. `set -a` bilan o'qiymiz: kommentlar va
# tirnoqlar to'g'ri ishlanadi.
set -a
# shellcheck disable=SC1090
. "./$ENV_FILE"
set +a

missing=()
for var in DOMAIN CERTBOT_EMAIL POSTGRES_PASSWORD APP_URL AUTH_SECRET; do
  value="${!var:-}"
  if [ -z "$value" ]; then
    missing+=("$var")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  fail "$ENV_FILE da to'ldirilmagan majburiy qiymatlar: ${missing[*]}"
fi

if [ "${#AUTH_SECRET}" -lt 32 ]; then
  fail "AUTH_SECRET kamida 32 belgi bo'lishi kerak. Yarating: openssl rand -base64 48"
fi

if [ -z "${AI_API_KEY:-}" ]; then
  warn "AI_API_KEY bo'sh — ilova ishlaydi, lekin generatsiya tugmalari xato beradi."
fi

case "${APP_URL}" in
  https://*) ;;
  *) warn "APP_URL \"https://\" bilan boshlanmagan (\"$APP_URL\") — sessiya cookie'lari ishlamasligi mumkin." ;;
esac

ok "majburiy qiymatlar joyida (domen: $DOMAIN)"

# ─── 3. Stack'ni ko'tarish ───────────────────────────────────────────────────
step "Konteynerlar yig'ilmoqda va ko'tarilmoqda (birinchi safar 3-6 daqiqa)"

docker compose -f "$COMPOSE_FILE" up -d --build
ok "konteynerlar ishga tushdi"

# ─── 4. Migratsiyalar ────────────────────────────────────────────────────────
step "Migratsiyalar tekshirilmoqda"

# `migrate` xizmati `app` dan OLDIN ishlab tugagan bo'lishi kerak
# (compose'dagi `service_completed_successfully`). Shunga qaramay
# natijasini ko'rsatamiz — nimadir noto'g'ri ketsa shu yerda ko'rinadi.
migrate_exit="$(docker compose -f "$COMPOSE_FILE" ps -a --format '{{.Service}} {{.ExitCode}}' \
  | awk '$1=="migrate" {print $2; exit}')"

if [ "${migrate_exit:-}" = "0" ]; then
  ok "migratsiyalar qo'llandi"
else
  # DIQQAT: ${x:-...} ichida apostrof YOZIB BO'LMAYDI — bash uni tirnoq
  # ochilishi deb o'qiydi va butun skript sintaksisi buziladi.
  warn "migrate konteyneri kutilgandek tugamadi (chiqish kodi: ${migrate_exit:-aniqlanmadi})"
  echo
  docker compose -f "$COMPOSE_FILE" logs --no-log-prefix migrate | tail -30
  fail "Migratsiya muvaffaqiyatsiz. Yuqoridagi logga qarang."
fi

# ─── 5. Sog'lik tekshiruvi ───────────────────────────────────────────────────
step "Ilova javob berishi kutilmoqda"

health=""
for attempt in $(seq 1 30); do
  # `app` konteyneri ichidan so'raymiz: tashqi domen hali SSL'siz bo'lishi
  # mumkin, ichki tekshiruv esa DNS va sertifikatga bog'liq emas.
  if health="$(docker compose -f "$COMPOSE_FILE" exec -T app \
      wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null)"; then
    break
  fi
  printf "  … %s/30\r" "$attempt"
  sleep 3
done

if [ -z "$health" ]; then
  echo
  docker compose -f "$COMPOSE_FILE" logs --tail 40 app
  fail "Ilova 90 soniyada javob bermadi. Yuqoridagi logga qarang."
fi

printf "\n  %s\n" "$health"

case "$health" in
  *'"status":"ok"'*)  ok "ilova sog'lom, bazaga ulanish bor" ;;
  *) warn "ilova javob berdi, lekin holat \"ok\" emas — yuqoridagi javobga qarang" ;;
esac

case "$health" in
  *'"configured":true'*) ok "AI kaliti sozlangan" ;;
  *) warn "AI kaliti sozlanmagan — generatsiya ishlamaydi" ;;
esac

# ─── Yakun ───────────────────────────────────────────────────────────────────
cat <<YAKUN

${BOLD}${GREEN}Stack ko'tarildi.${RESET}

Keyingi qadam — SSL sertifikat:

    ./scripts/init-ssl.sh

Undan keyin sayt shu manzilda ochiladi:

    https://${DOMAIN}

Foydali buyruqlar:
    docker compose -f ${COMPOSE_FILE} ps          # holat
    docker compose -f ${COMPOSE_FILE} logs -f app # ilova loglari
    ./scripts/update.sh                            # keyingi yangilanishlar
    ./scripts/backup.sh                            # zaxira nusxa

YAKUN
