import { GripVertical, ImagePlus, Import, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input, Select, Textarea } from '../ui/Field'
import { ErrorText } from '../ui/Feedback'
import {
  KPOST_CONTENT_CODES,
  KPOST_DELIVERY_TYPES,
  KPOST_VOLUMES,
  KPOST_WEIGHTS,
  kpostVolumeLabel,
  kpostWeightLabel,
} from '../../lib/kpostParcelExcel'
import { PriceTag, discountRate } from './PriceTag'
import { deletePublicImage, preparePublicImage, uploadFarmImage } from '../../lib/storageImages'
import { supabase } from '../../lib/supabase'
import {
  PRODUCT_SALE_STATUS_LABEL,
  PRODUCT_SALE_STATUS_OPTIONS,
  productSaleStatus,
  type Product,
  type ProductSaleStatus,
} from '../../types/models'
import { ProductCard } from './ProductCard'
import { ProductImportDialog } from './ProductImportDialog'

function ImageFileInput({ onPick }: { onPick: (file: File) => void }) {
  return (
    <input
      type="file"
      accept="image/*"
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      onChange={(e) => {
        const next = e.target.files?.[0]
        e.target.value = ''
        if (next) onPick(next)
      }}
    />
  )
}

interface ProductFormValues {
  name: string
  price: string
  /** 할인 전 원래 가격. 빈 문자열이면 할인 없음. */
  list_price: string
  unit: string
  description: string
  image_url: string
  parcel_weight_kg: string
  parcel_volume_cm: string
  parcel_content_code: string
  parcel_delivery_type: string
}

const UNIT_OPTIONS = KPOST_WEIGHTS.map((value) => `${value}kg`)

function weightFromUnit(unit: string) {
  const match = unit.trim().match(/^(\d+)\s*kg$/i)
  if (!match) return null
  return KPOST_WEIGHTS.find((value) => value === match[1]) ?? null
}

function unitFromWeight(weight: string) {
  return `${weight}kg`
}

function normalizeUnit(unit: string | null | undefined, parcelWeight: string) {
  const raw = unit?.trim() ?? ''
  if (!raw) return unitFromWeight(parcelWeight)
  const weight = weightFromUnit(raw)
  return weight ? unitFromWeight(weight) : raw
}

function withCurrentOption(options: readonly string[], current: string) {
  return current && !options.includes(current) ? [current, ...options] : [...options]
}

function unitSelectOptions(current: string) {
  return withCurrentOption(UNIT_OPTIONS, current)
}

const emptyProductForm: ProductFormValues = {
  name: '',
  price: '',
  list_price: '',
  unit: unitFromWeight('5'),
  description: '',
  image_url: '',
  parcel_weight_kg: '5',
  parcel_volume_cm: '80',
  parcel_content_code: '농/수/축산물(일반)',
  parcel_delivery_type: '',
}

function productToForm(product: Product): ProductFormValues {
  const parcel_weight_kg = weightFromUnit(product.unit ?? '') ?? product.parcel_weight_kg
  return {
    name: product.name,
    price: String(product.price),
    list_price: product.list_price === null ? '' : String(product.list_price),
    unit: normalizeUnit(product.unit, parcel_weight_kg),
    description: product.description ?? '',
    image_url: product.image_url ?? '',
    parcel_weight_kg,
    parcel_volume_cm: product.parcel_volume_cm,
    parcel_content_code: product.parcel_content_code,
    parcel_delivery_type: product.parcel_delivery_type,
  }
}

function formPayload(form: ProductFormValues) {
  return {
    name: form.name.trim(),
    price: Number(form.price),
    // 비워 두면 할인 없음. 0 을 넣어도 할인으로 치지 않는다(표시 조건이 price 초과).
    list_price: form.list_price.trim() === '' ? null : Number(form.list_price),
    unit: form.unit.trim() || null,
    description: form.description.trim() || null,
    parcel_weight_kg: form.parcel_weight_kg,
    parcel_volume_cm: form.parcel_volume_cm,
    parcel_content_code: form.parcel_content_code,
    parcel_delivery_type: form.parcel_delivery_type,
  }
}

interface ProductFormCardProps {
  form: ProductFormValues
  editingId: string | null
  error: string
  showCancel: boolean
  saving: boolean
  imagePreview: string | null
  onChange: <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => void
  onPickImage: (file: File) => void
  onClearImage: () => void
  onSave: () => void
  onCancel: () => void
}

