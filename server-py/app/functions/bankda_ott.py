"""
농가 계좌 등록용 1회용 링크를 발급한다.

뱅크다에서 계좌는 가맹점 아래에 붙으므로, 농가에 가맹점이 없으면 먼저 만든다.
가맹점 이메일은 농가 id 에서 만들어 사람이 정할 필요가 없게 했다.
비밀번호는 공개 테이블에 두지 않고 private 스키마에 보관한다.
"""
import os
import re
import secrets

from ..sb import sb
from ..shared.bankda import (
    BankdaError, create_merchant, issue_account_modify_ott, issue_account_ott,
)
from ..shared.util import is_admin
from .types import FnCtx, FnResult, fail, ok


def _random_password() -> str:
    """영문+숫자 12자. 뱅크다 규칙(영문·숫자 포함 8~20자)을 만족한다."""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    out = "".join(secrets.choice(chars) for _ in range(12))
    # 영문과 숫자가 각각 하나 이상 들어가도록 보정
    return out[:10] + "a7"


def _merchant_email_for(farm_id: str) -> str:
    """
    농가 id 전체를 쓴다.

    앞 8자만 쓰면 겹칠 수 있다. 실제로 더미 농가 두 곳이 같은 접두사를 갖고 있어서
    두 번째 농가의 가맹점 생성이 "이미 등록된 가맹점입니다" 로 실패했다.
    하이픈을 뺀 32자를 붙여도 이메일 로컬 파트 길이 제한(64자) 안에 들어간다.
    """
    domain = os.environ.get("BANKDA_MERCHANT_DOMAIN") or "farm.shop.lkim.me"
    return f"farm-{farm_id.replace('-', '')}@{domain}"


async def bankda_ott(ctx: FnCtx) -> FnResult:
    if not ctx.user_id:
        return fail("로그인이 필요합니다.", 401)
    if not await is_admin(ctx.admin, ctx.user_id):
        return fail("관리자만 발급할 수 있습니다.", 403)

    farm_id = str(ctx.body.get("farmId") or "")
    if not farm_id:
        return fail("farmId 가 필요합니다.")

    main_email = os.environ.get("BANKDA_EMAIL")
    if not main_email:
        return fail("BANKDA_EMAIL 이 설정되지 않았습니다.", 500)

    db = sb(ctx.admin)
    farm = (await db.from_("farms").select("id, name").eq("id", farm_id).maybe_single()).data
    if not farm:
        return fail("농가를 찾을 수 없습니다.", 404)

    # 가맹점 정보는 private 스키마에만 둔다. farms 는 손님도 읽는 테이블이다.
    known = await ctx.admin.fetchval(
        "select email from private.bankda_merchant where farm_id = $1", farm_id)

    try:
        merchant_email = known or ""

        if not merchant_email:
            merchant_email = _merchant_email_for(farm_id)
            password = _random_password()
            try:
                await create_merchant(email=main_email, merchant_email=merchant_email,
                                      password=password, accounts_count=1)
            except BankdaError as error:
                # 가맹점은 만들어졌는데 우리 쪽 기록이 남지 않은 경우가 있을 수 있다.
                # 이미 있다는 응답이면 그대로 쓰고 진행한다.
                if not re.search("이미 등록된 가맹점", str(error)):
                    raise

            # 비밀번호는 private 스키마에만 둔다.
            await ctx.admin.execute(
                "insert into private.bankda_merchant (farm_id, email, password)"
                " values ($1, $2, $3)"
                " on conflict (farm_id) do update set email = excluded.email,"
                " password = excluded.password",
                farm_id, merchant_email, password)

        # 이미 등록된 계좌를 바꾸는 경우에는 수정용 OTT 를 쓴다.
        # 가맹점당 등록 가능 계좌 수가 1이라, 등록용으로 다시 뽑으면 뱅크다가 막는다.
        account_number = str(ctx.body.get("accountNumber") or "")
        ott = (await issue_account_modify_ott(email=main_email, account_number=account_number)
               if account_number
               else await issue_account_ott(email=main_email, merchant_email=merchant_email))

        return ok({
            "mode": "modify" if account_number else "register",
            "url": ott["url"],
            "expiresIn": ott["expiresIn"],
            "merchantEmail": merchant_email,
            "farmName": farm["name"],
            "createdMerchant": not known,
        })
    except BankdaError as error:
        return fail(str(error), 502)
