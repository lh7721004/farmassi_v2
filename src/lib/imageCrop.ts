import type { PixelCrop } from 'react-image-crop'

/** 매장·관리 상품 카드와 같은 비율. ProductCard 도 이 값을 쓴다. */
export const PRODUCT_IMAGE_ASPECT = 16 / 9

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
    image.src = src
  })
}

function canvasToJpegFile(canvas: HTMLCanvasElement, fileName: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (!next) {
          reject(new Error('이미지를 변환할 수 없습니다.'))
          return
        }
        const base = fileName.replace(/\.[^.]+$/, '') || 'image'
        resolve(new File([next], `${base}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  })
}

/** 시계 방향 degrees (90의 배수) 만큼 돌린 새 파일을 만든다. */
export async function rotateImageSrc(src: string, degrees: number, fileName: string): Promise<File> {
  const image = await loadImage(src)
  const turn = ((degrees % 360) + 360) % 360
  const swap = turn === 90 || turn === 270
  const canvas = document.createElement('canvas')
  canvas.width = swap ? image.naturalHeight : image.naturalWidth
  canvas.height = swap ? image.naturalWidth : image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 회전할 수 없습니다.')

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((turn * Math.PI) / 180)
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)

  return canvasToJpegFile(canvas, fileName)
}

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

  return canvasToJpegFile(canvas, fileName)
}
