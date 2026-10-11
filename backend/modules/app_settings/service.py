"""Настройки из кабинета поверх .env.

Значение из БД (если задано) перекрывает переменную окружения; пустое
значение в БД не хранится — тогда используется .env. Секреты шифруются
и никогда не возвращаются в API, только признак «задан».
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from modules.app_settings.models import AppSetting
from modules.bots.crypto import decrypt_secret, encrypt_secret

FieldType = Literal["str", "bool", "choice"]


@dataclass(frozen=True)
class FieldSpec:
    key: str
    label: str
    type: FieldType = "str"
    secret: bool = False
    choices: tuple[tuple[str, str], ...] = ()
    help: str = ""


TAX_CHOICES = (
    ("none", "Без НДС"),
    ("vat0", "НДС 0%"),
    ("vat10", "НДС 10%"),
    ("vat20", "НДС 20%"),
    ("vat110", "НДС 10/110"),
    ("vat120", "НДС 20/120"),
)
SNO_CHOICES = (
    ("", "Как в настройках магазина"),
    ("osn", "ОСН"),
    ("usn_income", "УСН доходы"),
    ("usn_income_outcome", "УСН доходы − расходы"),
    ("esn", "ЕСХН"),
    ("patent", "Патент"),
)
OBJECT_CHOICES = (("service", "Услуга"), ("commodity", "Товар"), ("intellectual_activity", "Результат интеллектуальной деятельности"))

ROBOKASSA_FIELDS: tuple[FieldSpec, ...] = (
    FieldSpec("robokassa_merchant_login", "Идентификатор магазина",
              help="MerchantLogin из «Технических настроек» Робокассы"),
    FieldSpec("robokassa_password1", "Пароль #1", secret=True),
    FieldSpec("robokassa_password2", "Пароль #2", secret=True),
    FieldSpec("robokassa_test_mode", "Тестовый режим", type="bool",
              help="Платежи не списываются. Для теста используйте тестовые пароли из Робокассы"),
    FieldSpec("robokassa_receipt_enabled", "Передавать чек (54-ФЗ)", type="bool",
              help="Включите, если касса не берёт номенклатуру из настроек магазина"),
    FieldSpec("robokassa_tax", "НДС в чеке", type="choice", choices=TAX_CHOICES),
    FieldSpec("robokassa_sno", "Система налогообложения", type="choice", choices=SNO_CHOICES),
    FieldSpec("robokassa_payment_object", "Предмет расчёта", type="choice", choices=OBJECT_CHOICES),
)

SELLER_STATUS = (("self_employed", "Самозанятый"), ("ip", "Индивидуальный предприниматель"), ("company", "Юридическое лицо"))

LEGAL_FIELDS: tuple[FieldSpec, ...] = (
    FieldSpec("seller_status", "Статус продавца", type="choice", choices=SELLER_STATUS),
    FieldSpec("seller_name", "ФИО или название",
              help="Как в документах: «Игнатьева Ольга Викторовна» или «ИП Игнатьева О. В.»"),
    FieldSpec("seller_inn", "ИНН"),
    FieldSpec("seller_ogrn", "ОГРНИП / ОГРН", help="Для самозанятых не нужен"),
    FieldSpec("seller_address", "Адрес", help="Для ИП и юрлиц; самозанятым можно не указывать"),
    FieldSpec("seller_email", "Email для покупателей", help="Сюда пишут по вопросам оплаты и возврата"),
    FieldSpec("seller_phone", "Телефон"),
)

LANDING_FIELDS: tuple[FieldSpec, ...] = (
    FieldSpec("landing_product_id", "Продукт на лендинге", help="Цена и кнопка «Купить» на главной странице сайта"),
    FieldSpec("landing_bot_id", "Бот для покупки", help="Кнопка «Купить» откроет этого бота с карточкой продукта"),
)

GROUPS: dict[str, tuple[FieldSpec, ...]] = {
    "robokassa": ROBOKASSA_FIELDS,
    "legal": LEGAL_FIELDS,
    "landing": LANDING_FIELDS,
}

FIELDS: dict[str, FieldSpec] = {f.key: f for group in GROUPS.values() for f in group}


def _env_value(key: str) -> Any:
    return getattr(settings, key)


def _parse(spec: FieldSpec, raw: str) -> Any:
    if spec.type == "bool":
        return raw == "true"
    return raw


async def _stored(db: AsyncSession) -> dict[str, AppSetting]:
    rows = (await db.scalars(select(AppSetting).where(AppSetting.key.in_(FIELDS)))).all()
    return {r.key: r for r in rows}


async def effective(db: AsyncSession) -> dict[str, Any]:
    """Итоговые значения: БД поверх .env (секреты — расшифрованные)."""
    stored = await _stored(db)
    result: dict[str, Any] = {}
    for key, spec in FIELDS.items():
        row = stored.get(key)
        if row is None:
            result[key] = _env_value(key)
        else:
            raw = decrypt_secret(row.value) if row.is_secret else row.value
            result[key] = _parse(spec, raw)
    return result


async def describe(db: AsyncSession, group: str = "robokassa") -> list[dict[str, Any]]:
    """Поля группы для кабинета: значения обычных полей, для секретов — только «задан»."""
    stored = await _stored(db)
    values = await effective(db)
    out = []
    for spec in GROUPS[group]:
        key = spec.key
        value = values[key]
        source = "ui" if key in stored else ("env" if value not in ("", None, False) or spec.type == "bool" else "none")
        item: dict[str, Any] = {
            "key": key,
            "label": spec.label,
            "type": spec.type,
            "secret": spec.secret,
            "help": spec.help,
            "choices": [{"value": v, "label": label} for v, label in spec.choices],
            "source": source,
        }
        if spec.secret:
            item["is_set"] = bool(value)
            item["value"] = None
        else:
            item["value"] = value
        out.append(item)
    return out


async def update(db: AsyncSession, values: dict[str, Any], reset: list[str]) -> None:
    """Сохранить значения из кабинета. `reset` — вернуть поле к значению из .env."""
    stored = await _stored(db)
    for key in reset:
        if key not in FIELDS:
            raise HTTPException(status_code=422, detail=f"Неизвестная настройка: {key}")
        if key in stored:
            await db.delete(stored.pop(key))
    for key, value in values.items():
        spec = FIELDS.get(key)
        if spec is None:
            raise HTTPException(status_code=422, detail=f"Неизвестная настройка: {key}")
        if spec.type == "bool":
            if not isinstance(value, bool):
                raise HTTPException(status_code=422, detail=f"{spec.label}: ожидается да/нет")
            raw = "true" if value else "false"
        else:
            raw = str(value if value is not None else "").strip()
            if spec.type == "choice" and raw not in {c for c, _ in spec.choices}:
                raise HTTPException(status_code=422, detail=f"{spec.label}: недопустимое значение")
            if len(raw) > 512:
                raise HTTPException(status_code=422, detail=f"{spec.label}: слишком длинное значение")
        if spec.secret and not raw:
            continue  # пустое поле секрета = «не менять»
        stored_value = encrypt_secret(raw) if spec.secret else raw
        row = stored.get(key)
        if row is None:
            db.add(AppSetting(key=key, value=stored_value, is_secret=spec.secret))
        else:
            row.value = stored_value
            row.is_secret = spec.secret
    await db.commit()


# ---- Робокасса -----------------------------------------------------------

@dataclass(frozen=True)
class RobokassaConfig:
    merchant_login: str
    password1: str
    password2: str
    test_mode: bool
    receipt_enabled: bool
    tax: str
    sno: str
    payment_object: str

    @property
    def configured(self) -> bool:
        return bool(self.merchant_login and self.password1 and self.password2)


async def robokassa_config(db: AsyncSession) -> RobokassaConfig:
    v = await effective(db)
    return RobokassaConfig(
        merchant_login=v["robokassa_merchant_login"] or "",
        password1=v["robokassa_password1"] or "",
        password2=v["robokassa_password2"] or "",
        test_mode=bool(v["robokassa_test_mode"]),
        receipt_enabled=bool(v["robokassa_receipt_enabled"]),
        tax=v["robokassa_tax"] or "none",
        sno=v["robokassa_sno"] or "",
        payment_object=v["robokassa_payment_object"] or "service",
    )
