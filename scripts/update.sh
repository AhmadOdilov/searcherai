#!/usr/bin/env bash
#
# Searcher AI — ishlab turgan serverni yangilash.
#
# Ishlatish:
#   ./scripts/update.sh              # git pull + qayta build + migratsiya
#   ./scripts/update.sh --no-pull    # kod allaqachon yangilangan bo'lsa
#
# ── To'xtash vaqti (downtime) haqida ─────────────────────────────────────────
# Yangi image BUTUNLAY yig'ilib bo'lgandan KEYIN eski konteyner
# almashtiriladi. Ya'ni build davomida (2-5 daqiqa) sayt ishlab turadi,
# to'xtash faqat konteyner almashuvida — 2-5 soniya.
#
# Nolinchi to'xtash uchun ikki nusxa (blue-green) kerak bo'lardi; bitta
# VPS'dagi MVP uchun bu ortiqcha murakkablik.

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.prod.yml"

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

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

[ -f .env ] || fail ".env topilmadi. Avval ./scripts/deploy.sh ni ishga tushiring."

PULL=1
[ "${1:-}" = "--no-pull" ] && PULL=0

# ─── 0. Zaxira ───────────────────────────────────────────────────────────────
# Migratsiya ma'lumotni o'zgartiradi. Yangilanishdan OLDIN nusxa olish —
# eng arzon sug'urta.
step "Yangilanishdan oldingi zaxira nusxa"
if [ -x ./scripts/backup.sh ]; then
  ./scripts/backup.sh --jim && ok "zaxira olindi (backups/ papkasida)"
else
  warn "scripts/backup.sh topilmadi yoki bajariladigan emas — zaxirasiz davom etamiz"
fi

# ─── 1. Kod ──────────────────────────────────────────────────────────────────
if [ "$PULL" = "1" ]; then
  step "Yangi kod olinmoqda"

  if [ ! -d .git ]; then
    fail "Bu papka git omboriga o'xshamaydi. Kodni qo'lda yangilab, --no-pull bilan ishga tushiring."
  fi

  before="$(git rev-parse --short HEAD)"
  git pull --ff-only
  after="$(git rev-parse --short HEAD)"

  if [ "$before" = "$after" ]; then
    ok "kod allaqachon eng yangi ($after) — baribir qayta yig'amiz"
  else
    ok "$before → $after"
    git --no-pager log --oneline "$before..$after" | head -10 | sed 's/^/      /'
  fi
fi

# ─── 2. Yangi image ──────────────────────────────────────────────────────────
step "Yangi image yig'ilmoqda (sayt hozir ishlab turibdi)"
compose build app migrate
ok "yig'ildi"

# ─── 3. Migratsiya ───────────────────────────────────────────────────────────
step "Migratsiyalar qo'llanmoqda"
if compose run --rm migrate; then
  ok "migratsiyalar qo'llandi"
else
  fail "Migratsiya muvaffaqiyatsiz. Eski konteyner HALI ISHLAB TURIBDI — sayt yiqilmadi. Yuqoridagi xatoni tuzatib, qaytadan urinib ko'ring."
fi

# ─── 4. Almashtirish ─────────────────────────────────────────────────────────
step "Yangi versiyaga o'tilmoqda"
compose up -d --no-deps app
ok "app konteyneri almashtirildi"

# ─── 5. Tekshiruv ────────────────────────────────────────────────────────────
step "Ilova javob berishi kutilmoqda"

health=""
for attempt in $(seq 1 20); do
  if health="$(compose exec -T app wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null)"; then
    break
  fi
  printf "  … %s/20\r" "$attempt"
  sleep 3
done

if [ -z "$health" ]; then
  echo
  compose logs --tail 40 app
  cat >&2 <<YORIQNOMA

  ${RED}✗${RESET} Yangi versiya javob bermayapti.

  Oldingi versiyaga qaytish:

      git reset --hard HEAD~1
      ./scripts/update.sh --no-pull

  Zaxiradan bazani tiklash kerak bo'lsa — DEPLOY.md, "Zaxira va tiklash".

YORIQNOMA
  exit 1
fi

printf "\n  %s\n" "$health"
case "$health" in
  *'"status":"ok"'*) ok "ilova sog'lom" ;;
  *) warn "holat \"ok\" emas — yuqoridagi javobga qarang" ;;
esac

# ─── 6. Tozalash ─────────────────────────────────────────────────────────────
step "Eski image'lar tozalanmoqda"
# `--filter until=168h` — oxirgi bir haftadagi image'lar tegilmaydi, ya'ni
# kerak bo'lsa oldingi versiyaga qaytish imkoni saqlanadi.
docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true
ok "tozalandi"

printf "\n%sYangilandi.%s\n\n" "${BOLD}${GREEN}" "${RESET}"
