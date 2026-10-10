"""Хранение файлов продуктов на диске (MEDIA_ROOT)."""
from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path, PurePath

from fastapi import HTTPException, UploadFile

from config import settings

# Лимит Bot API на отправку файла ботом
MAX_FILE_SIZE = 50 * 1024 * 1024
_CHUNK = 1024 * 1024


def media_root() -> Path:
    return Path(settings.media_root).resolve()


def product_dir(product_id: uuid.UUID) -> Path:
    return media_root() / "products" / str(product_id)


def file_path(storage_name: str) -> Path:
    path = (media_root() / storage_name).resolve()
    if media_root() not in path.parents:
        raise ValueError("storage_name outside MEDIA_ROOT")
    return path


def safe_filename(name: str | None) -> str:
    """Имя для показа в Telegram: без путей и управляющих символов."""
    base = PurePath((name or "").replace("\\", "/")).name
    base = "".join(ch for ch in base if ch.isprintable()).strip()
    return base[:255] or "file"


async def save_upload(product_id: uuid.UUID, upload: UploadFile) -> tuple[str, int]:
    """Сохранить загружаемый файл потоково. Возвращает (storage_name, size)."""
    directory = product_dir(product_id)
    directory.mkdir(parents=True, exist_ok=True)
    suffix = Path(safe_filename(upload.filename)).suffix[:16]
    name = f"{uuid.uuid4().hex}{suffix}"
    target = directory / name
    tmp = directory / f".{name}.part"
    size = 0
    try:
        with tmp.open("wb") as fh:
            while chunk := await upload.read(_CHUNK):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Файл больше 50 МБ — Telegram не позволит боту его отправить",
                    )
                fh.write(chunk)
        if size == 0:
            raise HTTPException(status_code=422, detail="Пустой файл")
        os.replace(tmp, target)
    finally:
        tmp.unlink(missing_ok=True)
    return str(target.relative_to(media_root())), size


def delete_file(storage_name: str) -> None:
    try:
        file_path(storage_name).unlink(missing_ok=True)
    except ValueError:
        pass


def delete_product_dir(product_id: uuid.UUID) -> None:
    shutil.rmtree(product_dir(product_id), ignore_errors=True)
