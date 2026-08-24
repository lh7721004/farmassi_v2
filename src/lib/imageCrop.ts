import type { PixelCrop } from 'react-image-crop'

/** 매장·관리 상품 카드와 같은 비율. ProductCard 도 이 값을 쓴다. */
export const PRODUCT_IMAGE_ASPECT = 16 / 9

export async function cropImageFile(
  image: HTMLImageElement,
  crop: PixelCrop,
  fileName: string,
): Promise<File> {
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const width = Math.max(1, Math.round(crop.width * scaleX))
  const height = Math.max(1, Math.round(crop.height * scaleY))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 자를 수 없습니다.')

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    width,
    height,
  )

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => (next ? resolve(next) : reject(new Error('이미지를 자를 수 없습니다.'))),
      'image/jpeg',
      0.92,
    )
  })
  const base = fileName.replace(/\.[^.]+$/, '') || 'crop'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
}
