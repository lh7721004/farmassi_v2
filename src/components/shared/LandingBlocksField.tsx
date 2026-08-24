import { ImagePlus, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Field'
import { deletePublicImage, preparePublicImage, uploadFarmImage } from '../../lib/storageImages'
import { parseLandingBlocks, type FarmLandingBlock } from '../../types/models'
import { ImageCropDialog } from './ImageCropDialog'

export interface LandingBlockDraft {
  id: string
  image_url: string | null
  body: string
  file: File | null
  imageCleared: boolean
}

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

export function createLandingBlock(): LandingBlockDraft {
  return {
    id: crypto.randomUUID(),
    image_url: null,
    body: '',
    file: null,
    imageCleared: false,
  }
}

export function draftsFromLandingBlocks(value: unknown): LandingBlockDraft[] {
  const blocks = parseLandingBlocks(value)
  if (blocks.length === 0) return [createLandingBlock()]
  return blocks.map((block) => ({
    id: block.id,
    image_url: block.image_url,
    body: block.body,
    file: null,
    imageCleared: false,
  }))
}

export async function persistLandingBlocks(
  farmId: string,
  drafts: LandingBlockDraft[],
  previous: FarmLandingBlock[],
) {
  const next: FarmLandingBlock[] = []
  for (const draft of drafts) {
    let imageUrl = draft.imageCleared ? null : draft.image_url
    if (draft.file) imageUrl = await uploadFarmImage(farmId, draft.file, 'landing')
    const body = draft.body.trim()
    if (!imageUrl && !body) continue
    next.push({ id: draft.id, image_url: imageUrl, body })
  }
  const kept = new Set(next.map((block) => block.image_url).filter(Boolean))
  const obsolete = previous
    .map((block) => block.image_url)
    .filter((url): url is string => Boolean(url) && !kept.has(url))
  return { blocks: next, obsolete }
}

export async function cleanupLandingImages(urls: string[]) {
  await Promise.all(urls.map((url) => deletePublicImage(url)))
}

function BlockImage({
  file,
  url,
  onPick,
  onClear,
}: {
  file: File | null
  url: string | null
  onPick: (file: File) => void
  onClear: () => void
}) {
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    if (!objectUrl) return
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])
  const preview = objectUrl ?? url

  if (preview) {
    return (
      <div className="relative mt-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        <img src={preview} alt="" className="block w-full h-auto" />
        <div className="absolute right-2 top-2 flex gap-1">
          <span className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white/95 px-3 text-xs font-medium text-gray-700 shadow-sm">
            변경
            <ImageFileInput onPick={onPick} />
          </span>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-11 items-center rounded-lg bg-white/95 px-3 text-xs font-medium text-gray-700 shadow-sm"
          >
            삭제
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mt-1 flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-muted">
      <ImagePlus className="h-5 w-5" />
      사진 선택
      <ImageFileInput onPick={onPick} />
    </div>
  )
}

export function LandingBlocksField({
  blocks,
  onChange,
  slug,
  onError,
}: {
  blocks: LandingBlockDraft[]
  onChange: (blocks: LandingBlockDraft[]) => void
  slug?: string
  onError?: (message: string) => void
}) {
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropBlockId, setCropBlockId] = useState<string | null>(null)

  function update(id: string, patch: Partial<LandingBlockDraft>) {
    onChange(blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)))
  }

  function openCrop(id: string, file: File) {
    setCropBlockId(id)
    setCropFile(file)
    onError?.('')
  }

  async function applyCrop(cropped: File) {
    const blockId = cropBlockId
    setCropFile(null)
    setCropBlockId(null)
    if (!blockId) return
    const prepared = await preparePublicImage(cropped)
    if (typeof prepared === 'string') {
      onError?.(prepared)
      return
    }
    onError?.('')
    update(blockId, { file: prepared, imageCleared: false })
  }

  return (
    <div
      className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div>
        <p className="text-xs font-medium text-muted">랜딩페이지</p>
        <p className="mt-0.5 text-xs text-muted">
          /farm/{slug || '...'}/landingpage 에 사진과 설명이 순서대로 표시됩니다. 사진은 원하는
          비율로 잘라 올립니다.
          {slug ? (
            <>
              {' '}
              <a
                href={`/farm/${slug}/landingpage`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary"
              >
                미리보기
              </a>
            </>
          ) : null}
        </p>
      </div>
      {blocks.map((block, index) => (
        <div key={block.id} className="space-y-2 rounded-xl bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted">블록 {index + 1}</p>
            {blocks.length > 1 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted"
                onClick={() => onChange(blocks.filter((item) => item.id !== block.id))}
              >
                <X className="h-3.5 w-3.5" />
                삭제
              </button>
            )}
          </div>
          <div>
            <span className="text-xs font-medium text-muted">사진</span>
            <BlockImage
              file={block.file}
              url={block.imageCleared ? null : block.image_url}
              onPick={(file) => openCrop(block.id, file)}
              onClear={() => update(block.id, { file: null, imageCleared: true })}
            />
          </div>
          <Textarea
            label="설명"
            value={block.body}
            onChange={(e) => update(block.id, { body: e.target.value })}
            placeholder="농가 이야기, 재배 방식, 시즌 안내 등"
          />
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...blocks, createLandingBlock()])}
      >
        <Plus className="h-4 w-4" />
        사진·설명 추가
      </Button>
      <ImageCropDialog
        open={Boolean(cropFile)}
        file={cropFile}
        aspect={null}
        title="랜딩 사진 자르기"
        hint="화면에 보일 부분을 자유롭게 선택한 뒤 확인하세요. 자른 비율 그대로 랜딩페이지에 표시됩니다."
        onCancel={() => {
          setCropFile(null)
          setCropBlockId(null)
        }}
        onConfirm={(next) => void applyCrop(next)}
      />
    </div>
  )
}
