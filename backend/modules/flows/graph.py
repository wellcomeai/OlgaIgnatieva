"""Граф воронки: проверка и навигация.

Формат — как у React Flow на фронтенде:
    {"nodes": [{"id", "type", "position": {"x", "y"}, "data": {...}}],
     "edges": [{"id", "source", "sourceHandle", "target"}]}

Выходы (sourceHandle): "next"; у сообщения — "btn:<id>" для кнопок-веток;
у условия — "yes" / "no".

Две степени строгости: структурные ошибки (битые связи, неизвестные блоки)
не дают сохранить вообще; ошибки содержания (пустой текст, не выбран
продукт) мешают только включить воронку — черновик сохранить можно.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

NODE_TYPES = {"trigger", "message", "delay", "question", "offer", "files", "condition", "tag"}
TRIGGER_KINDS = {"start", "start_label", "keyword", "purchase"}
DELAY_UNITS = {"minutes": 60, "hours": 3600, "days": 86400}
QUESTION_VALIDATE = {"any", "email", "phone"}
CONDITION_KINDS = {"purchased", "has_tag", "has_var", "subscribed"}

ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
BTN_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,12}$")
LABEL_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
VAR_RE = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
URL_RE = re.compile(r"^(https?|tg)://\S+$")
MAX_NODES = 200
MAX_DELAY_SECONDS = 90 * 86400


class GraphError(ValueError):
    """Структурная ошибка — граф нельзя сохранить."""


@dataclass
class Validation:
    trigger_kind: str
    trigger_value: str
    # Ошибки содержания: «Блок «Сообщение»: введите текст»
    problems: list[str] = field(default_factory=list)


def node_map(graph: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {n["id"]: n for n in graph.get("nodes", [])}


def trigger_node(graph: dict[str, Any]) -> dict[str, Any]:
    return next(n for n in graph["nodes"] if n["type"] == "trigger")


def outgoing(graph: dict[str, Any], node_id: str, handle: str) -> str | None:
    for e in graph.get("edges", []):
        if e["source"] == node_id and (e.get("sourceHandle") or "next") == handle:
            return e["target"]
    return None


def next_buttons(data: dict[str, Any]) -> list[dict[str, Any]]:
    return [b for b in data.get("buttons") or [] if b.get("type") == "next"]


def delay_seconds(data: dict[str, Any]) -> int:
    return int(data.get("amount") or 0) * DELAY_UNITS.get(data.get("unit"), 60)


def _handles(node: dict[str, Any]) -> set[str]:
    t, d = node["type"], node.get("data") or {}
    if t == "condition":
        return {"yes", "no"}
    if t == "message":
        btns = next_buttons(d)
        return {f"btn:{b['id']}" for b in btns} if btns else {"next"}
    return {"next"}


def _text(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def validate(graph: Any, product_ids: set[str]) -> Validation:
    if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), list) or not isinstance(graph.get("edges"), list):
        raise GraphError("Неверный формат схемы")
    nodes = graph["nodes"]
    if len(nodes) > MAX_NODES:
        raise GraphError(f"Не больше {MAX_NODES} блоков в одной воронке")

    ids: set[str] = set()
    for n in nodes:
        if not isinstance(n, dict) or not isinstance(n.get("id"), str) or not ID_RE.match(n["id"]):
            raise GraphError("Неверный идентификатор блока")
        if n["id"] in ids:
            raise GraphError("Повторяющийся идентификатор блока")
        if n.get("type") not in NODE_TYPES:
            raise GraphError(f"Неизвестный тип блока: {n.get('type')}")
        if not isinstance(n.get("data", {}), dict):
            raise GraphError("Неверные настройки блока")
        ids.add(n["id"])

    triggers = [n for n in nodes if n["type"] == "trigger"]
    if len(triggers) != 1:
        raise GraphError("В воронке должен быть ровно один триггер")

    problems: list[str] = []
    labels = {
        "message": "Сообщение", "delay": "Пауза", "question": "Вопрос", "offer": "Продажа",
        "files": "Файлы", "condition": "Условие", "tag": "Тег", "trigger": "Старт",
    }

    for n in nodes:
        t, d = n["type"], n.get("data") or {}
        name = f"Блок «{d.get('title') or labels[t]}»"
        if t == "trigger":
            kind = d.get("kind")
            if kind not in TRIGGER_KINDS:
                raise GraphError("Неизвестный тип триггера")
            value = _text(d.get("value"))
            if kind == "start_label" and not LABEL_RE.match(value):
                problems.append("Старт: метка — латиница, цифры, _ и -, до 64 символов")
            elif kind == "start_label" and value.startswith("buy-"):
                problems.append("Старт: метки на buy- зарезервированы под ссылки на покупку")
            elif kind == "keyword" and not (1 <= len(value) <= 64):
                problems.append("Старт: укажите ключевое слово")
            elif kind == "purchase" and value not in product_ids:
                problems.append("Старт: выберите продукт, после оплаты которого запускать воронку")
        elif t == "message":
            if not _text(d.get("text")):
                problems.append(f"{name}: введите текст")
            elif len(d["text"]) > 4096:
                problems.append(f"{name}: текст длиннее 4096 символов")
            buttons = d.get("buttons") or []
            if not isinstance(buttons, list) or len(buttons) > 8:
                raise GraphError(f"{name}: не больше 8 кнопок")
            btn_ids: set[str] = set()
            for b in buttons:
                if not isinstance(b, dict) or not BTN_ID_RE.match(str(b.get("id", ""))) or b["id"] in btn_ids:
                    raise GraphError(f"{name}: неверная кнопка")
                btn_ids.add(b["id"])
                if b.get("type") not in ("next", "url"):
                    raise GraphError(f"{name}: неизвестный тип кнопки")
                if not (1 <= len(_text(b.get("text"))) <= 64):
                    problems.append(f"{name}: у кнопки нет текста")
                if b["type"] == "url" and not URL_RE.match(_text(b.get("url"))):
                    problems.append(f"{name}: ссылка кнопки должна начинаться с https://")
        elif t == "delay":
            if d.get("unit") not in DELAY_UNITS:
                raise GraphError(f"{name}: неизвестная единица времени")
            try:
                secs = delay_seconds(d)
            except (TypeError, ValueError):
                raise GraphError(f"{name}: неверная длительность")
            if not (1 <= secs <= MAX_DELAY_SECONDS):
                problems.append(f"{name}: пауза от 1 минуты до 90 дней")
        elif t == "question":
            if not _text(d.get("text")):
                problems.append(f"{name}: введите вопрос")
            if not VAR_RE.match(_text(d.get("var"))):
                problems.append(f"{name}: имя поля — латиница в нижнем регистре, например email")
            if d.get("validate", "any") not in QUESTION_VALIDATE:
                raise GraphError(f"{name}: неизвестная проверка ответа")
        elif t in ("offer", "files"):
            if d.get("product_id") not in product_ids:
                problems.append(f"{name}: выберите продукт")
        elif t == "condition":
            kind = d.get("kind")
            if kind not in CONDITION_KINDS:
                raise GraphError(f"{name}: неизвестный тип условия")
            if kind == "purchased" and d.get("product_id") not in product_ids:
                problems.append(f"{name}: выберите продукт")
            if kind == "has_tag" and not _text(d.get("tag")):
                problems.append(f"{name}: укажите тег")
            if kind == "has_var" and not VAR_RE.match(_text(d.get("var"))):
                problems.append(f"{name}: укажите поле, например email")
            if kind == "subscribed":
                from modules.bots.channels import parse_channel

                if parse_channel(d.get("channel")) is None:
                    problems.append(f"{name}: укажите канал — https://t.me/имя_канала или @имя_канала")
        elif t == "tag":
            if d.get("action") not in ("add", "remove"):
                raise GraphError(f"{name}: неизвестное действие")
            if not (1 <= len(_text(d.get("tag"))) <= 32):
                problems.append(f"{name}: укажите тег (до 32 символов)")

    by_id = node_map(graph)
    used: set[tuple[str, str]] = set()
    for e in graph["edges"]:
        if not isinstance(e, dict) or e.get("source") not in by_id or e.get("target") not in by_id:
            raise GraphError("Связь указывает на несуществующий блок")
        if by_id[e["target"]]["type"] == "trigger":
            raise GraphError("В старт воронки нельзя вести стрелку")
        handle = e.get("sourceHandle") or "next"
        if handle not in _handles(by_id[e["source"]]):
            raise GraphError("Связь от несуществующего выхода блока")
        if (e["source"], handle) in used:
            raise GraphError("Из одного выхода может идти только одна стрелка")
        used.add((e["source"], handle))

    trig = triggers[0].get("data") or {}
    if not outgoing(graph, triggers[0]["id"], "next"):
        problems.append("Старт: соедините старт со следующим блоком")
    return Validation(trigger_kind=trig.get("kind"), trigger_value=_text(trig.get("value")), problems=problems)