function ProductFormCard({
  form,
  editingId,
  error,
  showCancel,
  saving,
  imagePreview,
  onChange,
  onPickImage,
  onClearImage,
  onSave,
  onCancel,
}: ProductFormCardProps) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{editingId ? '상품 수정' : '상품 추가'}</h3>
        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-gray-100"
            aria-label="닫기"
          >
            닫기
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Input label="상품명" value={form.name} onChange={(e) => onChange('name', e.target.value)} />
      <Input
        label="판매 가격"
        type="number"
        value={form.price}
        onChange={(e) => onChange('price', e.target.value)}
      />
      <div>
        <Input
          label="원래 가격 (선택)"
          type="number"
          value={form.list_price}
          onChange={(e) => onChange('list_price', e.target.value)}
          placeholder="할인 전 가격"
        />
        <p className="mt-1 text-xs text-muted">
          {discountRate(Number(form.price), Number(form.list_price) || null) !== null
            ? `${discountRate(Number(form.price), Number(form.list_price) || null)}% 할인으로 표시됩니다.`
            : form.list_price.trim() !== ''
              ? '원래 가격이 판매 가격보다 커야 할인으로 표시됩니다.'
              : '비워 두면 할인 표시가 없습니다.'}
        </p>
      </div>
      <Select
        label="단위"
        value={form.unit}
        onChange={(e) => {
          const unit = e.target.value
          onChange('unit', unit)
          const weight = weightFromUnit(unit)
          if (weight) onChange('parcel_weight_kg', weight)
        }}
      >
        {unitSelectOptions(form.unit).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <Textarea label="설명" value={form.description} onChange={(e) => onChange('description', e.target.value)} />
      <div>
        <span className="text-xs font-medium text-muted">이미지</span>
        {imagePreview ? (
          <div className="relative mt-1 overflow-hidden rounded-xl border border-gray-200">
            <img src={imagePreview} alt="" className="h-40 w-full object-cover" />
            <div className="absolute right-2 top-2 flex gap-1">
              <span className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white/95 px-3 text-xs font-medium text-gray-700 shadow-sm">
                변경
                <ImageFileInput onPick={onPickImage} />
              </span>
              <button
                type="button"
                onClick={onClearImage}
                className="inline-flex min-h-11 items-center rounded-lg bg-white/95 px-3 text-xs font-medium text-gray-700 shadow-sm"
              >
                삭제
              </button>
            </div>
          </div>
        ) : (
          <div className="relative mt-1 flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-muted">
            <ImagePlus className="h-6 w-6" />
            앨범 또는 카메라에서 선택
            <span className="text-xs">최대 5MB · 큰 사진은 자동으로 줄입니다</span>
            <ImageFileInput onPick={onPickImage} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="택배 중량(kg)"
          value={form.parcel_weight_kg}
          onChange={(e) => {
            const weight = e.target.value
            onChange('parcel_weight_kg', weight)
            onChange('unit', unitFromWeight(weight))
          }}
        >
          {withCurrentOption(KPOST_WEIGHTS, form.parcel_weight_kg).map((value) => (
            <option key={value} value={value}>
              {kpostWeightLabel(value)}
            </option>
          ))}
        </Select>
        <Select label="택배 부피(cm)" value={form.parcel_volume_cm} onChange={(e) => onChange('parcel_volume_cm', e.target.value)}>
          {withCurrentOption(KPOST_VOLUMES, form.parcel_volume_cm).map((value) => (
            <option key={value} value={value}>
              {kpostVolumeLabel(value)}
            </option>
          ))}
        </Select>
        <Select
          label="내용품코드"
          value={form.parcel_content_code}
          onChange={(e) => onChange('parcel_content_code', e.target.value)}
        >
          {KPOST_CONTENT_CODES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select
          label="배달방식"
          value={form.parcel_delivery_type}
          onChange={(e) => onChange('parcel_delivery_type', e.target.value)}
        >
          {KPOST_DELIVERY_TYPES.map((value) => (
            <option key={value || 'none'} value={value}>
              {value || '미입력'}
            </option>
          ))}
        </Select>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? (editingId ? '저장 중...' : '추가 중...') : editingId ? '저장' : '추가'}
        </Button>
        {showCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            취소
          </Button>
        )}
      </div>
    </Card>
  )
}

