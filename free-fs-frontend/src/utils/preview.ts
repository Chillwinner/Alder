/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { lookupMemoByFileId, lookupMemoByName } from '@/api/workspace-board'
import { isCanvasFileName } from '@/lib/memo-canvas'
import type { FileItem } from '@/types/file'
import { useMemoPreviewStore } from '@/store/memo-preview'
import { usePreviewStore, type PreviewOpenOptions } from '@/store/preview'

export type PreviewKind =
  | 'image'
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'excel'
  | 'csv'
  | 'video'
  | 'audio'
  | 'text'
  | 'html'
  | 'markdown'
  | 'canvas'
  | 'archive'
  | 'unsupported'

const IMAGE = new Set([
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'gif',
  'bmp',
  'webp',
  'svg',
  'tif',
  'tiff',
  'avif',
  'heic',
  'heif',
  'ico',
  'apng',
])

export function isImagePreviewSuffix(suffix: string): boolean {
  return IMAGE.has(suffix.toLowerCase())
}
const VIDEO = new Set(['mp4', 'webm', 'avi', 'mkv', 'mov', 'wmv', 'flv'])
const AUDIO = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'])
const ARCHIVE = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz'])
const TEXT = new Set([
  'txt',
  'log',
  'ini',
  'properties',
  'yaml',
  'yml',
  'conf',
  'java',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'c',
  'cpp',
  'h',
  'hpp',
  'css',
  'scss',
  'json',
  'xml',
  'sql',
  'sh',
  'vue',
])

const CONTENT_TYPE: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  html: 'text/html',
  htm: 'text/html',
  md: 'text/markdown',
  markdown: 'text/markdown',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
}

export function getPreviewSuffix(file: FileItem): string {
  return (file.suffix || file.displayName.split('.').pop() || '').toLowerCase()
}

export function getPreviewKind(file: FileItem): PreviewKind {
  const suffix = getPreviewSuffix(file)
  if (isCanvasFileName(file.displayName) || isCanvasFileName(file.originalName) || suffix === 'canvas') {
    return 'canvas'
  }
  if (IMAGE.has(suffix)) return 'image'
  if (suffix === 'pdf') return 'pdf'
  if (suffix === 'docx') return 'docx'
  if (suffix === 'pptx' || suffix === 'ppt') return 'pptx'
  if (suffix === 'xlsx' || suffix === 'xls') return 'excel'
  if (suffix === 'csv') return 'csv'
  if (VIDEO.has(suffix)) return 'video'
  if (AUDIO.has(suffix)) return 'audio'
  if (suffix === 'htm' || suffix === 'html') return 'html'
  if (suffix === 'md' || suffix === 'markdown') return 'markdown'
  if (TEXT.has(suffix)) return 'text'
  if (ARCHIVE.has(suffix)) return 'archive'
  return 'unsupported'
}

export function canPreviewInApp(file: FileItem): boolean {
  return getPreviewKind(file) !== 'unsupported'
}

export function isDirectMediaPreview(file: FileItem): boolean {
  const kind = getPreviewKind(file)
  return kind === 'image' || kind === 'pdf' || kind === 'video' || kind === 'audio'
}

export function previewContentType(file: FileItem, fallback?: string): string | undefined {
  return CONTENT_TYPE[getPreviewSuffix(file)] || fallback || undefined
}

export function typedPreviewBlob(file: FileItem, raw: Blob): Blob {
  const type = previewContentType(file, raw.type)
  return type && raw.type !== type ? new Blob([raw], { type }) : raw
}

export function openFilePreview(file: FileItem, options?: PreviewOpenOptions) {
  if (file.isDir) return
  const kind = getPreviewKind(file)
  if (
    (kind === 'markdown' || kind === 'canvas') &&
    !options?.shareId &&
    !options?.sourceUrl
  ) {
    void openMemoIfVaultFile(file, options)
    return
  }
  usePreviewStore.getState().open(file, options)
}

async function openMemoIfVaultFile(file: FileItem, options?: PreviewOpenOptions) {
  const origin =
    options?.origin instanceof DOMRect
      ? options.origin
      : fileTileOrigin(file.id) ?? null
  try {
    const memo = await lookupMemoByFileId(file.id)
    if (memo?.id) {
      useMemoPreviewStore.getState().open(memo, origin)
      return
    }
  } catch {
    /* 普通 md，不是备忘录库文件 */
  }
  try {
    const memo = await lookupMemoByName(file.displayName)
    if (memo?.id) {
      useMemoPreviewStore.getState().open(memo, origin)
      return
    }
  } catch {
    /* 按文件名也找不到 */
  }
  usePreviewStore.getState().open(file, options)
}

export function originFromTarget(target: EventTarget | null): DOMRect | undefined {
  return target instanceof Element ? target.getBoundingClientRect() : undefined
}

export function fileTileOrigin(fileId: string): DOMRect | undefined {
  const el = document.querySelector(`[data-file-id="${CSS.escape(fileId)}"]`)
  return el instanceof HTMLElement ? el.getBoundingClientRect() : undefined
}
