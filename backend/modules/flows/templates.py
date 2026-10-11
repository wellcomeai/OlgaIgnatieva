"""Готовые шаблоны воронок для быстрого старта."""
from __future__ import annotations

from typing import Any


def _n(id: str, type: str, x: int, y: int, **data: Any) -> dict[str, Any]:
    return {"id": id, "type": type, "position": {"x": x, "y": y}, "data": data}


def _e(source: str, target: str, handle: str = "next") -> dict[str, Any]:
    return {"id": f"e-{source}-{handle}-{target}", "source": source, "sourceHandle": handle, "target": target}


def blank() -> dict[str, Any]:
    return {"nodes": [_n("start", "trigger", 0, 0, kind="start", value="")], "edges": []}


def welcome_sale() -> dict[str, Any]:
    """Приветствие → кнопка «Хочу гайд» → продажа → через сутки дожим, если не купил."""
    nodes = [
        _n("start", "trigger", 0, 120, kind="start", value=""),
        _n("hello", "message", 300, 80,
           text="Здравствуйте, {first_name}! 👋\n\nЯ помогу разобраться с визой без стресса. "
                "Хотите пошаговый гайд?",
           buttons=[{"id": "want", "type": "next", "text": "Да, хочу гайд"}]),
        _n("offer", "offer", 640, 100, product_id=None),
        _n("wait", "delay", 960, 100, amount=1, unit="days"),
        _n("paid", "condition", 1260, 100, kind="purchased", product_id=None),
        _n("remind", "message", 1580, 200,
           text="{first_name}, вы смотрели гайд, но так и не забрали его. "
                "Остались вопросы? Ответьте на это сообщение — помогу.",
           buttons=[]),
    ]
    edges = [_e("start", "hello"), _e("hello", "offer", "btn:want"), _e("offer", "wait"),
             _e("wait", "paid"), _e("paid", "remind", "no")]
    return {"nodes": nodes, "edges": edges}


def lead_magnet() -> dict[str, Any]:
    """Бесплатный файл за email → через час предложение платного продукта."""
    nodes = [
        _n("start", "trigger", 0, 120, kind="start", value=""),
        _n("hello", "message", 300, 100,
           text="Привет, {first_name}! Дарю бесплатный чек-лист документов на визу 🎁",
           buttons=[{"id": "get", "type": "next", "text": "Забрать чек-лист"}]),
        _n("email", "question", 620, 100,
           text="Куда прислать обновления? Напишите ваш email:", var="email", validate="email"),
        _n("gift", "files", 940, 100, product_id=None),
        _n("tag", "tag", 1240, 100, action="add", tag="лид"),
        _n("wait", "delay", 1540, 100, amount=1, unit="hours"),
        _n("offer", "offer", 1840, 100, product_id=None),
    ]
    edges = [_e("start", "hello"), _e("hello", "email", "btn:get"), _e("email", "gift"),
             _e("gift", "tag"), _e("tag", "wait"), _e("wait", "offer")]
    return {"nodes": nodes, "edges": edges}


def subscribe_gift() -> dict[str, Any]:
    """Подарок за подписку на канал: проверка подписки и повтор, пока не подпишется."""
    nodes = [
        _n("start", "trigger", 0, 120, kind="start", value=""),
        _n("ask", "message", 300, 80,
           text="{first_name}, дарю бесплатный чек-лист 🎁\n\n"
                "Подпишитесь на канал, а затем нажмите «Я подписался».",
           buttons=[{"id": "chan", "type": "url", "text": "Перейти в канал", "url": ""},
                    {"id": "done", "type": "next", "text": "Я подписался"}]),
        _n("check", "condition", 640, 100, kind="subscribed", channel=""),
        _n("gift", "files", 960, 40, product_id=None),
        _n("nope", "message", 960, 260,
           text="Пока не вижу подписки 🙈 Подпишитесь на канал и нажмите кнопку ещё раз.",
           buttons=[{"id": "again", "type": "next", "text": "Проверить ещё раз"}]),
    ]
    edges = [_e("start", "ask"), _e("ask", "check", "btn:done"), _e("check", "gift", "yes"),
             _e("check", "nope", "no"), _e("nope", "check", "btn:again")]
    return {"nodes": nodes, "edges": edges}


TEMPLATES = {
    "blank": blank,
    "welcome_sale": welcome_sale,
    "lead_magnet": lead_magnet,
    "subscribe_gift": subscribe_gift,
}
