# Searcher AI — VPS'ga deploy qilish

Noldan ishlaydigan saytgacha. Buyruqlar Ubuntu 22.04 / 24.04 uchun.

Umumiy vaqt: **30-40 daqiqa** (shundan 10 daqiqa DNS tarqalishini kutish).

---

## 0. Server talablari

| | Minimal | Tavsiya etiladi |
|---|---|---|
| **RAM** | 2 GB | **4 GB** |
| **Disk** | 20 GB | **40 GB** |
| **Protsessor** | 1 yadro | 2 yadro |
| **OS** | Ubuntu 22.04+ | Ubuntu 24.04 LTS |

**Nega 4 GB tavsiya etiladi.** Ilova ishlab turganda ~500 MB yeydi, Postgres
~200 MB. Lekin `next build` serverda bajariladi va u 1.5-2 GB talab qiladi —
2 GB RAM'li serverda build o'rtasida "out of memory" bo'lishi mumkin.

> 2 GB'da ishlatish uchun swap qo'shing:
> ```bash
> sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
> sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

**Disk taqsimoti (taxminan):** Docker image'lari ~1.2 GB (ilova 320 MB +
migratsiya 530 MB + Postgres/Nginx/Certbot ~250 MB), build keshi ~2 GB,
baza va fayllar o'sib boradi. 20 GB bir yilga yetadi.

---

## 1. Serverni tayyorlash

```bash
ssh root@<VPS-IP>

# Tizimni yangilash
apt-get update && apt-get upgrade -y

# Docker (rasmiy skript)
curl -fsSL https://get.docker.com | sh

# Firewall: faqat SSH, HTTP va HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

> **80-port ochiq bo'lishi SHART** — Let's Encrypt sertifikatni aynan shu
> port orqali tekshiradi. Ba'zi provayderlarda (Hetzner, DigitalOcean)
> firewall panelida ham alohida ochish kerak.

---

## 2. Domenni serverga ko'rsatish