function SaleStatusSelect({
  product,
  onChange,
}: {
  product: Product
  onChange: (status: ProductSaleStatus) => void
}) {
  return (
    <select
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs"
      value={productSaleStatus(product)}
      onChange={(e) => onChange(e.target.value as ProductSaleStatus)}
    >
      {PRODUCT_SALE_STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function moveItem<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

interface ProductManagerProps {
  farmId: string
  variant?: 'admin' | 'farm'
  onCountChange?: (count: number) => void
}

export function ProductManager({ farmId, variant = 'admin', onCountChange }: ProductManagerProps) {
  const isFarm = variant === 'farm'
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState<ProductFormValues>(emptyProductForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(!isFarm)
  const [reordering, setReordering] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const productsRef = useRef(products)
  const dragIdRef = useRef<string | null>(null)
  productsRef.current = products
  const imageObjectUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])
  const imagePreview = imageObjectUrl ?? (imageRemoved ? null : form.image_url || null)

  useEffect(() => {
    if (!imageObjectUrl) return
    return () => URL.revokeObjectURL(imageObjectUrl)
  }, [imageObjectUrl])

  const formVisible = isFarm ? formOpen : true

  async function load() {
    const { data } = await supabase.from('products').select('*').eq('farm_id', farmId).order('sort_order')
    const list = (data as Product[]) ?? []
    setProducts(list)
    onCountChange?.(list.length)
  }

  useEffect(() => {
    setForm(emptyProductForm)
    setEditingId(null)
    setError('')
    setImageFile(null)
    setImageRemoved(false)
    setSaving(false)
    setReordering(false)
    setDraggingId(null)
    supabase
      .from('products')
      .select('*')
      .eq('farm_id', farmId)
      .order('sort_order')
      .then(({ data }) => {
        const list = (data as Product[]) ?? []
        setProducts(list)
        onCountChange?.(list.length)
      })
  }, [farmId, onCountChange])

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleAdd() {
    if (formOpen && !editingId) {
      closeForm()
      return
    }
    setEditingId(null)
    setForm(emptyProductForm)
    setError('')
    setImageFile(null)
    setImageRemoved(false)
    setFormOpen(true)
  }

  function closeForm() {
    setEditingId(null)
    setForm(emptyProductForm)
    setError('')
    setImageFile(null)
    setImageRemoved(false)
    if (isFarm) setFormOpen(false)
  }

  function pickImage(file: File) {
    void (async () => {
      const prepared = await preparePublicImage(file)
      if (typeof prepared === 'string') {
        setError(prepared)
        return
      }
      setError('')
      setImageFile(prepared)
      setImageRemoved(false)
    })()
  }

  function clearImage() {
    setImageFile(null)
    setImageRemoved(true)
  }

  function toggleReorder() {
    if (reordering) {
      setReordering(false)
      setDraggingId(null)
      dragIdRef.current = null
      return
    }
    closeForm()
    setReordering(true)
  }

  async function persistOrder(list: Product[]) {
    const results = await Promise.all(
      list.map((product, index) =>
        supabase.from('products').update({ sort_order: index }).eq('id', product.id),
      ),
    )
    if (results.some((result) => result.error)) await load()
  }

  async function setSaleStatus(productId: string, saleStatus: ProductSaleStatus) {
    await supabase.from('products').update({ sale_status: saleStatus }).eq('id', productId)
    await load()
  }

  function onReorderPointerDown(event: PointerEvent<HTMLDivElement>, id: string) {
    if (!reordering || event.button !== 0) return
    event.preventDefault()
    dragIdRef.current = id
    setDraggingId(id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onReorderPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragId = dragIdRef.current
    if (!dragId) return
    const over = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-product-id]')
    const overId = over instanceof HTMLElement ? over.dataset.productId : undefined
    if (!overId || overId === dragId) return
    const current = productsRef.current
    const from = current.findIndex((product) => product.id === dragId)
    const to = current.findIndex((product) => product.id === overId)
    if (from < 0 || to < 0 || from === to) return
    const next = moveItem(current, from, to).map((product, index) => ({ ...product, sort_order: index }))
    productsRef.current = next
    setProducts(next)
  }

  function onReorderPointerUp() {
    if (!dragIdRef.current) return
    dragIdRef.current = null
    setDraggingId(null)
    void persistOrder(productsRef.current)
  }

  async function save() {
    setError('')
    const payload = formPayload(form)
    if (!payload.name || !Number.isFinite(payload.price) || payload.price < 0) {
      setError('상품명과 가격을 입력하세요.')
      return
    }
    setSaving(true)
    const previousImageUrl = form.image_url || null
    try {
      let imageUrl = imageRemoved ? null : previousImageUrl
      if (imageFile) imageUrl = await uploadFarmImage(farmId, imageFile)
      const { error: saveError } = editingId
        ? await supabase.from('products').update({ ...payload, image_url: imageUrl }).eq('id', editingId)
        : await supabase.from('products').insert({
            ...payload,
            image_url: imageUrl,
            farm_id: farmId,
            sort_order: products.reduce((max, product) => Math.max(max, product.sort_order), -1) + 1,
          })
      if (saveError) {
        setError(saveError.message)
        return
      }
      if (previousImageUrl && previousImageUrl !== imageUrl) {
        void deletePublicImage(previousImageUrl)
      }
      closeForm()
      if (!isFarm) setForm(emptyProductForm)
      await load()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '이미지 업로드에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const formCard = formVisible ? (
    <ProductFormCard
      form={form}
      editingId={editingId}
      error={error}
      showCancel={Boolean(editingId) || isFarm}
      saving={saving}
      imagePreview={imagePreview}
      onChange={update}
      onPickImage={pickImage}
      onClearImage={clearImage}
      onSave={() => void save()}
      onCancel={closeForm}
    />
  ) : null

  if (isFarm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button onClick={toggleAdd} disabled={reordering}>
              <Plus className="h-4 w-4" />
              새 상품 추가
            </Button>
            <Button type="button" variant="outline" disabled={reordering} onClick={() => setImportOpen(true)}>
              <Import className="h-4 w-4" />
              불러오기
            </Button>
          </div>
          {products.length > 1 && (
            <Button variant={reordering ? 'primary' : 'outline'} onClick={toggleReorder}>
              {reordering ? '완료' : '순서 변경'}
            </Button>
          )}
        </div>
        {reordering && (
          <p className="text-sm text-muted">카드를 드래그해서 순서를 바꾸세요. 주문 페이지에도 같은 순서로 보입니다.</p>
        )}
        {!reordering && !editingId && formCard}
        {products.length === 0 ? (
          <p className="text-center text-muted py-10">등록된 상품이 없습니다</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {products.map((product) => {
              if (!reordering && editingId === product.id) {
                return (
                  <div key={product.id} className="sm:col-span-2">
                    {formCard}
                  </div>
                )
              }
              return (
                <div
                  key={product.id}
                  data-product-id={product.id}
                  className={`relative h-full ${reordering ? 'cursor-grab touch-none select-none' : ''} ${
                    draggingId === product.id ? 'opacity-60 ring-2 ring-primary rounded-2xl' : ''
                  }`}
                  style={reordering ? { touchAction: 'none' } : undefined}
                  onPointerDown={(event) => onReorderPointerDown(event, product.id)}
                  onPointerMove={onReorderPointerMove}
                  onPointerUp={onReorderPointerUp}
                  onPointerCancel={onReorderPointerUp}
                >
                  {reordering && (
                    <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-lg bg-white/90 p-1 shadow-sm">
                      <GripVertical className="h-4 w-4 text-muted" />
                    </div>
                  )}
                  <ProductCard
                    product={product}
                    extra={
                      reordering ? undefined : (
                        <div className="mt-3 flex items-center gap-2">
                          <SaleStatusSelect
                            product={product}
                            onChange={(status) => void setSaleStatus(product.id, status)}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(product.id)
                              setForm(productToForm(product))
                              setImageFile(null)
                              setImageRemoved(false)
                              setError('')
                              setFormOpen(true)
                            }}
                          >
                            수정
                          </Button>
                        </div>
                      )
                    }
                  />
                </div>
              )
            })}
          </div>
        )}
        <ProductImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {formCard}
      {products.map((product) => (
        <Card key={product.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">
              {product.name} {product.unit}
            </p>
            <p className="text-sm text-primary">
              <PriceTag price={product.price} listPrice={product.list_price} />
            </p>
            <p className="text-xs text-muted">
              {PRODUCT_SALE_STATUS_LABEL[productSaleStatus(product)]} · 택배 {kpostWeightLabel(product.parcel_weight_kg)} · {kpostVolumeLabel(product.parcel_volume_cm)}
              · {product.parcel_content_code}
              {product.parcel_delivery_type ? ` · ${product.parcel_delivery_type}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <SaleStatusSelect
              product={product}
              onChange={(status) => void setSaleStatus(product.id, status)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingId(product.id)
                setForm(productToForm(product))
                setImageFile(null)
                setImageRemoved(false)
                setError('')
              }}
            >
              수정
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
