# shop — контекст

## Назначение

Продукты (файлы за оплату), заказы и выдача после оплаты через Робокассу.

## Файлы

- `models.py` — `Product`, `ProductFile`, `Order` (`inv_id` = InvId Робокассы, identity с 100001)
- `schemas.py` — Pydantic схемы
- `storage.py` — файлы на диске в `MEDIA_ROOT` (лимит 50 МБ — ограничение Bot API)
- `service.py` — CRUD продуктов/файлов, список и статистика заказов, `payments_config`
- `offers.py` — продажа в боте: карточка товара, заказ, ссылка на оплату
- `delivery.py` — `mark_paid` (Result URL) и `deliver_order` / `send_product`

## Поток покупки

1. Подписчик открывает `t.me/<бот>?start=buy-<uuid hex>` или жмёт кнопку
   «🛒 …» в приветствии (`callback_data=buy:<uuid>`).
2. `send_offer`: уже купил → файлы ещё раз; Робокасса не настроена →
   «оплата недоступна»; иначе заказ `pending` (свежий переиспользуется 24 ч),
   **commit до отправки**, карточка с URL-кнопкой «Оплатить».
3. Ссылка подписана Password #1 с `Shp_bot=<username>`, `Shp_kind=order`
   (+ `Receipt` при `ROBOKASSA_RECEIPT_ENABLED`).
4. Result URL `/api/v1/webhooks/robokassa`: подпись Password #2 с Shp,
   сверка суммы, идемпотентно → `paid` → фоновая `deliver_order`.
5. Выдача: сообщение после оплаты + файлы `sendDocument`; `file_id`
   кешируется в `ProductFile.tg_file_ids[<bot id>]` (file_id привязан к боту).
   Ошибка → `Order.delivery_error`, повтор — `POST /orders/{id}/deliver`.

## Endpoints

```
GET/POST        /api/v1/products
GET/PATCH/DELETE /api/v1/products/{id}
POST            /api/v1/products/{id}/files        # multipart, поле file
DELETE          /api/v1/products/{id}/files/{fid}
GET             /api/v1/orders?status=paid|pending
GET             /api/v1/orders/stats
POST            /api/v1/orders/{id}/deliver
GET             /api/v1/payments/config            # адреса для кабинета Робокассы
```

## Нельзя

- Отдавать ссылку на оплату до commit заказа — оплата придёт на несуществующий InvId.
- Менять формат `Shp_*`: он входит в подпись, старые ссылки перестанут проходить.
