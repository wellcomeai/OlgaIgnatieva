#!/bin/bash
# Первичная настройка VPS (Ubuntu 24.04). Запускается один раз от root,
# например из cloud-init. Ожидает готовый /opt/visanews2u.env с секретами.
#
# Делает: swap 2 ГБ, Docker, клон репозитория, .env (домен по IP, если
# DOMAIN пуст), запуск docker compose и cron автообновления.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/wellcomeai/OlgaIgnatieva.git}"
APP_DIR=/opt/visanews2u
ENV_SRC=/opt/visanews2u.env

log() { echo "==> $*"; }

# Swap: на 1–2 ГБ RAM без него не соберётся Next.js
if ! swapon --show | grep -q /swapfile; then
  log "Создаю swap 2 ГБ"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v docker >/dev/null; then
  log "Устанавливаю Docker"
  curl -fsSL https://get.docker.com | sh
fi

# shellcheck disable=SC1090
set -a; . "$ENV_SRC"; set +a
BRANCH="${DEPLOY_BRANCH:-main}"

if [ ! -d "$APP_DIR/.git" ]; then
  log "Клонирую $REPO_URL ($BRANCH)"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

if [ -z "${DOMAIN:-}" ]; then
  IP=$(curl -fsS https://api.ipify.org)
  DOMAIN="${IP//./-}.sslip.io"
  log "Технический домен: $DOMAIN"
  {
    echo "DOMAIN=$DOMAIN"
  } >> "$ENV_SRC"
fi

cp "$ENV_SRC" "$APP_DIR/.env"
grep -q '^APP_URL=' "$APP_DIR/.env" || echo "APP_URL=https://$DOMAIN" >> "$APP_DIR/.env"
grep -q '^CORS_ORIGINS=' "$APP_DIR/.env" || echo "CORS_ORIGINS=https://$DOMAIN" >> "$APP_DIR/.env"
chmod 600 "$ENV_SRC" "$APP_DIR/.env"

log "Собираю и запускаю"
cd "$APP_DIR"
docker compose -f docker-compose.server.yml up -d --build

install -m 755 "$APP_DIR/deploy/update.sh" /usr/local/bin/visanews2u-update
echo "*/5 * * * * root /usr/local/bin/visanews2u-update >> /var/log/visanews2u-update.log 2>&1" \
  > /etc/cron.d/visanews2u-update
log "Готово: https://$DOMAIN"
