"""
농가의 뱅크다 계좌 등록 상태.

화면에서 "계좌 등록" 과 "등록 완료" 를 구분해 보여주기 위한 것이다.
뱅크다를 매번 물어본다 — 우리 DB 에 복제해두면 실제 상태와 어긋난다.
"""
import os
import re

from ..sb import sb
from ..shared.acttag import ACCTAG
from ..shared.bankda import BankdaError, list_accounts, list_merchant_accounts
from ..shared.util import is_admin
from .types import FnCtx, FnResult, fail, ok


def _digits(value) -> str:
    return re.sub(r"\D", "", str(value or ""))


async def bankda_account_status(ctx: FnCtx) -> FnResult:
    if not ctx.user_id:
        return fail("로그인이 필요합니다.", 401)
    if not await is_admin(ctx.admin, ctx.user_id):
        return fail("관리자만 조회할 수 있습니다.", 403)

    farm_id = str(ctx.body.get("farmId") or "")
    if not farm_id:
        return fail("farmId 가 필요합니다.")

    farm = (await sb(ctx.admin).from_("farms")
            .select("id, account_number").eq("id", farm_id).maybe_single()).data
    if not farm:
        return fail("농가를 찾을 수 없습니다.", 404)

    main_email = os.environ.get("BANKDA_EMAIL")
    if not main_email:
        return fail("BANKDA_EMAIL 이 설정되지 않았습니다.", 500)

    farm_account = _digits(farm["account_number"])

    try:
        # 이 농가의 가맹점에 붙은 계좌.
        merchant_email = await ctx.admin.fetchval(
            "select email from private.bankda_merchant where farm_id = $1", farm_id)

        owned = await list_merchant_accounts(main_email, merchant_email) if merchant_email else []

        # 가맹점을 나누기 전에 등록한 계좌는 다른 가맹점 아래에 있다. 계좌번호로도 찾는다.
        # 화면이 답해야 하는 질문은 "이 농가 계좌가 뱅크다에 연결됐나" 이지
        # "우리가 만든 가맹점에 있나" 가 아니다.
        legacy = []
        if not owned and farm_account:
            legacy = [a for a in await list_accounts()
                      if _digits(a.get("account_number")) == farm_account]

        rows = owned or legacy
        accounts = [{
            "accountNumber": a.get("account_number"),
            "bankName": a.get("bank_name"),
            "acttag": a.get("acttag"),
            "state": ACCTAG.get(a.get("acttag"), a.get("acttag")),
            "lastScrapingAt": a.get("last_scraping_at"),
        } for a in rows]
        return ok({
            "registered": len(accounts) > 0,
            "accounts": accounts,
            # 다른 가맹점 아래에 있는 계좌는 우리 쪽 수정 링크로 못 바꾼다.
            "underOwnMerchant": len(owned) > 0,
        })
    except BankdaError as error:
        return fail(str(error), 502)
