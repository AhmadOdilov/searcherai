#!/usr/bin/env bash
#
# Searcher AI — zaxira nusxa (baza + generatsiya qilingan fayllar).
#
# Ishlatish:
#   ./scripts/backup.sh          # oddiy, natijani ekranga yozadi
#   ./scripts/backup.sh --jim    # jim rejim (cron uchun)
#
# Har kuni avtomatik olish (cron):
#   crontab -e
#   0 3 * * * cd /opt/searcher-ai && ./scripts/backup.sh --jim >> /var/log/searcher-backup.log 2>&1
#
# ── Nima saqlanadi ───────────────────────────────────────────────────────────
#   1. PostgreSQL — `pg_dump` (matnli SQL, gzip bilan siqilgan)
#   2. storage/   — generatsiya qilingan .pptx va .xlsx fayllar (tar.gz)
#
# ── Nima SAQLANMAYDI (ataylab) ───────────────────────────────────────────────
#   · `.env` — sirlar zaxirada yotmasligi kerak. Uni alohida, xavfsiz
#     joyda (parol menejerida) saqlang.
#   · Docker image'lari — ular git'dan qayta yig'iladi.
#
# ── Chegara ──────────────────────────────────────────────────────────────────
# Bu MVP darajasidagi zaxira: fayllar SHU SERVERDA qoladi. Server butunlay
# yo'qolsa zaxira ham yo'qoladi. Demo'dan keyin `scp` yoki `rclone` bilan
# boshqa joyga ko'chirishni qo'shing (DEPLOY.md da eslatma bor).

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="backups"
KEEP_DAYS=14

QUIET=0
{ [ "${1:-}" = "--jim" ] || [ "${1:-}" = "--quiet" ]; } && QUIET=1

say() { [ "$QUIET" = "1" ] || printf "%s\n" "$1"; }
fail() { printf "✗ %s\n" "$1" >&2; exit 1; }

[ -f .env ] || fail ".env topilmadi."

set -a
# shellcheck disable=SC1091
. ./.env
set +a

POSTGRES_USER="${POSTGRES_USER:-searcher}"
POSTGRES_DB="${POSTGRES_DB:-searcher_ai}"

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

stamp="$(date +%Y-%m-%d_%H-%M)"
mkdir -p "$BACKUP_DIR"

# ─── 1. Baza ─────────────────────────────────────────────────────────────────
db_file="${BACKUP_DIR}/db_${stamp}.sql.gz"

# `-T` — TTY ajratmaydi (cron'da TTY yo'q).
# `--clean --if-exists` — tiklashda eski jadvallar avval o'chiriladi,
# ya'ni bo'sh bo'lmagan bazaga ham tiklab bo'ladi.
if compose exec -T postgres pg_dump \
      --username "$POSTGRES_USER" \
      --dbname "$POSTGRES_DB" \
      --clean --if-exists --no-owner --no-privileges \
    | gzip > "$db_file"; then
  say "✓ baza:    $db_file ($(du -h "$db_file" | cut -f1))"
else
  rm -f "$db_file"
  fail "pg_dump muvaffaqiyatsiz. Postgres konteyneri ishlab turibdimi? (docker compose -f $COMPOSE_FILE ps)"
fi

# Bo'sh yoki juda kichik fayl — dump aslida ishlamaganini bildiradi.
if [ "$(stat -f%z "$db_file" 2>/dev/null || stat -c%s "$db_file")" -lt 1000 ]; then
  fail "Zaxira fayli juda kichik ($db_file) — dump to'g'ri olinmagan bo'lishi mumkin."
fi

# ─── 2. Fayllar ──────────────────────────────────────────────────────────────
# `storage/` Docker volume'ida yashaydi, ya'ni hostdan to'g'ridan-to'g'ri
# ko'rinmaydi. Shuning uchun arxivni konteyner ICHIDA yasab, oqim orqali
# tashqariga chiqaramiz.
storage_file="${BACKUP_DIR}/storage_${stamp}.tar.gz"

if compose exec -T app tar -czf - -C /app storage > "$storage_file" 2>/dev/null; then
  say "✓ fayllar: $storage_file ($(du -h "$storage_file" | cut -f1))"
else
  rm -f "$storage_file"
  say "! fayllar zaxiralanmadi (app konteyneri ishlamayaptimi?) — baza nusxasi olindi"
fi

# ─── 3. Eskilarini o'chirish ─────────────────────────────────────────────────
removed="$(find "$BACKUP_DIR" -maxdepth 1 -name '*.gz' -type f -mtime "+${KEEP_DAYS}" -print -delete | wc -l | tr -d ' ')"
[ "$removed" != "0" ] && say "✓ ${KEEP_DAYS} kundan eski ${removed} ta nusxa o'chirildi"

total="$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
say "  jami: $total ($BACKUP_DIR)"

# Cron logida sana ko'rinib tursin.
[ "$QUIET" = "1" ] && printf "[%s] zaxira tayyor: %s\n" "$(date '+%Y-%m-%d %H:%M')" "$db_file"

exit 0
