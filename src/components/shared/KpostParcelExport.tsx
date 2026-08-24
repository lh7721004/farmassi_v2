import { Download } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/Button'
import { ErrorText } from '../ui/Feedback'
import { downloadKpostParcelExcel, ordersMissingZonecode } from '../../lib/kpostParcelExcel'
import type { OrderRow } from '../../lib/orders'
import { supabase } from '../../lib/supabase'

interface KpostParcelExportProps {
  orders: OrderRow[]
  fileStem?: string
  /** 입금완료 → 송장 발급 완료(packing) 반영 뒤 목록 갱신 */
  onUpdated?: () => void
}

export function KpostParcelExport({ orders, fileStem, onUpdated }: KpostParcelExportProps) {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const missingZip = ordersMissingZonecode(orders)

  return (
    <div className="space-y-2">
      {missingZip.length > 0 && (
        <p className="text-xs text-amber-700">
          우편번호가 없는 주문이 {missingZip.length}건 있습니다. 우체국 주소검증에서 실패할 수 있습니다.
        </p>
      )}
      <ErrorText>{error}</ErrorText>
      {message && <p className="text-sm text-primary">{message}</p>}
      <Button
        disabled={orders.length === 0 || busy}
        onClick={async () => {
          setError('')
          setMessage('')
          setBusy(true)
          try {
            await downloadKpostParcelExcel(orders, fileStem)
            const paidIds = orders.filter((order) => order.status === 'paid').map((order) => order.id)
            if (paidIds.length > 0) {
              const results = await Promise.all(
                paidIds.map((id) => supabase.from('orders').update({ status: 'packing' }).eq('id', id)),
              )
              const failed = results.find((result) => result.error)
              if (failed?.error) throw new Error(failed.error.message)
              onUpdated?.()
            }
            setMessage(
              paidIds.length > 0
                ? `${orders.length}건 엑셀을 다운로드했습니다. ${paidIds.length}건을 송장 발급 완료로 변경했습니다.`
                : `${orders.length}건 엑셀을 다운로드했습니다.`,
            )
          } catch (err) {
            setError(err instanceof Error ? err.message : '엑셀을 만들지 못했습니다.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <Download className="h-4 w-4" />
        엑셀 다운로드 ({orders.length})
      </Button>
    </div>
  )
}
