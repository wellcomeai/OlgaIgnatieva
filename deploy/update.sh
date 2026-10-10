#!/bin/bash
# Автообновление: если в ветке DEPLOY_BRANCH появились новые коммиты —
# подтянуть их и пересобрать контейнеры. Запускается cron'ом каждые 5 минут.
set -euo pipefail

APP_DIR=/opt/visanews2u
LOCK=/var/lock/visanews2u-update.lock
cd "$APP_DIR"

exec 9>"$LOCK"
flock -n 9 || exit 0  # предыдущее обновление ещё идёт

BRANCH=$(grep -E '^DEPLOY_BRANCH=' .env | cut -d= -f2- || true)
BRANCH="${BRANCH:-main}"

git fetch --quiet origin "$BRANCH"
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
[ "$LOCAL" = "$REMOTE" ] && exit 0

echo "$(date -Is) обновление $LOCAL -> $REMOTE"
git checkout --quiet -B "$BRANCH" "origin/$BRANCH"
docker compose -f docker-compose.server.yml up -d --build
docker image prune -f >/dev/null
echo "$(date -Is) готово"
