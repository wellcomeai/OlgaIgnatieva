"""Интеграция с Робокассой.

Документация: https://docs.robokassa.ru/

Используется два метода:
- build_payment_url: генерирует ссылку для редиректа на оплату
- verify_result_signature: проверяет подпись webhook-а

Пользовательские параметры `Shp_*` Робокасса возвращает в Result URL; они
входят в подпись в виде `Shp_x=value`, отсортированные по имени.
"""
from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from typing import Any
from urllib.parse import quote, urlencode

from config import settings


_BASE_URL = "https://auth.robokassa.ru/Merchant/Index.aspx"


def _md5(data: str) -> str:
    return hashlib.md5(data.encode()).hexdigest()


def _shp_part(shp: dict[str, str] | None) -> list[str]:
    return [f"{k}={v}" for k, v in sorted((shp or {}).items())]


def is_configured() -> bool:
    return bool(
        settings.robokassa_merchant_login
        and settings.robokassa_password1
        and settings.robokassa_password2
    )


def build_receipt(name: str, amount: Decimal) -> str:
    """Чек 54-ФЗ из одной позиции, URL-кодированный JSON (в таком виде он входит в подпись)."""
    receipt: dict[str, Any] = {
        "items": [
            {
                "name": name[:128],
                "quantity": 1,
                "sum": float(amount),
                "payment_method": "full_payment",
                "payment_object": settings.robokassa_payment_object,
                "tax": settings.robokassa_tax,
            }
        ]
    }
    if settings.robokassa_sno:
        receipt["sno"] = settings.robokassa_sno
    return quote(json.dumps(receipt, ensure_ascii=False, separators=(",", ":")))


def build_payment_url(
    inv_id: int | str,
    amount: Decimal,
    description: str,
    user_email: str | None = None,
    shp: dict[str, str] | None = None,
    receipt: str | None = None,
) -> str:
    """Сформировать URL для редиректа клиента на оплату."""
    out_sum = f"{amount:.2f}"
    sig_parts = [settings.robokassa_merchant_login, out_sum, str(inv_id)]
    if receipt:
        sig_parts.append(receipt)
    sig_parts.append(settings.robokassa_password1)
    signature = _md5(":".join(sig_parts + _shp_part(shp)))

    params: dict[str, Any] = {
        "MerchantLogin": settings.robokassa_merchant_login,
        "OutSum": out_sum,
        "InvId": inv_id,
        "Description": description[:100],
        "SignatureValue": signature,
        "Culture": "ru",
    }
    if receipt:
        params["Receipt"] = receipt
    if user_email:
        params["Email"] = user_email
    if settings.robokassa_test_mode:
        params["IsTest"] = "1"
    params.update(shp or {})

    return f"{_BASE_URL}?{urlencode(params)}"


def verify_result_signature(
    out_sum: str, inv_id: str, signature: str, shp: dict[str, str] | None = None
) -> bool:
    """Проверка подписи в Result URL (webhook).

    Использует password2 — это критично.
    """
    expected = _md5(":".join([out_sum, inv_id, settings.robokassa_password2] + _shp_part(shp)))
    return expected.lower() == signature.lower()
