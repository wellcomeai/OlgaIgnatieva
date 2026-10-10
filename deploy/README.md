# Развёртывание на VPS (Timeweb Cloud)

Один сервер (Ubuntu 24.04, Амстердам) с Docker:

```
Интернет ─► caddy :443 (HTTPS, Let's Encrypt)
              └─► app :10000  (nginx → FastAPI /api, Next.js /)
                    └─► postgres
Тома: postgres_data (база), media_data (файлы продуктов), caddy_data (сертификаты)
```

Файлы: `docker-compose.server.yml`, `deploy/Caddyfile`,
`deploy/server-setup.sh` (первичная настройка), `deploy/update.sh` (автообновление).

## Первичная установка

Сервер создаётся с cloud-init, который:

1. кладёт секреты в `/opt/visanews2u.env` (пример ниже);
2. скачивает и запускает `deploy/server-setup.sh` из нужной ветки.

`server-setup.sh` включает swap 2 ГБ, ставит Docker, клонирует репозиторий в
`/opt/visanews2u`, вычисляет технический домен `<ip-через-дефисы>.sslip.io`
(если `DOMAIN` не задан), запускает `docker compose` и cron автообновления.

Первая сборка на 1 ядре идёт ~10–15 минут.

### /opt/visanews2u.env

```env
ENVIRONMENT=production
DEPLOY_BRANCH=main
SECRET_KEY=<48+ случайных символов>
BOT_TOKEN_ENCRYPTION_KEY=<Fernet.generate_key()>
POSTGRES_PASSWORD=<случайный>
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD=<случайный>
# DOMAIN=platform.example.ru   # пусто → <ip>.sslip.io
ROBOKASSA_MERCHANT_LOGIN=
ROBOKASSA_PASSWORD1=
ROBOKASSA_PASSWORD2=
ROBOKASSA_TEST_MODE=true
```

## Обновления

Cron каждые 5 минут запускает `visanews2u-update`: если в `DEPLOY_BRANCH`
появились коммиты — `git pull` и `docker compose up -d --build`.
То есть **пуш в ветку = обновление сервера через 5–15 минут**.
Лог: `/var/log/visanews2u-update.log`.

## Изменить настройки (Робокасса, домен, пароли)

Через консоль сервера в панели Timeweb (или SSH):

```bash
nano /opt/visanews2u/.env          # поправить значения
cd /opt/visanews2u && docker compose -f docker-compose.server.yml up -d
```

### Свой домен

1. A-запись домена → IP сервера.
2. В `/opt/visanews2u/.env`: `DOMAIN=`, `APP_URL=https://<домен>`,
   `CORS_ORIGINS=https://<домен>`.
3. `docker compose -f docker-compose.server.yml up -d` — Caddy сам получит сертификат.
4. В кабинете: каждый бот → Настройки → «Переподключить» (новый адрес вебхука).
5. В Робокассе обновить Result/Success/Fail URL (их показывает раздел «Продукты»).

## Полезные команды

```bash
cd /opt/visanews2u
docker compose -f docker-compose.server.yml ps
docker compose -f docker-compose.server.yml logs -f app
docker compose -f docker-compose.server.yml exec postgres \
  pg_dump -U visanews2u visanews2u > backup-$(date +%F).sql
```
