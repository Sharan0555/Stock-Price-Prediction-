from __future__ import annotations
import json
import time
import hashlib
import functools
from typing import Any

_store: dict[str, tuple[Any, float]] = {}

def _make_key(*args, **kwargs) -> str:
    raw = json.dumps({"a": str(args), "k": str(kwargs)}, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()

def _get(key: str) -> Any | None:
    entry = _store.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.time() > expires_at:
        del _store[key]
        return None
    return value

def _set(key: str, value: Any, ttl: int) -> None:
    _store[key] = (value, time.time() + ttl)

def cache_result(ttl_seconds: int = 300, prefix: str = ""):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            key = prefix + _make_key(*args, **kwargs)
            cached = _get(key)
            if cached is not None:
                return cached
            result = await func(*args, **kwargs)
            _set(key, result, ttl_seconds)
            return result
        return wrapper
    return decorator

def invalidate_all() -> int:
    count = len(_store)
    _store.clear()
    return count

def cache_stats() -> dict:
    now = time.time()
    alive = sum(1 for _, (_, exp) in _store.items() if exp > now)
    return {"total_keys": len(_store), "alive": alive, "expired": len(_store) - alive}
