"""
스키마 메타데이터.

쿼리 게이트웨이는 클라이언트가 보낸 테이블명·컬럼명을 SQL 에 그대로 넣는다.
그래서 여기 등록된 이름만 통과시킨다. 값은 전부 파라미터로 넘기므로,
식별자 화이트리스트 + 파라미터 바인딩 두 겹으로 주입을 막는다.
"""
from dataclasses import dataclass
from typing import Literal

import asyncpg

from . import db


@dataclass(frozen=True)
class ForeignKey:
    table: str          # 참조하는 쪽 (자식)
    column: str         # 자식의 FK 컬럼
    target_table: str   # 참조되는 쪽 (부모)
    target_column: str


@dataclass(frozen=True)
class SchemaInfo:
    columns: dict[str, set[str]]
    foreign_keys: list[ForeignKey]


@dataclass(frozen=True)
class Relation:
    kind: Literal["many-to-one", "one-to-many"]
    local_column: str
    foreign_column: str


class UnknownIdentifierError(Exception):
    """캐시에 없는 이름일 때 던진다. 마이그레이션 직후일 수 있으므로 호출부가 한 번 다시 읽는다."""


_cache: SchemaInfo | None = None


async def load_schema() -> SchemaInfo:
    global _cache
    if _cache is not None:
        return _cache

    async with db.with_admin() as conn:
        cols = await conn.fetch(
            "select table_name, column_name from information_schema.columns"
            " where table_schema = 'public'"
        )
        columns: dict[str, set[str]] = {}
        for row in cols:
            columns.setdefault(row["table_name"], set()).add(row["column_name"])

        # information_schema 는 권한으로 걸러져서 테이블 소유자가 아니면 제약을 못 본다.
        # pg_catalog 는 그런 필터가 없다.
        fks = await conn.fetch("""
            select con.conrelid::regclass::text  as "table",
                   att.attname                   as "column",
                   con.confrelid::regclass::text as target_table,
                   fatt.attname                  as target_column
              from pg_constraint con
              join pg_namespace ns on ns.oid = con.connamespace and ns.nspname = 'public'
              join unnest(con.conkey)  with ordinality as k(attnum, ord) on true
              join unnest(con.confkey) with ordinality as f(attnum, ord) on f.ord = k.ord
              join pg_attribute att  on att.attrelid  = con.conrelid  and att.attnum  = k.attnum
              join pg_attribute fatt on fatt.attrelid = con.confrelid and fatt.attnum = f.attnum
             where con.contype = 'f'
        """)

    _cache = SchemaInfo(
        columns=columns,
        foreign_keys=[
            ForeignKey(r["table"], r["column"], r["target_table"], r["target_column"]) for r in fks
        ],
    )
    return _cache


def invalidate_schema() -> None:
    """스키마가 바뀌었을 수 있을 때 캐시를 버린다."""
    global _cache
    _cache = None


def assert_table(schema: SchemaInfo, table: str) -> None:
    if table not in schema.columns:
        raise UnknownIdentifierError(f"알 수 없는 테이블: {table}")


def assert_column(schema: SchemaInfo, table: str, column: str) -> None:
    if column not in schema.columns.get(table, ()):
        raise UnknownIdentifierError(f"알 수 없는 컬럼: {table}.{column}")


def find_relation(schema: SchemaInfo, source: str, target: str) -> Relation:
    """
    source 테이블에서 target 테이블을 임베드할 때의 관계를 찾는다.

    many-to-one : source 가 target 을 가리키는 FK 를 갖고 있다 (orders.farm_id → farms.id)
    one-to-many : target 이 source 를 가리키는 FK 를 갖고 있다 (order_items.order_id → orders.id)
    """
    for fk in schema.foreign_keys:
        if fk.table == source and fk.target_table == target:
            return Relation("many-to-one", fk.column, fk.target_column)
    for fk in schema.foreign_keys:
        if fk.table == target and fk.target_table == source:
            return Relation("one-to-many", fk.target_column, fk.column)
    raise Exception(f"{source} 과 {target} 사이의 관계를 찾을 수 없습니다.")