Domen panelida (ahost.uz, Namecheap, Cloudflare — qayerda olgan bo'lsangiz)
**A yozuvi** qo'shing:

| Turi | Nomi | Qiymati | TTL |
|---|---|---|---|
| A | `@` | `<VPS-IP>` | 300 |
| A | `www` | `<VPS-IP>` | 300 |

Tarqalganini tekshirish (serverdan):

```bash
dig +short searcher-ai.uz
# Javobda VPS IP'ingiz chiqishi kerak
```

> Odatda 5-15 daqiqa oladi, ba'zan 1 soatgacha. **Tarqalmaguncha 5-qadamga
> (SSL) o'tmang** — Let's Encrypt haftasiga 5 ta muvaffaqiyatsiz urinishga
> ruxsat beradi.
>
> Cloudflare ishlatsangiz: sertifikat olayotganda proksini (to'q sariq
> bulut) **o'chiring**, keyin qayta yoqsangiz bo'ladi.

---

## 3. Kodni serverga olib kelish

```bash
mkdir -p /opt && cd /opt
git clone <repo-manzili> searcher-ai
cd /opt/searcher-ai
```

> Repo yopiq bo'lsa, deploy kaliti qo'shing:
> ```bash
> ssh-keygen -t ed25519 -C "searcher-ai-vps" -f ~/.ssh/id_ed25519 -N ""
> cat ~/.ssh/id_ed25519.pub    # → GitHub → Settings → Deploy keys
> ```

---

## 4. `.env` ni to'ldirish

```bash
cp .env.production.example .env
nano .env
```

### Majburiy qiymatlar (❗)

| O'zgaruvchi | Nima yoziladi | Qanday olinadi |
|---|---|---|
| `DOMAIN` | `searcher-ai.uz` | `https://` va oxirgi `/` **siz** |
| `CERTBOT_EMAIL` | `siz@example.com` | Haqiqiy pochta — sertifikat ogohlantirishlari keladi |
| `POSTGRES_PASSWORD` | tasodifiy satr | `openssl rand -base64 32` |
| `APP_URL` | `https://searcher-ai.uz` | `DOMAIN` bilan bir xil, `https://` bilan |
| `AUTH_SECRET` | tasodifiy satr | `openssl rand -base64 48` |
| `AI_API_KEY` | AI xizmati kaliti | Yandex AI Studio / OpenAI panelidan |

### Ixtiyoriy (○)

| O'zgaruvchi | Izoh |
|---|---|
| `AI_MODEL`, `AI_BASE_URL` | Bo'sh qoldirilsa OpenAI standarti. Yandex uchun `.env.production.example` dagi namunalarga qarang |
| `CALENDAR_PLAN_AI_MODEL` | Kalendar reja uchun alohida model — bu modul eng uzun ro'yxatni tuzadi |
| `NEXT_PUBLIC_SUPPORT_TELEGRAM` | Sahifa pastidagi "Yordam kerakmi?" kontakti |
| `STORAGE_DRIVER` | VPS uchun `local` (standart). `s3` faqat bir nechta serverga kengaytirganda |

### Uchta tez-tez uchraydigan xato

1. **`DATABASE_URL` ni qo'lda yozish.** Kerak emas — uni compose
   `POSTGRES_*` qiymatlaridan o'zi yig'adi. Qo'lda yozsangiz ham compose'niki
   ustun turadi.
2. **`APP_URL` da `http://`** — sessiya cookie'lari `secure` bayrog'i bilan
   yuboriladi, HTTP'da brauzer ularni qabul qilmaydi va kirish ishlamaydi.
3. **`AUTH_SECRET` ni keyinchalik o'zgartirish** — barcha o'qituvchilar
   tizimdan chiqib ketadi. Bir marta yarating va tegmang.

---

## 5. Ishga tushirish

```bash
./scripts/deploy.sh
```

Skript ketma-ket: Docker'ni tekshiradi → `.env` ni tekshiradi → image'larni
yig'adi → konteynerlarni ko'taradi → migratsiyalarni qo'llaydi → ilova
javob berishini kutadi.

**Birinchi safar 4-8 daqiqa** (image'lar yig'iladi). Oxirida shunday
ko'rinish chiqadi:

```
▸ Ilova javob berishi kutilmoqda
  {"ok":true,"data":{"status":"ok","database":{"connected":true,...
  ✓ ilova sog'lom, bazaga ulanish bor
  ✓ AI kaliti sozlangan

Stack ko'tarildi.
```

---

## 6. SSL sertifikat

```bash
./scripts/init-ssl.sh
```

Skript DNS'ni tekshiradi → vaqtinchalik sertifikat yaratadi (Nginx
ko'tarilishi uchun) → Let's Encrypt'dan haqiqiysini oladi → Nginx'ni qayta
yuklaydi.

> **Ishonchingiz komil bo'lmasa** avval sinov rejimida urinib ko'ring —
> u limitga kirmaydi:
> ```bash
> ./scripts/init-ssl.sh --sinov
> ```
> Ishlagach, haqiqiysini oling: `./scripts/init-ssl.sh`

Sertifikat 90 kun amal qiladi va **avtomatik yangilanadi** — `certbot`
konteyneri har 12 soatda tekshiradi, Nginx har 6 soatda qayta yuklanadi.
Sizdan hech narsa talab qilinmaydi.

---

## 7. Ishlayotganini tekshirish

```bash
curl https://searcher-ai.uz/api/health
```

Kutilgan javob:

```json
{"ok":true,"data":{"status":"ok",
 "database":{"connected":true,"latencyMs":5},
 "ai":{"provider":"openai","model":"...","configured":true},
 "storage":{"driver":"local"}}}
```

| Maydon | Nima bo'lishi kerak | Bo'lmasa |
|---|---|---|
| `status` | `"ok"` | `"degraded"` → baza ulanmagan, `POSTGRES_PASSWORD` ni tekshiring |
| `database.connected` | `true` | `docker compose -f docker-compose.prod.yml logs postgres` |
| `ai.configured` | `true` | `AI_API_KEY` bo'sh — generatsiya ishlamaydi |
| `storage.driver` | `"local"` | — |

Keyin brauzerda oching va **to'liq yo'lni bir marta o'ting**:
ro'yxatdan o'tish → dars ishlanmasi yaratish → prezentatsiya yaratish →
faylni yuklab olish. Ayniqsa **yuklab olishni telefonda** sinab ko'ring.

---

## Keyingi yangilanishlar

```bash
cd /opt/searcher-ai
./scripts/update.sh
```

Skript: zaxira oladi → `git pull` → yangi image yig'adi → migratsiya →
konteynerni almashtiradi → tekshiradi.

**To'xtash vaqti ~3 soniya** — yangi image butunlay yig'ilgandan keyingina
eski konteyner almashtiriladi, ya'ni build davomida (2-5 daqiqa) sayt
ishlab turadi.

Migratsiya yiqilsa skript to'xtaydi va **eski versiya ishlab turaveradi** —
sayt buzilmaydi.

---

## Zaxira va tiklash

### Kunlik avtomatik zaxira

```bash
crontab -e
```

Oxiriga qo'shing:

```
0 3 * * * cd /opt/searcher-ai && ./scripts/backup.sh --jim >> /var/log/searcher-backup.log 2>&1
```

Har kuni soat 03:00 da `backups/` papkasiga baza (`pg_dump`) va
generatsiya qilingan fayllar tushadi. 14 kundan eskilari o'chib ketadi.

> **Chegara:** nusxalar SHU SERVERDA yotadi. Server butunlay yo'qolsa ular
> ham yo'qoladi. Demo'dan keyin boshqa joyga ko'chirishni qo'shing:
> ```bash
> rclone copy backups/ remote:searcher-backups/   # yoki scp
> ```

### Bazani tiklash

```bash
cd /opt/searcher-ai
gunzip -c backups/db_2026-09-13_03-00.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres \
      psql -U searcher -d searcher_ai
```

### Fayllarni tiklash

```bash
docker compose -f docker-compose.prod.yml exec -T app \
  tar -xzf - -C /app < backups/storage_2026-09-13_03-00.tar.gz
```

---

## Muammo bo'lsa: qayerga qarash

Barcha buyruqlar `/opt/searcher-ai` ichidan. Qisqartma uchun:

```bash
alias dc='docker compose -f docker-compose.prod.yml'
```

| Savol | Buyruq |
|---|---|
| Nima ishlab turibdi? | `dc ps` |
| Ilova nima deyapti? | `dc logs -f app` |
| Baza nima deyapti? | `dc logs postgres` |
| Nginx nima deyapti? | `dc logs nginx` |
| Sertifikat nima deyapti? | `dc logs certbot` |
| Migratsiya nima bo'ldi? | `dc logs migrate` |
| Hammasini qayta ishga tushirish | `dc restart` |
| Disk to'lib ketdimi? | `df -h` va `docker system df` |
| Keshni tozalash | `docker system prune -a --volumes` ⚠️ volume'larga tegmang: `docker system prune -a` |

### Eng ko'p uchraydigan holatlar

**Sayt ochilmayapti, brauzer "ulanib bo'lmadi" deydi**

```bash
dc ps                  # nginx `running` holatdami?
ufw status             # 80 va 443 ochiqmi?
dc logs nginx | tail -30
```

**"Sertifikat ishonchsiz" ogohlantirishi**

Vaqtinchalik (o'z-o'zini imzolagan) sertifikat qolib ketgan. Qaytadan:

```bash
./scripts/init-ssl.sh
```

**502 Bad Gateway**

Nginx ishlayapti, lekin ilova yo'q:

```bash
dc ps app              # `running` va `healthy` bo'lishi kerak
dc logs --tail 50 app  # odatda .env dagi xato shu yerda ko'rinadi
```

**Kirish ishlamayapti (parol to'g'ri, lekin qaytarib yuboradi)**

`APP_URL` `https://` bilan boshlanganini tekshiring — cookie'lar
`secure` bayrog'i bilan yuboriladi.

```bash
grep APP_URL .env
```

**Kalendar reja 504 bilan tugayapti**

Nginx chegarasi 300 soniyaga qo'yilgan, ya'ni bu AI tomondan. Tekshiring:

```bash
dc logs app | grep -i "ai\|timeout" | tail -20
```

`AI_TIMEOUT_MS` ni oshiring (lekin 300000 dan oshirmang — Nginx chegarasi).

**Disk to'lib qoldi**

```bash
docker system df                    # nima joy egallagan
docker image prune -a --filter "until=168h"
du -sh backups/                     # eski zaxiralar
```

---

## Xavfsizlik eslatmalari

1. **`.env` hech qachon git'ga tushmasin** — `.gitignore` da, lekin
   nusxalarda ehtiyot bo'ling.
2. **Demo tugagach AI kalitini almashtiring** — ishlab chiqish davomida
   ko'rsatilgan kalit kompromentatsiya qilingan deb hisoblanadi.
3. **SSH parol bilan emas, kalit bilan**:
   ```bash
   sudo nano /etc/ssh/sshd_config
   # PasswordAuthentication no
   sudo systemctl restart ssh
   ```
4. **Postgres tashqariga ochilmagan** — compose'da `ports:` yo'q, faqat
   Docker tarmog'i ichida. Shunday qoldiring.
5. **Ilova root emas** — konteyner ichida `nextjs` (uid 1001) nomidan
   ishlaydi.

---

## Nima qayerda ishlaydi

```
Internet
   │
   ├─ :80  ──→ nginx ──→ 301 https  (va /.well-known/ — certbot uchun)
   └─ :443 ──→ nginx ──→ app:3000
                 │
                 ├─ /_next/static/  → 1 yil kesh
                 ├─ rasm, shrift    → 30 kun kesh
                 ├─ /api/lesson-plans, /api/presentations,
                 │  /api/calendar-plans → 300 soniya timeout
                 └─ qolgani         → 120 soniya timeout

app ──→ postgres:5432        (volume: postgres_data)
app ──→ /app/storage         (volume: storage_data — .pptx va .xlsx)
certbot ──→ /etc/letsencrypt (volume: certbot_conf)
```

Konteynerlardan tashqariga **faqat nginx** chiqadi (80 va 443).
Qolganlari Docker tarmog'i ichida.
