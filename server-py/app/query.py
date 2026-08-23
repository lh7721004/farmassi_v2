"""
데이터 게이트웨이.

프론트가 쓰던 조회 형태(컬럼 목록, 임베드 관계, eq/in, order, limit, single)를
그대로 받아 SQL 로 옮긴다. 값은 전부 파라미터로 넘기고, 테이블·컬럼 이름은
스키마 메타데이터에 있는 것만 통과시킨다.

행 단위 접근 제어는 여기서 하지 않는다. RLS 가 한다.
"""
from dataclasses import dataclass, field
from typing import Any

import asyncpg

from .schema import (
    SchemaInfo, UnknownIdentifierError, assert_column, assert_table,
    find_relation, invalidate_schema, load_schema,
)


@dataclass
class SelectNode:
    columns: list[str] = field(default_factory=list)   # 빈 목록이면 전체(*)
    embeds: list[tuple[str, str, "SelectNode"]] = field(default_factory=list)  # (별칭, 테이블, 노드)


def _split_top_level(text: str) -> list[str]:
    out: list[str] = []
    depth = 0
    current = ""
    for ch in text:
        if ch == "(":
            depth += 1
        if ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            if current.strip():
                out.append(current.strip())
            current = ""
            continue
        current += ch
    if current.strip():
        out.append(current.strip())
    return out


def parse_select(text: str | None) -> SelectNode:
    """'a, b, rel(x, y), alias:rel2(*)' 를 트리로 만든다."""
    node = SelectNode()
    text = (text or "*").strip()
    if text in ("", "*"):
        return node

    for part in _split_top_level(text):
        open_at = part.find("(")
        if open_at == -1:
            if part != "*":
                node.columns.append(part)
            continue
        head = part[:open_at].strip()
        inner = part[open_at + 1 : part.rfind(")")]
        pieces = [s.strip() for s in head.split(":")]
        alias = pieces[0]
        table = pieces[1] if len(pieces) > 1 else pieces[0]
        node.embeds.append((alias, table, parse_select(inner)))
    return node


