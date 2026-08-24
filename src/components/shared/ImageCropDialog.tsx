import { RotateCcw, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from '../ui/Button'
import { ErrorText } from '../ui/Feedback'
import { cropImageFile, rotateImageSrc } from '../../lib/imageCrop'

interface ImageCropDialogProps {
  open: boolean
  file: File | null
  /** null 이면 자유 비율. 숫자면 가로/세로 고정. */
  aspect: number | null
  title?: string
  hint?: string
  onCancel: () => void
  onConfirm: (file: File) => void
}

function initialCrop(mediaWidth: number, mediaHeight: number, aspect: number | null): Crop {
  if (aspect && aspect > 0) {
    return centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
      mediaWidth,
      mediaHeight,
    )
  }
  return {
    unit: '%',
    x: 5,
    y: 5,
    width: 90,
    height: 90,
  }
}

export function ImageCropDialog({
  open,
  file,
  aspect,
  title = '사진 자르기',
  hint,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completed, setCompleted] = useState<PixelCrop | null>(null)
  const [pending, setPending] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [error, setError] = useState('')

  const replaceSrc = useCallback((url: string) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = url
    setSrc(url)
    setCrop(undefined)
    setCompleted(null)
  }, [])

  useEffect(() => {
    if (!open || !file) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      setSrc(null)
      setCrop(undefined)
      setCompleted(null)
      setError('')
      setPending(false)
      setRotating(false)
      return
    }
    replaceSrc(URL.createObjectURL(file))
    setError('')
    setPending(false)
    setRotating(false)
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [open, file, replaceSrc])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending && !rotating) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, pending, rotating, onCancel])

  const onImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget
      imgRef.current = image
      const next = initialCrop(image.width, image.height, aspect)
      setCrop(next)
    },
    [aspect],
  )

  async function rotate(degrees: 90 | -90) {
    if (!src || !file || rotating || pending) return
    setRotating(true)
    setError('')
    try {
      const rotated = await rotateImageSrc(src, degrees, file.name)
      replaceSrc(URL.createObjectURL(rotated))
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진을 회전할 수 없습니다.')
    } finally {
      setRotating(false)
    }
  }

  async function confirm() {
    const image = imgRef.current
    if (!image || !file || !completed || completed.width < 2 || completed.height < 2) {
      setError('자를 영역을 선택해 주세요.')
      return
    }
    setPending(true)
    setError('')
    try {
      const cropped = await cropImageFile(image, completed, file.name)
      onConfirm(cropped)
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진을 자를 수 없습니다.')
      setPending(false)
    }
  }

  if (!open || !file || !src) return null

  const busy = pending || rotating

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="닫기"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-lg sm:rounded-3xl"
      >
        <div className="shrink-0 space-y-1 px-4 pt-4 pb-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted">
            {hint ??
              (aspect
                ? '화면에 보일 비율에 맞춰 영역을 고른 뒤 확인을 누르세요.'
                : '화면에 보일 부분을 자유롭게 잘라 확인을 누르세요.')}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-gray-900 px-3 py-3">
          <ReactCrop
            crop={crop}
            aspect={aspect ?? undefined}
            onChange={(next) => setCrop(next)}
            onComplete={(next) => setCompleted(next)}
            className="mx-auto max-h-[55dvh]"
            disabled={busy}
          >
            <img
              src={src}
              alt=""
              onLoad={onImageLoad}
              className="max-h-[55dvh] w-auto max-w-full"
            />
          </ReactCrop>
        </div>
        <div className="shrink-0 space-y-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              disabled={busy}
              onClick={() => void rotate(-90)}
            >
              <RotateCcw className="h-4 w-4" />
              왼쪽 회전
            </Button>
            <Button
              type="button"
              variant="outline"
              fullWidth
              disabled={busy}
              onClick={() => void rotate(90)}
            >
              <RotateCw className="h-4 w-4" />
              오른쪽 회전
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" fullWidth disabled={busy} onClick={onCancel}>
              취소
            </Button>
            <Button type="button" fullWidth disabled={busy} onClick={() => void confirm()}>
              {pending ? '처리 중...' : rotating ? '회전 중...' : '자르고 확인'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
