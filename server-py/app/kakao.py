"""
카카오 로그인.

흐름: /auth/kakao/start → 카카오 동의화면 → /auth/kakao/callback
     → 우리 세션 토큰을 만들어 프론트로 ?code=<토큰> 으로 돌려보낸다.

프론트의 AuthCallback 이 원래 `?code=` 를 받아 세션으로 바꾸던 코드를 그대로 쓴다.
"""
import base64
import hashlib
import hmac
import json
from urllib.parse import urlencode, urlparse, urlsplit, urlunsplit, parse_qsl

import httpx

from . import db
from .config import config
from .jwt_session import sign

AUTHORIZE = "https://kauth.kakao.com/oauth/authorize"
TOKEN = "https://kauth.kakao.com/oauth/token"
PROFILE = "https://kapi.kakao.com/v2/user/me"


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64url_decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _mac(payload: str) -> str:
    return _b64url(hmac.new(config.jwt_secret.encode(), payload.encode(), hashlib.sha256).digest())


def pack_state(redirect: str) -> str:
    """돌아갈 주소를 서명해서 state 에 싣는다. 위조된 주소로 튕겨나가지 않게 하려는 것."""
    payload = _b64url(redirect.encode())
    return f"{payload}.{_mac(payload)}"


def unpack_state(state: str) -> str | None:
    parts = state.split(".")
    if len(parts) != 2 or not all(parts):
        return None
    payload, mac = parts
    if not hmac.compare_digest(mac, _mac(payload)):
        return None
    try:
        return _b64url_decode(payload).decode()
    except Exception:  # noqa: BLE001
        return None


def safe_redirect(raw: str | None) -> str:
    """우리 사이트로만 돌려보낸다. 열린 리다이렉트 방지."""
    fallback = f"{config.site_origin}/auth/callback"
    if not raw:
        return fallback
    try:
        url = urlparse(raw)
        if not url.scheme or not url.netloc:
            return fallback
        origin = f"{url.scheme}://{url.netloc}"
        if origin in config.site_origins or url.hostname == "localhost":
            return raw
        return fallback
    except Exception:  # noqa: BLE001
        return fallback


def _with_param(target: str, key: str, value: str) -> str:
    parts = urlsplit(target)
    query = parse_qsl(parts.query, keep_blank_values=True)
    query = [(k, v) for k, v in query if k != key] + [(key, value)]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def start_url(redirect: str | None) -> str:
    return AUTHORIZE + "?" + urlencode({
        "client_id": config.kakao.client_id,
        "redirect_uri": config.kakao.redirect_uri,
        "response_type": "code",
        "scope": "profile_nickname profile_image",
        "state": pack_state(safe_redirect(redirect)),
    })


async def callback_url(code: str | None, state: str | None) -> str:
    """콜백 처리 결과로 돌아갈 주소를 만든다. 실패해도 사유를 붙여 프론트로 보낸다."""
    target = safe_redirect(unpack_state(state) if state else None)

    def bail(message: str) -> str:
        return _with_param(target, "error_description", message)

    if not code:
        return bail("인가 코드가 없습니다.")

    try:
        form = {
            "grant_type": "authorization_code",
            "client_id": config.kakao.client_id,
            "redirect_uri": config.kakao.redirect_uri,
            "code": code,
        }
        if config.kakao.client_secret:
            form["client_secret"] = config.kakao.client_secret

        async with httpx.AsyncClient(timeout=20) as client:
            token_res = await client.post(
                TOKEN, data=form,
                headers={"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"})
            token_body = token_res.json()
            access_token = token_body.get("access_token")
            if not access_token:
                return bail(token_body.get("error_description") or "카카오 토큰 발급에 실패했습니다.")

            profile_res = await client.get(
                PROFILE, headers={"Authorization": f"Bearer {access_token}"})
            profile = profile_res.json()

        if not profile.get("id"):
            return bail("카카오 프로필을 가져오지 못했습니다.")

        kakao_id = str(profile["id"])
        account = profile.get("kakao_account") or {}
        detail = account.get("profile") or {}
        nickname = detail.get("nickname") or f"사용자{kakao_id[-4:]}"
        avatar = detail.get("profile_image_url")
        email = account.get("email")

        async with db.with_admin() as conn:
            found = await conn.fetchval(
                "select user_id from auth.identities"
                " where provider = 'kakao' and provider_user_id = $1", kakao_id)
            if found:
                # 닉네임/사진이 바뀌었을 수 있으니 갱신한다.
                await conn.execute(
                    "update public.profiles set display_name = $2,"
                    " avatar_url = coalesce($3, avatar_url) where id = $1",
                    found, nickname, avatar)
                user_id = found
            else:
                # auth.users 에 넣으면 트리거가 public.profiles 를 만든다.
                user_id = await conn.fetchval(
                    "insert into auth.users (email, raw_user_meta_data)"
                    " values ($1, $2) returning id",
                    email,
                    json.dumps({"nickname": nickname, "avatar_url": avatar, "provider": "kakao"}))
                await conn.execute(
                    "insert into auth.identities (provider, provider_user_id, user_id)"
                    " values ('kakao', $1, $2)", kakao_id, user_id)

        return _with_param(target, "code", sign(user_id))
    except Exception as error:  # noqa: BLE001
        return bail(str(error) or "로그인에 실패했습니다.")
