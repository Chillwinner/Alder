/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { toast } from 'sonner'
import i18n from '@/i18n'
import type { FileItem } from '@/types/file'
import { canPreviewInApp, openFilePreview } from '@/utils/preview'
import { formatFileSize } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media-url'

export const IM_MSG_TEXT = 'TEXT'
export const IM_MSG_IMAGE = 'IMAGE'
export const IM_MSG_FILE = 'FILE'
export const IM_MSG_ENCRYPTED = 'ENCRYPTED_TEXT'

export type ImMessageMediaContent = {
  url?: string | null
  name: string
  size: number
  mime?: string | null
  width?: number | null
  height?: number | null
  shareId?: string | null
  fileId?: string | null
  isDir?: boolean
}

export function normalizeImMsgType(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().toUpperCase()
  }
  return IM_MSG_TEXT
}

export function resolveImMediaIconType(
  media: Pick<ImMessageMediaContent, 'name' | 'mime' | 'isDir'>
): string {
  if (media.isDir) return 'folder'
  const name = media.name.trim()
  const dot = name.lastIndexOf('.')
  if (dot > 0 && dot < name.length - 1) {
    return name.slice(dot + 1).toLowerCase()
  }
  const mime = (media.mime ?? '').toLowerCase().split(';')[0]?.trim() ?? ''
  if (mime.startsWith('video/')) return 'mp4'
  if (mime.startsWith('audio/')) return 'mp3'
  if (mime.startsWith('image/')) return 'png'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('word') || mime.includes('document')) return 'docx'
  if (mime.includes('sheet') || mime.includes('excel')) return 'xlsx'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'pptx'
  if (mime.startsWith('text/')) return 'txt'
  if (mime.includes('zip') || mime.includes('compressed')) return 'zip'
  return 'default'
}

export function fileNameToIconType(fileName: string, isDir?: boolean): string {
  return resolveImMediaIconType({ name: fileName, isDir: Boolean(isDir) })
}

export function formatImFileName(name: string, maxChars = 22): string {
  const trimmed = name.trim()
  if (trimmed.length <= maxChars) return trimmed
  const dot = trimmed.lastIndexOf('.')
  const ext = dot > 0 ? trimmed.slice(dot) : ''
  const stem = dot > 0 ? trimmed.slice(0, dot) : trimmed
  const keepExt = ext.length > 8 ? ext.slice(0, 8) : ext
  const keepStem = Math.max(4, maxChars - keepExt.length - 1)
  return `${stem.slice(0, keepStem)}…${keepExt}`
}

export function isImWorkspaceShare(media: ImMessageMediaContent | null | undefined): boolean {
  return Boolean(media?.shareId)
}

export function inferImMediaIsDir(
  media: Pick<ImMessageMediaContent, 'isDir' | 'shareId' | 'url'>
): boolean {
  return Boolean(media.isDir ?? (media.shareId && !media.url))
}

export function formatImMediaSize(
  media: Pick<ImMessageMediaContent, 'size' | 'isDir' | 'shareId' | 'url'>,
  fileFallback = '—'
): string {
  const isDir = inferImMediaIsDir(media)
  const size = media.size ?? 0
  if (isDir) {
    return size > 0 ? formatFileSize(size) : '—'
  }
  if (size <= 0) return fileFallback
  return formatFileSize(size)
}

export function parseImMessageMedia(content: string): ImMessageMediaContent | null {
  try {
    const parsed = JSON.parse(content) as ImMessageMediaContent
    if (parsed?.name && (parsed.url || parsed.shareId)) {
      return {
        ...parsed,
        isDir: inferImMediaIsDir(parsed),
      }
    }
  } catch {
    // plain text message
  }
  return null
}

export function mediaToFileItem(media: ImMessageMediaContent): FileItem {
  const suffix = media.name.includes('.')
    ? media.name.split('.').pop()?.toLowerCase() || ''
    : ''
  return {
    id: `im-media:${media.url}`,
    objectKey: media.url,
    originalName: media.name,
    displayName: media.name,
    suffix,
    size: media.size ?? 0,
    mimeType: media.mime || '',
    isDir: false,
    userId: '',
    uploadTime: '',
    updateTime: '',
  }
}

export function openImSharePage(shareId: string) {
  window.open(`/s/${shareId}`, '_blank', 'noopener,noreferrer')
}

export function openImMediaPreview(media: ImMessageMediaContent) {
  if (media.shareId && media.isDir) {
    openImSharePage(media.shareId)
    return
  }
  const file = mediaToFileItem(media)
  const sourceUrl =
    resolveMediaUrl(media.url) ||
    (media.shareId && media.fileId ? `/apis/share/${media.shareId}/content/${media.fileId}` : undefined)
  if (media.shareId && (!sourceUrl || !canPreviewInApp(file))) {
    openImSharePage(media.shareId)
    return
  }
  if (!sourceUrl || !canPreviewInApp(file)) {
    toast.info(i18n.t('messages:room.previewUnavailable'))
    return
  }
  openFilePreview(file, { sourceUrl })
}

export async function downloadImMedia(media: ImMessageMediaContent) {
  if (media.shareId && media.isDir) {
    openImSharePage(media.shareId)
    return
  }
  const sourceUrl =
    media.shareId && media.fileId
      ? `/apis/share/${media.shareId}/download/${media.fileId}`
      : resolveMediaUrl(media.url)
  if (!sourceUrl) {
    toast.error(i18n.t('messages:room.fileBroken'))
    return
  }
  const response = await fetch(sourceUrl, { credentials: 'include' })
  if (!response.ok) {
    toast.error(i18n.t('messages:room.downloadFailed'))
    return
  }
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = media.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

export function buildImMediaMessageContent(media: ImMessageMediaContent): string {
  return JSON.stringify({
    url: media.url ?? undefined,
    name: media.name,
    size: media.size,
    mime: media.mime ?? undefined,
    width: media.width ?? undefined,
    height: media.height ?? undefined,
    shareId: media.shareId ?? undefined,
    fileId: media.fileId ?? undefined,
    isDir: inferImMediaIsDir(media) || undefined,
  })
}
