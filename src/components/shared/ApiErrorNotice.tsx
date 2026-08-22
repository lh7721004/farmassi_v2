import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { API_ERROR_EVENT } from '../../lib/apiClient'

/**
 * 통신 실패를 화면 아래에 알린다.
 *
 * 조회 화면 상당수가 error 를 보지 않고 빈 목록만 그린다. 그러면 서버가 죽어도
 * "주문이 없습니다" 처럼 보인다. 여기서 한 번에 받아 띄워, 사용자가 데이터가 없는
 * 것인지 불러오지 못한 것인지 구분할 수 있게 한다.
 */
export function ApiErrorNotice() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    let hideTimer: number | undefined
    function onError(event: Event) {
      const detail = (event as CustomEvent<string>).detail
      setMessage(detail || '요청을 처리하지 못했습니다.')
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => setMessage(''), 8000)
    }
    window.addEventListener(API_ERROR_EVENT, onError)
    return () => {
      window.removeEventListener(API_ERROR_EVENT, onError)
      window.clearTimeout(hideTimer)
    }
  }, [])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
    >
      <div className="mx-auto flex max-w-md items-start gap-2 rounded-xl bg-gray-900 px-4 py-3 text-white shadow-lg">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="flex-1 text-sm leading-5">{message}</p>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => setMessage('')}
          className="shrink-0 rounded p-0.5 text-white/70 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
