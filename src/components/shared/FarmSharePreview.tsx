import { useEffect, useRef, useState } from 'react'
import { Check, Copy, RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'
import { copyText } from '../../lib/clipboard'
import { buildFarmShareText, patchFarmShareText, type FarmShareInput } from '../../lib/farmShareText'

export function FarmSharePreview({
  farm,
  value,
  onChange,
}: {
  farm: FarmShareInput
  value: string
  onChange: (value: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const prevFarmRef = useRef(farm)
  const generated = buildFarmShareText(farm)
  const text = value || generated

  useEffect(() => {
    const prevFarm = prevFarmRef.current
    prevFarmRef.current = farm

    if (!value.trim()) {
      if (generated) onChange(generated)
      return
    }

    const patched = patchFarmShareText(value, prevFarm, farm)
    if (patched !== value) onChange(patched)
  }, [farm, generated, onChange, value])

  if (!text) return null

  async function handleCopy() {
    const ok = await copyText(text)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">안내 문자</p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(generated)}>
            <RotateCcw className="h-4 w-4" />
            다시 만들기
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? '복사됨' : '복사'}
          </Button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        className="min-h-40 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm leading-7 text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  )
}
