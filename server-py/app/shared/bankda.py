"""
뱅크다A 거래내역 조회 (bank_tr.php).

조회는 계좌당 5분에 한 번만 된다. 제한에 걸리면 응답 본문의 description 에
남은 시간이 담겨 오므로 그대로 올려보낸다.
"""
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

TRANSACTIONS_URL = "https://a.bankda.com/dtsvc/bank_tr.php"
ACCOUNT_URL = "https://a.bankda.com/dtsvc/hub_account.php"
MERCHANT_URL = "https://a.bankda.com/dtsvc/hub_merchant.php"
OTT_URL = "https://a.bankda.com/dtsvc/hub_ott.php"

#: 계좌 등록 Form 주소. 사람에게 링크로 건네는 쪽(GET)이다.
OTT_FORM_URL = "https://a.bankda.com/partner/account/ott?ott="

_KST = timezone(timedelta(hours=9))


class BankdaError(Exception):
    pass


def _access_token() -> str:
    token = (os.environ.get("BANKDA_ACCESS_TOKEN") or "").strip()
    if not token:
        raise BankdaError("BANKDA_ACCESS_TOKEN 이 설정되지 않았습니다.")
    return token


def _headers(content_type: str | None = None) -> dict[str, str]:
    token = _access_token()
    # 문서마다 표기가 달라 둘 다 보낸다.
    headers = {"Authorization": f"Bearer {token}", "access_token": token}
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def to_bankda_date(when: datetime) -> str:
    return when.astimezone(_KST).strftime("%Y%m%d")


def to_iso_at(bkdate: str, bktime: str) -> str:
    """거래일자(YYYYMMDD) + 거래시간(HHMMSS) 을 KST 기준 ISO 문자열로 바꾼다."""
    t = (bktime or "").rjust(6, "0")
    try:
        when = datetime(
            int(bkdate[0:4]), int(bkdate[4:6]), int(bkdate[6:8]),
            int(t[0:2]), int(t[2:4]), int(t[4:6]), tzinfo=_KST,
        )
    except ValueError:
        when = datetime.now(timezone.utc)
    utc = when.astimezone(timezone.utc)
    return utc.strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc.microsecond // 1000:03d}Z"


async def fetch_transactions(
    *, datefrom: str, dateto: str, accountnum: str | None = None, istest: bool = False
) -> list[dict[str, Any]]:
    body = {
        "datefrom": datefrom,
        "dateto": dateto,
        "datatype": "json",
        "charset": "utf8",
        "istest": "y" if istest else "n",
    }
    if accountnum:
        body["accountnum"] = re.sub(r"\D", "", accountnum)

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            TRANSACTIONS_URL, data=body,
            headers=_headers("application/x-www-form-urlencoded; charset=utf-8"),
        )
    if response.status_code >= 400:
        raise BankdaError(f"뱅크다 응답 오류 (HTTP {response.status_code})")

    try:
        parsed = response.json()
    except ValueError:
        raise BankdaError(f"JSON 이 아닌 응답을 받았습니다: {response.text[:200]}") from None

    rows = (parsed.get("response") or {}).get("bank") or []
    description = ((parsed.get("response") or {}).get("description") or "").strip()
    # 조회 제한이나 통신 오류는 description 에 담겨 온다.
    if not rows and description:
        raise BankdaError(description)
    return rows


