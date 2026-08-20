import type { DepositProvider } from '../types'

/**
 * 뱅크다A 는 서버(Edge Function `scrape-deposits`)에서 조회한다.
 * access token 을 브라우저로 내려보낼 수 없고, 뱅크다가 허용 IP 로 접근을 막기 때문이다.
 */
export const bankdaDepositProvider: DepositProvider = {
  id: 'bankda',
  async poll() {
    throw new Error('뱅크다 조회는 서버에서 실행됩니다. scrape-deposits 함수를 호출하세요.')
  },
}
