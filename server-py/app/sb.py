"""
Supabase 클라이언트와 같은 모양의 빌더.

Edge Function 들이 `admin.from_('orders').select('*').eq('id', x).maybe_single()`
형태로 쓰여 있다. 그 코드를 그대로 옮기기 위해 같은 문법을 게이트웨이 위에 얹는다.
반환도 Supabase 와 같은 (data, error) 다.

체이닝 끝에서 await 하면 실행된다 — __await__ 를 구현해 뒀다.
"""
from dataclasses import dataclass
from typing import Any, Generator

import asyncpg

from .query import run_query


@dataclass
class Result:
    data: Any
    error: dict | None


class Builder:
    def __init__(self, conn: asyncpg.Connection, table: str):
        self._conn = conn
        self._request: dict[str, Any] = {"table": table, "op": "select"}

    def select(self, columns: str = "*") -> "Builder":
        self._request["select"] = columns
        if self._request["op"] != "select":
            self._request["returning"] = True
        return self

    def insert(self, values: Any) -> "Builder":
        self._request.update(op="insert", values=values)
        return self

    def upsert(self, values: Any, on_conflict: str | None = None) -> "Builder":
        self._request.update(op="upsert", values=values)
        if on_conflict:
            self._request["onConflict"] = on_conflict
        return self

    def update(self, values: Any) -> "Builder":
        self._request.update(op="update", values=values)
        return self

    def delete(self) -> "Builder":
        self._request["op"] = "delete"
        return self

    def _filter(self, column: str, op: str, value: Any) -> "Builder":
        self._request.setdefault("filters", []).append({"column": column, "op": op, "value": value})
        return self

    def eq(self, column: str, value: Any) -> "Builder":
        return self._filter(column, "eq", value)

    def neq(self, column: str, value: Any) -> "Builder":
        return self._filter(column, "neq", value)

    def in_(self, column: str, value: list) -> "Builder":
        return self._filter(column, "in", value)

    def gte(self, column: str, value: Any) -> "Builder":
        return self._filter(column, "gte", value)

    def lte(self, column: str, value: Any) -> "Builder":
        return self._filter(column, "lte", value)

    def is_(self, column: str, value: Any) -> "Builder":
        return self._filter(column, "is", value)

    def order(self, column: str, ascending: bool = True) -> "Builder":
        self._request.setdefault("order", []).append({"column": column, "ascending": ascending})
        return self

    def limit(self, n: int) -> "Builder":
        self._request["limit"] = n
        return self

    def single(self) -> "Builder":
        self._request["single"] = "one"
        return self

    def maybe_single(self) -> "Builder":
        self._request["single"] = "maybe"
        return self

    async def run(self) -> Result:
        try:
            result = await run_query(self._conn, self._request)
            return Result(result.data, None)
        except Exception as error:  # noqa: BLE001 — Supabase 와 같이 오류를 값으로 돌려준다
            return Result(None, {"message": str(error)})

    def __await__(self) -> Generator[Any, None, Result]:
        return self.run().__await__()


class Sb:
    def __init__(self, conn: asyncpg.Connection):
        self._conn = conn

    def from_(self, table: str) -> Builder:
        return Builder(self._conn, table)


def sb(conn: asyncpg.Connection) -> Sb:
    return Sb(conn)
