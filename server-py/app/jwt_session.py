"""
세션 토큰. Node 서버가 발급한 토큰과 상호 호환된다.

같은 HS256 / 같은 시크릿이라 양쪽이 서로의 토큰을 검증한다. 서명 대상이
실제 헤더 바이트라, 헤더 키 순서가 달라도 문제되지 않는다. 이관 중에
두 서버가 함께 떠 있어도 로그인이 풀리지 않게 하려는 것.
"""
import time

import jwt

from .config import config


def sign(sub: str, days: int | None = None) -> str:
    exp = int(time.time()) + (days if days is not None else config.session_days) * 86400
    return jwt.encode(
        {"sub": sub, "role": "authenticated", "exp": exp}, config.jwt_secret, algorithm="HS256"
    )


def verify(token: str) -> dict | None:
    try:
        claims = jwt.decode(token, config.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return claims if isinstance(claims.get("sub"), str) and claims["sub"] else None
