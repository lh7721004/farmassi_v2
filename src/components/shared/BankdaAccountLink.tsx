import { useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { copyText } from '../../lib/clipboard'
import { invokeFunction } from '../../lib/functions'

interface OttResult {
  url: string
  expiresIn: number
  merchantEmail: string
  createdMerchant: boolean
}

/**
 * 뱅크다 계좌 등록 링크 발급.
 *
 * 계좌 비밀번호·생년월일 같은 값은 이 화면을 거치지 않는다. 링크를 받은 계좌 주인이
 * 뱅크다 화면에 직접 입력한다.
 */
export function BankdaAccountLink({ farmId, farmName }: { farmId: string; farmName: string }) {
  const [result, setResult] = useState<OttResult | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  async function issue() {
    setPending(true)
    setError('')
    try {
      setResult(await invokeFunction<OttResult>('bankda-ott', { farmId }))
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
        <p className="text-sm font-semibold text-gray-900">{farmName} 계좌 등록 링크</p>
        <p className="break-all rounded-lg bg-white px-3 py-2 text-xs text-gray-700">{result.url}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void handleCopy()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? '복사됨' : '링크 복사'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
            닫기
          </Button>
        </div>
        <p className="text-xs text-muted leading-5">
          계좌 주인에게 전달하세요. {minutes}분 안에 열어야 하고, 연 뒤 20분 안에 끝내야 합니다.
          한 번 쓰면 다시 못 씁니다.
          {result.createdMerchant ? ' 이 농가의 뱅크다 가맹점을 새로 만들었습니다.' : ''}
        </p>
        <p className="text-xs text-muted">
          계좌가 은행의 <b>빠른조회</b>에 등록돼 있어야 합니다. 안 돼 있으면 이 화면에서 실패합니다.
        </p>
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
    </div>
  )
}
