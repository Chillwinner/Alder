/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { getFileAccessUrl, getFileContent } from '@/api/file'
import type { FileItem } from '@/types/file'
import { probeDirectUrl } from '@/utils/probe-direct-url'

export function triggerBrowserDownload(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function downloadFileItem(file: Pick<FileItem, 'id' | 'displayName'>) {
  const url = await getFileAccessUrl(file.id, 3600, true)
  if (await probeDirectUrl(url)) {
    triggerBrowserDownload(url, file.displayName)
    return
  }
  const blob = await getFileContent(file.id)
  const objectUrl = URL.createObjectURL(blob)
  triggerBrowserDownload(objectUrl, file.displayName)
  URL.revokeObjectURL(objectUrl)
}