def _quote(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


@dataclass
class _Ctx:
    schema: SchemaInfo
    params: list[Any] = field(default_factory=list)
    alias_n: int = 0

    def next_alias(self) -> str:
        self.alias_n += 1
        return f"t{self.alias_n}"

    def bind(self, value: Any) -> str:
        self.params.append(value)
        return f"${len(self.params)}"


def _build_select_list(ctx: _Ctx, table: str, alias: str, node: SelectNode) -> str:
    """select 목록을 만든다. 임베드는 스칼라 서브쿼리로 붙인다."""
    pieces: list[str] = []

    if not node.columns:
        pieces.append(f"{alias}.*")
    else:
        for column in node.columns:
            assert_column(ctx.schema, table, column)
            pieces.append(f"{alias}.{_quote(column)}")

    for embed_alias, embed_table, embed_node in node.embeds:
        assert_table(ctx.schema, embed_table)
        relation = find_relation(ctx.schema, table, embed_table)
        child = ctx.next_alias()
        inner = _build_select_list(ctx, embed_table, child, embed_node)
        join = f"{child}.{_quote(relation.foreign_column)} = {alias}.{_quote(relation.local_column)}"

        if relation.kind == "one-to-many":
            pieces.append(
                f"coalesce((select json_agg(row_to_json(sub)) from "
                f"(select {inner} from {_quote(embed_table)} {child} where {join}) sub), '[]'::json)"
                f" as {_quote(embed_alias)}"
            )
        else:
            pieces.append(
                f"(select row_to_json(sub) from "
                f"(select {inner} from {_quote(embed_table)} {child} where {join} limit 1) sub)"
                f" as {_quote(embed_alias)}"
            )

    return ", ".join(pieces)


def _build_where(ctx: _Ctx, table: str, alias: str, filters: list[dict] | None) -> str:
    if not filters:
        return ""
    clauses = []
    for f in filters:
        assert_column(ctx.schema, table, f["column"])
        column = f"{alias}.{_quote(f['column'])}"
        op, value = f["op"], f.get("value")
        if op == "eq":
            clauses.append(f"{column} = {ctx.bind(value)}")
        elif op == "neq":
            clauses.append(f"{column} <> {ctx.bind(value)}")
        elif op == "gt":
            clauses.append(f"{column} > {ctx.bind(value)}")
        elif op == "gte":
            clauses.append(f"{column} >= {ctx.bind(value)}")
        elif op == "lt":
            clauses.append(f"{column} < {ctx.bind(value)}")
        elif op == "lte":
            clauses.append(f"{column} <= {ctx.bind(value)}")
        elif op == "like":
            clauses.append(f"{column} like {ctx.bind(value)}")
        elif op == "ilike":
            clauses.append(f"{column} ilike {ctx.bind(value)}")
        elif op == "is":
            clauses.append(f"{column} is null" if value is None else f"{column} is {ctx.bind(value)}")
        elif op == "in":
            items = value if isinstance(value, list) else [value]
            clauses.append("false" if not items else f"{column} = any({ctx.bind(items)})")
        else:
            raise Exception(f"지원하지 않는 연산자: {op}")
    return " where " + " and ".join(clauses)


@dataclass
class QueryResult:
    data: Any
    count: int | None


async def run_query(conn: asyncpg.Connection, request: dict) -> QueryResult:
    """
    스키마 캐시는 기동 시 한 번 읽는다. 마이그레이션으로 컬럼이 늘면 캐시가 낡아
    멀쩡한 컬럼을 '알 수 없는 컬럼'으로 막는다. 그때 한 번만 다시 읽고 재시도한다.
    """
    try:
        return await _run_once(conn, request)
    except UnknownIdentifierError:
        invalidate_schema()
        return await _run_once(conn, request)


def _int(value: Any) -> int:
    """Node 의 `Number(x) | 0` 과 같게 — 정수로 자른다."""
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


async def _rows(conn: asyncpg.Connection, sql: str, params: list[Any]) -> list[dict]:
    return [dict(r) for r in await conn.fetch(sql, *params)]


async def _run_once(conn: asyncpg.Connection, request: dict) -> QueryResult:
    schema = await load_schema()
    table = request["table"]
    assert_table(schema, table)
    op = request.get("op") or "select"
    ctx = _Ctx(schema)
    alias = "t0"

    if op == "select":
        count: int | None = None
        if request.get("count") == "exact":
            count_ctx = _Ctx(schema, alias_n=100)
            where = _build_where(count_ctx, table, alias, request.get("filters"))
            sql = f"select count(*)::int as n from {_quote(table)} {alias}{where}"
            count = await conn.fetchval(sql, *count_ctx.params)
            if request.get("head"):
                return QueryResult(None, count)

        node = parse_select(request.get("select"))
        sql = f"select {_build_select_list(ctx, table, alias, node)} from {_quote(table)} {alias}"
        sql += _build_where(ctx, table, alias, request.get("filters"))

        if request.get("order"):
            parts = []
            for o in request["order"]:
                assert_column(schema, table, o["column"])
                direction = "desc" if o.get("ascending") is False else "asc"
                nulls_first = o.get("nullsFirst")
                nulls = "" if nulls_first is None else (" nulls first" if nulls_first else " nulls last")
                parts.append(f"{alias}.{_quote(o['column'])} {direction}{nulls}")
            sql += " order by " + ", ".join(parts)

        single = request.get("single")
        limit = request.get("limit")
        if single:
            # single/maybeSingle 은 2건 이상인지 알아야 판정이 된다. 다만 호출부가 limit 을
            # 줬으면 그 값을 넘기지 않는다 (.limit(1).maybeSingle() 이 오류가 되면 안 된다).
            sql += f" limit {min(_int(limit), 2) if limit is not None else 2}"
        elif limit is not None:
            sql += f" limit {_int(limit)}"
        if request.get("offset"):
            sql += f" offset {_int(request['offset'])}"

        rows = await _rows(conn, sql, ctx.params)
        if single == "one":
            if len(rows) != 1:
                raise Exception("행을 찾을 수 없습니다." if not rows else "행이 여러 개입니다.")
            return QueryResult(rows[0], count)
        if single == "maybe":
            if len(rows) > 1:
                raise Exception("행이 여러 개입니다.")
            return QueryResult(rows[0] if rows else None, count)
        return QueryResult(rows, count)

    if op in ("insert", "upsert"):
        values = request.get("values")
        rows_in = values if isinstance(values, list) else [values or {}]
        if not rows_in:
            return QueryResult([], None)
        columns = list(dict.fromkeys(k for row in rows_in for k in row))
        for column in columns:
            assert_column(schema, table, column)

        tuples = ", ".join(
            "(" + ", ".join(ctx.bind(row.get(c)) for c in columns) + ")" for row in rows_in
        )
        sql = (f"insert into {_quote(table)} ({', '.join(_quote(c) for c in columns)})"
               f" values {tuples}")

        if op == "upsert":
            conflict = [c.strip() for c in (request.get("onConflict") or "id").split(",")]
            for column in conflict:
                assert_column(schema, table, column)
            updates = [c for c in columns if c not in conflict]
            sql += f" on conflict ({', '.join(_quote(c) for c in conflict)}) do " + (
                "update set " + ", ".join(f"{_quote(c)} = excluded.{_quote(c)}" for c in updates)
                if updates else "nothing"
            )

        if request.get("returning") is not False:
            sql += " returning *"
        rows = await _rows(conn, sql, ctx.params)
        if request.get("single"):
            return QueryResult(rows[0] if rows else None, None)
        return QueryResult(rows, None)

    if op == "update":
        values = request.get("values") or {}
        if not values:
            raise Exception("수정할 값이 없습니다.")
        for column in values:
            assert_column(schema, table, column)

        sql = f"update {_quote(table)} {alias} set " + ", ".join(
            f"{_quote(c)} = {ctx.bind(v)}" for c, v in values.items()
        )
        sql += _build_where(ctx, table, alias, request.get("filters"))
        if request.get("returning") is not False:
            sql += " returning *"
        rows = await _rows(conn, sql, ctx.params)
        if request.get("single"):
            return QueryResult(rows[0] if rows else None, None)
        return QueryResult(rows, None)

    if op == "delete":
        sql = f"delete from {_quote(table)} {alias}"
        sql += _build_where(ctx, table, alias, request.get("filters"))
        if request.get("returning") is not False:
            sql += " returning *"
        return QueryResult(await _rows(conn, sql, ctx.params), None)

    raise Exception(f"지원하지 않는 동작: {op}")
