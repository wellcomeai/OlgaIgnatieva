"""Шифрование токенов ботов (Fernet, AES-128-CBC + HMAC).

Токен в открытом виде живёт только в памяти на время запроса к Telegram:
в БД, логах и ответах API его нет.
"""
from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet

from config import settings


@lru_cache
def _fernet() -> Fernet:
    key = settings.bot_token_encryption_key
    if not key:
        digest = hashlib.sha256(f"bot-token:{settings.secret_key}".encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key)


def encrypt_token(token: str) -> str:
    return _fernet().encrypt(token.encode()).decode()


def decrypt_token(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()


# Тот же ключ используется для прочих секретов платформы (настройки интеграций)
encrypt_secret = encrypt_token
decrypt_secret = decrypt_token