async def list_accounts() -> list[dict[str, Any]]:
    """
    등록된 계좌 목록.

    거래내역 조회와 달리 5분 제한이 없다. 그래서 이 값의 last_scraping_at 을 지켜보다가
    바뀌었을 때만 거래내역을 가져온다. 뱅크다 스크래핑 주기(60분)에 맞춰 부르게 되므로
    헛걸음이 없다.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(ACCOUNT_URL, headers=_headers())
    try:
        parsed = response.json()
    except ValueError:
        raise BankdaError(f"계좌 목록 응답을 해석하지 못했습니다: {response.text[:200]}") from None
    if parsed.get("success") is False:
        raise BankdaError(parsed.get("message") or "계좌 목록 조회 실패")
    return parsed.get("data") or []


async def _post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            url, content=json.dumps(payload),
            headers=_headers("application/json; charset=utf-8"),
        )
    try:
        parsed = response.json()
    except ValueError:
        raise BankdaError(f"응답을 해석하지 못했습니다: {response.text[:200]}") from None
    # 뱅크다는 실패해도 HTTP 200 을 준다. 본문으로 판단해야 한다.
    if parsed.get("success") is False:
        raise BankdaError(parsed.get("message") or "요청이 실패했습니다.")
    if parsed.get("status") == "error":
        # OTT 는 사유를 error_message 에 담는다.
        raise BankdaError(parsed.get("error_message") or parsed.get("message")
                          or "요청이 실패했습니다.")
    return parsed


async def create_merchant(
    *, email: str, merchant_email: str, password: str, accounts_count: int = 1
) -> None:
    """가맹점 등록. password 는 영문+숫자 8~20자. email 과 email_sub 는 달라야 한다."""
    await _post_json(MERCHANT_URL, {
        "email": email,
        "email_sub": merchant_email,
        "password": password,
        "customer_accounts_count": accounts_count,
        "scraping_month": 0,
    })


async def list_merchants() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(MERCHANT_URL, headers=_headers())
    return (response.json() or {}).get("data") or []


async def issue_account_ott(
    *, email: str, merchant_email: str, return_url: str | None = None
) -> dict[str, Any]:
    """
    계좌 등록용 1회용 링크.

    계좌 비밀번호·생년월일·인터넷뱅킹 정보는 이 링크에서 계좌 주인이 뱅크다에 직접
    입력한다. 우리 서버는 그 값을 만지지 않는다.
    유효시간: 링크를 여는 데 10분, 연 뒤 작업 완료까지 20분. 1회용이다.
    """
    payload: dict[str, Any] = {
        "email": email, "merchant_email": merchant_email,
        "datatype": "json", "charset": "utf8",
    }
    if return_url:
        payload["return_url"] = return_url
    parsed = await _post_json(OTT_URL, payload)
    if not parsed.get("ott"):
        raise BankdaError("OTT 를 받지 못했습니다.")
    return {"url": f"{OTT_FORM_URL}{parsed['ott']}",
            "expiresIn": int(parsed.get("expires_in") or 600)}


async def list_merchant_accounts(email: str, merchant_email: str) -> list[dict[str, Any]]:
    """특정 가맹점에 붙어 있는 계좌 목록. 등록 완료 여부를 판단하는 데 쓴다."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            ACCOUNT_URL, params={"email": email, "email_sub": merchant_email},
            headers=_headers())
    parsed = response.json()
    # 가맹점은 있는데 계좌가 없으면 success:true / data:[] 로 온다.
    if parsed.get("success") is False:
        return []
    return parsed.get("data") or []


async def issue_account_modify_ott(
    *, email: str, account_number: str, return_url: str | None = None
) -> dict[str, Any]:
    """계좌 '수정'용 OTT. 이미 등록된 계좌를 바꿀 때 쓴다 (등록용은 POST, 수정은 PUT)."""
    payload: dict[str, Any] = {
        "email": email, "account_number": account_number,
        "datatype": "json", "charset": "utf8",
    }
    if return_url:
        payload["return_url"] = return_url
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.put(
            OTT_URL, content=json.dumps(payload),
            headers=_headers("application/json; charset=utf-8"))
    parsed = response.json()
    if parsed.get("status") == "error":
        raise BankdaError(parsed.get("error_message") or parsed.get("message")
                          or "수정 링크 발급에 실패했습니다.")
    if not parsed.get("ott"):
        raise BankdaError("OTT 를 받지 못했습니다.")
    return {"url": f"{OTT_FORM_URL}{parsed['ott']}",
            "expiresIn": int(parsed.get("expires_in") or 600)}
