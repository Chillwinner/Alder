/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { FileItem } from '@/types/file'

const SUFFIX = new Set(['docx', 'xlsx', 'pptx'])

export function isOfficeAiFile(file: FileItem | null | undefined) {
  if (!file || file.isDir) return false
  const suffix = (file.suffix ?? '').replace(/^\./, '').toLowerCase()
  return SUFFIX.has(suffix)
}
