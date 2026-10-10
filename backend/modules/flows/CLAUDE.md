# flows — контекст

## Назначение

Воронки: визуальные сценарии бота (редактор на React Flow, `/flows/[id]`).

## Файлы

- `models.py` — `Flow` (граф JSON + копия триггера), `FlowRun` (прохождение
  подписчика), `FlowEvent` (дошёл до блока — для счётчиков), `RunStatus`
- `graph.py` — проверка графа и навигация (`outgoing`, выходы блоков)
- `engine.py` — исполнение: `start_flow`, `advance`, `handle_button`,
  `handle_text`, `resume_after_delay`, поиск воронок по триггеру
- `scheduler.py` — фоновая задача (lifespan), будит паузы каждые 10 с
- `templates.py` — шаблоны «С нуля», «Приветствие и продажа», «Лид-магнит»
- `service.py` — CRUD для кабинета, статистика, конфликт стартов

## Граф

Формат React Flow: `{"nodes": [{id, type, position, data}], "edges": [{id, source, sourceHandle, target}]}`.
Выходы: `next`; сообщение с кнопками-ветками — `btn:<id>`; условие — `yes`/`no`.
Из одного выхода — одна стрелка. Ровно один `trigger`.

Блоки: `trigger` (start / start_label / keyword / purchase), `message`,
`delay`, `question` (var + validate any/email/phone), `offer`, `files`,
`condition` (purchased / has_tag / has_var), `tag`.

Проверка двухуровневая: `GraphError` (структура) — не сохраняется;
`Validation.problems` (содержание) — черновик сохраняется, включить нельзя.

## Исполнение

- `/start <метка>`: ссылка `buy-…` → продажа; иначе воронка с этой меткой →
  воронка «любой /start» → обычное приветствие бота.
- Текст: сначала ответ на вопрос (`waiting_input`), потом ключевые слова.
- Кнопка-ветка: callback `fl:<run hex>:<btn id>`; устаревшая кнопка → «неактивна».
- Оплата (после выдачи файлов) запускает воронки `purchase` этого продукта.
- Повторный триггер отменяет активное прохождение той же воронки.
- Не больше 40 шагов подряд без ожидания — иначе `failed` (защита от цикла).
- Планировщик: `FOR UPDATE SKIP LOCKED` + сразу `running` — безопасно при
  нескольких воркерах gunicorn.
- Подписчик: `tags` (list) и `vars` (dict) в `bot_subscribers`.

## Тесты

`tests/test_flows.py` — ветки, паузы через `process_due_runs()`, вопросы,
условия, теги, приоритет триггеров, конфликт, оплата → воронка, цикл.
