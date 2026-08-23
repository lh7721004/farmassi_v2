from dataclasses import dataclass
from typing import Any, Awaitable, Callable

import asyncpg


@dataclass
class FnCtx:
    user_id: str | None
    body: dict
    #: RLS 를 우회하는 커넥션. Edge Function 이 service_role 로 돌던 것과 같다.
    admin: asyncpg.Connection


@dataclass
class FnResult:
    status: int
    body: Any


def ok(body: Any = None) -> FnResult:
    return FnResult(200, {"ok": True} if body is None else body)


def fail(message: str, status: int = 400) -> FnResult:
    return FnResult(status, {"error": message})


FnHandler = Callable[[FnCtx], Awaitable[FnResult]]
