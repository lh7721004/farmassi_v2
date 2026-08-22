import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { copyText } from '../../lib/clipboard'
import { invokeFunction } from '../../lib/functions'

interface OttResult {
  url: string
  expiresIn: number
  mode: 'register' | 'modify'
}

interface RegisteredAccount {
  accountNumber: string
  bankName: string
  acttag: string
  state: string
}

interface StatusResult {
  registered: boolean
  accounts: RegisteredAccount[]
  /** 이 농가 전용 가맹점에 붙은 계좌인지. 아니면 예전 가맹점 소속이라 변경 링크를 못 만든다. */
  underOwnMerchant: boolean
}

/**
 * 뱅크다 계좌 등록 링크 발급 / 등록 상태 표시.
 *
 * 계좌 비밀번호·생년월일 같은 값은 이 화면을 거치지 않는다. 링크를 받은 계좌 주인이
 * 뱅크다 화면에 직접 입력한다.
 */
export function BankdaAccountLink({ farmId, farmName }: { farmId: string; farmName: string }) {
  const [status, setStatus] = useState<StatusResult | null>(null)
  const [result, setResult] = useState<OttResult | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await invokeFunction<StatusResult>('bankda-account-status', { farmId }))
    } catch {
      // 상태를 못 읽어도 발급 자체는 할 수 있어야 한다. 버튼은 그대로 둔다.
      setStatus(null)
    }
  }, [farmId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function issue(accountNumber?: string) {
    setPending(true)
    setError('')
    try {
      setResult(await invokeFunction<OttResult>('bankda-ott', { farmId, accountNumber }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '링크 발급에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  async function handleCopy() {
    if (!result || !(await copyText(result.url))) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  if (result) {
    const minutes = Math.round(result.expiresIn / 60)
    return (
      <div className="w-full space-y-2 rounded-xl bg-primary-light p-3">
        <p className="text-sm font-semibold text-gray-900">
          {farmName} 계좌 {result.mode === 'modify' ? '변경' : '등록'} 링크
        </p>
        <p className="break-all rounded-lg bg-white px-3 py-2 text-xs text-gray-700">{result.url}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void handleCopy()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? '복사됨' : '링크 복사'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setResult(null)
              void loadStatus()
            }}
          >
            닫기
          </Button>
        </div>
        <p className="text-xs text-muted leading-5">
          계좌 주인에게 전달하세요. {minutes}분 안에 열어야 하고, 연 뒤 20분 안에 끝내야 합니다.
          한 번 쓰면 다시 못 씁니다.
        </p>
        <p className="text-xs text-muted leading-5">
          <b>닫기를 눌러도 링크는 그대로 살아 있습니다.</b> 다만 이 화면에서는 사라지니, 닫기 전에
          복사해 두세요. 잃어버리면 새로 발급하면 됩니다.
        </p>
      </div>
    )
  }

  const account = status?.accounts[0]

  if (account) {
    const abnormal = account.acttag !== 'T'
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary-light px-2 py-1 text-xs font-semibold text-primary">
            <Check className="h-3.5 w-3.5" />
            계좌 등록 완료
          </span>
          <span className={`text-xs ${abnormal ? 'text-amber-700' : 'text-muted'}`}>
            {account.bankName} {account.accountNumber}
            {abnormal ? ` · ${account.state}` : ''}
          </span>
        </div>
        {status?.underOwnMerchant ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation()
              void issue(account.accountNumber)
            }}
          >
            {pending ? '발급 중…' : '계좌 변경'}
          </Button>
        ) : (
          <p className="text-xs text-muted">
            이 농가 가맹점이 생기기 전에 등록된 계좌라, 변경은 뱅크다에서 직접 해야 합니다.
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation()
          void issue()
        }}
      >
        <Link2 className="h-4 w-4" />
        {pending ? '발급 중…' : '계좌 등록 링크'}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-muted">계좌가 은행 <b>빠른조회</b>에 등록돼 있어야 합니다.</p>
    </div>
  )
}
