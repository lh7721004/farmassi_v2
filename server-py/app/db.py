"""
접속 풀과 타입 변환.

Node 서버(node-postgres)가 내던 JSON 과 바이트 단위로 같은 결과를 내는 것이
이 파일의 목적이다. 프론트가 그 형식에 맞춰져 있고, 원래는 PostgREST 형식이라
거슬러 올라가면 Supabase 시절까지 이어진다. 여기서 어긋나면 화면 곳곳에서
조용히 틀어지므로, 추측하지 말고 parity 테스트로 확인할 것.

node-postgres 가 텍스트 그대로(문자열로) 넘기는 타입들:
  int8(20), numeric(1700), timestamp(1114), timestamptz(1184)
asyncpg 는 기본적으로 int / Decimal / datetime 으로 바꾸므로 코덱을 덮어쓴다.
"""
import json
import re
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import asyncpg

from .config import config

_TZ_SUFFIX = re.compile(r"([+-]\d{2})$")


def _timestamptz(value: str) -> str:
    """'2026-08-23 12:39:02.655+00' → '2026-08-23T12:39:02.655+00:00'

    접속 시 timezone=UTC 를 걸어 두므로 오프셋은 항상 +00 이다.
    """
    return _TZ_SUFFIX.sub(r"\1:00", value.replace(" ", "T"))


def _timestamp(value: str) -> str:
    return value.replace(" ", "T")


async def _init(conn: asyncpg.Connection) -> None:
    # uuid 는 문자열로. int8 은 스키마에 없지만 count(*) 가 int8 이라 걸어 둔다.
    # numeric 도 지금은 안 쓰이나 나중에 금액 컬럼이 생기면 필요하다.
    passthrough = dict(encoder=str, decoder=str, schema="pg_catalog", format="text")
    for name in ("uuid", "int8", "numeric"):
        await conn.set_type_codec(name, **passthrough)
    # date 는 'YYYY-MM-DD' 문자열로 주고받는다. PostgREST 가 그렇게 냈고
    # HTML date 입력도 같은 형식이라, 화면에서 변환할 일이 없다.
    # asyncpg 기본값은 datetime.date 객체라 문자열을 넣으면 오류가 난다.
    await conn.set_type_codec("date", **passthrough)
    await conn.set_type_codec(
        "timestamptz", encoder=str, decoder=_timestamptz, schema="pg_catalog", format="text"
    )
    await conn.set_type_codec(
        "timestamp", encoder=str, decoder=_timestamp, schema="pg_catalog", format="text"
    )
    # asyncpg 는 json/jsonb 를 문자열로 준다. node-postgres 는 객체로 준다.
    for name in ("json", "jsonb"):
        await conn.set_type_codec(
            name, encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
        )


_app_pool: asyncpg.Pool | None = None
_admin_pool: asyncpg.Pool | None = None


async def connect() -> None:
    global _app_pool, _admin_pool
    common = dict(init=_init, server_settings={"timezone": "UTC"})
    _app_pool = await asyncpg.create_pool(config.db_app_url, min_size=1, max_size=10, **common)
    _admin_pool = await asyncpg.create_pool(config.db_admin_url, min_size=1, max_size=4, **common)


async def disconnect() -> None:
    for pool in (_app_pool, _admin_pool):
        if pool is not None:
            await pool.close()


@asynccontextmanager
async def with_user(user_id: str | None) -> AsyncIterator[asyncpg.Connection]:
    """
    사용자 컨텍스트를 걸고 작업한다.

    set_config 의 세 번째 인자가 true 라 트랜잭션이 끝나면 설정이 풀린다.
    풀에 반납된 커넥션에 이전 사용자 정보가 남지 않게 하려는 것이다.
    """
    assert _app_pool is not None, "connect() 를 먼저 불러야 합니다."
    async with _app_pool.acquire() as conn:
        async with conn.transaction():
            if user_id:
                await conn.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)", user_id
                )
                claims = {"sub": user_id, "role": "authenticated"}
            else:
                claims = {"role": "anon"}
            await conn.execute(
                "select set_config('request.jwt.claims', $1, true)", json.dumps(claims)
            )
            yield conn


@asynccontextmanager
async def with_admin() -> AsyncIterator[asyncpg.Connection]:
    """RLS 를 우회하는 작업. 호출부에서 스스로 권한을 확인해야 한다."""
    assert _admin_pool is not None, "connect() 를 먼저 불러야 합니다."
    async with _admin_pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "select set_config('request.jwt.claims', $1, true)",
                json.dumps({"role": "service_role"}),
            )
            yield conn


def rows_to_dicts(records: list[asyncpg.Record]) -> list[dict[str, Any]]:
    return [dict(r) for r in records]
