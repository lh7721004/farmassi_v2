import { withAdmin } from './db.ts'
import { functions } from './functions/index.ts'
import { listAccounts } from './shared/bankda.ts'

/**
 * 입금내역 조회 시점 결정.
 *
 * 뱅크다는 60분마다 은행에서 계좌를 긁어온다. 그 사이에 거래내역을 아무리 불러봐야
 * 같은 데이터만 돌아온다. 그래서 제한이 없는 계좌 목록 API 로 last_scraping_at 을
 * 지켜보다가, 값이 바뀐 계좌가 있을 때만 거래내역(5분 제한)을 부른다.
 *
 * 결과적으로 거래내역 호출은 하루 24회 근처가 되고, 새 입금은 스크래핑 직후에 잡힌다.
 */
/** 로그에 시각이 없으면 나중에 무슨 일이 언제 있었는지 알 수가 없다. */
function log(message: string): void {
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
  console.log(`[${now}] ${message}`)
}

export function startScheduler(): void {
  const minutes = Number(process.env.SCRAPE_CHECK_MINUTES ?? 5)
  if (!Number.isFinite(minutes) || minutes <= 0) {
    log('입금 자동조회: 꺼짐')
    return
  }

  const tick = async () => {
    try {
      // 뱅크다가 새로 긁어간 계좌가 있는지 본다.
      const accounts = await listAccounts()
      const advanced = await withAdmin(async (db) => {
        const changed: string[] = []
        for (const account of accounts) {
          const key = String(account.account_number ?? '').replace(/\D/g, '')
          if (!key) continue
          const seen = await db.query<{ last_scraping_at: string | null }>(
            'select last_scraping_at from private.bankda_scrape_state where account_number = $1',
            [key],
          )
          const previous = seen.rows[0]?.last_scraping_at ?? null
          const current = account.last_scraping_at ?? null

          // 처음 보는 계좌는 한 번 가져온다. 서버가 꺼져 있던 동안의 입금을 놓치지 않기 위해.
          if (seen.rows.length === 0 || previous !== current) changed.push(key)

          await db.query(
            `insert into private.bankda_scrape_state (account_number, last_scraping_at, checked_at)
             values ($1, $2, now())
             on conflict (account_number)
             do update set last_scraping_at = excluded.last_scraping_at, checked_at = now()`,
            [key, current],
          )
        }
        return changed
      })

      // 새 데이터가 없어도 재대사는 돌린다. 주문은 계속 생기기 때문이다.
      const result = await withAdmin((admin) =>
        functions['scrape-deposits']({
          userId: null,
          body: { __byCron: true, days: 3, rematchOnly: advanced.length === 0 },
          admin,
        }))

      const body = result.body as any
      if (result.status !== 200) {
        log(`입금 조회 건너뜀: ${body?.error}`)
        return
      }
      if (advanced.length > 0) {
        log(`입금 조회(계좌 ${advanced.length}곳 갱신됨: ${advanced.join(', ')}): 신규 ${body.inserted}건, 연결 ${body.matched}건`)
      } else if (body.rematched > 0) {
        log(`재대사로 ${body.rematched}건 연결`)
      }
    } catch (error) {
      log(`입금 조회 실패: ${error instanceof Error ? error.message : error}`)
    }
  }

  log(`입금 자동조회: ${minutes}분마다 갱신 여부 확인 (거래내역은 갱신됐을 때만 호출)`)
  setTimeout(() => void tick(), 20_000)
  setInterval(() => void tick(), minutes * 60_000)
}
