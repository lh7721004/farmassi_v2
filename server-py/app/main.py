"""
farmassi API (FastAPI).

Node 서버(server/)를 옮기는 중이다. 두 서버가 동시에 떠 있어도 되도록
경로별로 nginx 에서 넘긴다. 응답 형태는 Node 쪽과 같아야 한다 —
프론트가 그 형태에 맞춰져 있고 거슬러 올라가면 PostgREST 형식이다.
"""
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from . import db
from .config import config
from .jwt_session import verify
from .version import VERSION


@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.connect()
    print(f"farmassi API (py) v{VERSION['version']} ({VERSION['commit']}) → http://127.0.0.1:{config.port}")
    yield
    await db.disconnect()


app = FastAPI(lifespan=lifespan, docs_url="/docs", redoc_url=None)


@app.middleware("http")
async def cors(request: Request, call_next):
    """
    Node 의 cors() 와 같게 동작시킨다.

    브라우저가 자격증명을 보내야 하므로 * 를 쓸 수 없다. 허용한 출처만
    그대로 돌려준다. FastAPI 의 CORSMiddleware 를 쓰지 않은 이유는
    허용되지 않은 출처에도 헤더를 붙이는 등 세부가 달라서다.
    """
    origin = request.headers.get("origin")
    if request.method == "OPTIONS":
        response = JSONResponse(None, status_code=204)
    else:
        response = await call_next(request)

    if origin and (origin in config.site_origins or origin.startswith("http://localhost")):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "authorization, content-type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
    return response


def user_id(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        return None
    claims = verify(header[7:])
    return claims["sub"] if claims else None


@app.exception_handler(Exception)
async def on_error(_: Request, exc: Exception):
    """Node 쪽과 같이 처리 실패는 400 에 { error } 로 낸다."""
    return JSONResponse({"error": str(exc)}, status_code=400)


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/version")
async def version():
    """화면에서 지금 돌고 있는 서버가 무엇인지 보여주기 위한 것."""
    return VERSION


@app.get("/auth/me")
async def auth_me(uid: str | None = Depends(user_id)):
    if not uid:
        return {"user": None}
    async with db.with_user(uid) as conn:
        row = await conn.fetchrow("select * from profiles where id = $1", uid)
    return {"user": {"id": uid, "profile": dict(row)} if row else None}
