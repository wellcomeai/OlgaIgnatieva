# bots — контекст

## Назначение

Подключение Telegram-ботов по токену, приём апдейтов через вебхук,
приветствие на `/start`, учёт подписчиков и источников (deep-link метки).

## Файлы

- `models.py` — `Bot`, `Subscriber`, `WebhookStatus`, `DEFAULT_WELCOME_TEXT`
- `schemas.py` — Pydantic схемы
- `crypto.py` — Fernet-шифрование токенов (`encrypt_token` / `decrypt_token`)
- `telegram.py` — минимальный async-клиент Bot API на httpx (`call`, `download_file`)
- `service.py` — подключение, вебхук, подписчики, аватар
- `handlers.py` — обработка апдейтов (`handle_update`)

## Как это работает

1. `POST /bots {token}` → проверка формата → `getMe` → `Bot` с
   зашифрованным токеном и случайным `webhook_secret` → `setWebhook` на
   `{TELEGRAM_WEBHOOK_BASE_URL|APP_URL}/api/v1/tg/{bot.id}`.
2. Telegram шлёт апдейты на `POST /api/v1/tg/{bot_id}` с заголовком
   `X-Telegram-Bot-Api-Secret-Token`; сверяется через `hmac.compare_digest`.
3. `handle_update`: upsert подписчика; `/start <метка>` при первом входе
   пишет метку в `Subscriber.source` и отправляет приветствие
   (`parse_mode=HTML`, фолбэк на plain text при битой разметке);
   `my_chat_member: kicked` → `is_blocked = true`.
4. Ошибки обработки логируются, но ответ всегда 200 — иначе Telegram
   будет бесконечно повторять апдейт.

Один процесс обслуживает любое число ботов: polling не используется.

## webhook_status

`pending` → `ok` | `error` (текст в `webhook_error`) | `no_https`
(базовый URL не https — Telegram такой не примет) | `disabled` (бот выключен).

## Endpoints

```
GET    /api/v1/bots
POST   /api/v1/bots                     # {token}
GET    /api/v1/bots/{id}
PATCH  /api/v1/bots/{id}                # welcome_text, welcome_buttons, is_active
DELETE /api/v1/bots/{id}                # + deleteWebhook
POST   /api/v1/bots/{id}/webhook        # переустановить вебхук
GET    /api/v1/bots/{id}/webhook        # getWebhookInfo
GET    /api/v1/bots/{id}/subscribers    # ?search&limit&offset
GET    /api/v1/bots/{id}/sources        # подписчики по меткам

POST   /api/v1/tg/{id}                  # вебхук Telegram (публичный, по секрету)
GET    /api/v1/tg/{id}/avatar           # аватар бота (прокси, кеш 1 час)
```

## Плейсхолдеры приветствия

`{first_name}`, `{username}` — подставляются с HTML-экранированием.

## Тесты

`backend/tests/test_bots.py` — против настоящего PostgreSQL, Telegram
подменяется `FakeTelegram` (см. `tests/conftest.py`).

## Нельзя

- Логировать или возвращать токен. `httpx` логирует URL запросов
  (а в URL Bot API лежит токен), поэтому в `telegram.py` его логгер
  поднят до WARNING.
- Менять `SECRET_KEY` без заданного `BOT_TOKEN_ENCRYPTION_KEY`:
  ключ шифрования выводится из него, и токены станут нечитаемыми.
