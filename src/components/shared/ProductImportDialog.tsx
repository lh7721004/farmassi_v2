import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { productGradient } from '../../lib/format'
import { Button } from '../ui/Button'
import { FarmFilterChips } from './FarmFilterChips'
import { PriceTag } from './PriceTag'

const MOCK_FARMS = [
  { id: 'farm-a', name: '하늘농원' },
  { id: 'farm-b', name: '바람들녘' },
  { id: 'farm-c', name: '시골농원' },
] as const

const MOCK_PRODUCTS = [
  { id: 'p1', farmId: 'farm-a', farmName: '하늘농원', name: '꿀사과 5kg', unit: '박스', price: 32000, status: '판매중' },
  { id: 'p2', farmId: 'farm-a', farmName: '하늘농원', name: '꿀사과 10kg', unit: '박스', price: 58000, status: '판매중' },
  { id: 'p3', farmId: 'farm-a', farmName: '하늘농원', name: '햇자두 3kg', unit: '박스', price: 28000, status: '판매 예정' },
  { id: 'p4', farmId: 'farm-b', farmName: '바람들녘', name: '밤고구마 5kg', unit: '박스', price: 24000, status: '판매중' },
  { id: 'p5', farmId: 'farm-b', farmName: '바람들녘', name: '햇양파 10kg', unit: '망', price: 18000, status: '판매중' },
  { id: 'p6', farmId: 'farm-c', farmName: '시골농원', name: '캠벨포도 5kg', unit: '5kg', price: 40000, status: '품절' },
]

interface ProductImportDialogProps {
  open: boolean
  onClose: () => void
}

export function ProductImportDialog({ open, onClose }: ProductImportDialogProps) {
  const [farmId, setFarmId] = useState<string | 'all'>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setFarmId('all')
    setQuery('')
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const farms = useMemo(
    () =>
      MOCK_FARMS.map((farm) => ({
        id: farm.id,
        name: farm.name,
        count: MOCK_PRODUCTS.filter((product) => product.farmId === farm.id).length,
      })),
    [],
  )

  const visible = useMemo(() => {
    const farmFiltered = farmId === 'all' ? MOCK_PRODUCTS : MOCK_PRODUCTS.filter((row) => row.farmId === farmId)
    const q = query.trim().toLowerCase()
    if (!q) return farmFiltered
    return farmFiltered.filter((row) => `${row.name} ${row.farmName} ${row.unit}`.toLowerCase().includes(q))
  }, [farmId, query])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-import-title"
        className="animate-sheet-up relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:rounded-2xl md:shadow-lg"
      >
        <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-3 md:pt-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200 md:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="product-import-title" className="text-lg font-bold">
                다른 매장에서 불러오기
              </h2>
              <p className="mt-1 text-sm text-muted">선택한 상품은 복사본으로 추가됩니다. 기존 상품은 바뀌지 않습니다.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-gray-100"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="상품명 검색"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="mt-3">
            <FarmFilterChips farms={farms} selectedId={farmId} onSelect={setFarmId} allCount={MOCK_PRODUCTS.length} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {visible.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">검색 결과가 없습니다</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((product) => (
                <li key={product.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-2.5">
                  <div className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${productGradient(product.id)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{product.name}</p>
                    <p className="truncate text-xs text-muted">
                      {product.farmName} · {product.unit}
                      {product.status !== '판매중' ? ` · ${product.status}` : ''}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-primary">
                      <PriceTag price={product.price} showRate={false} />
                    </p>
                  </div>
                  <Button type="button" size="sm">
                    불러오기
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
