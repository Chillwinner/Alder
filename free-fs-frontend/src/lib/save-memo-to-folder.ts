/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { uploadFile } from '@/api/file'
import { packageMemoExport } from '@/lib/memo-markdown'
import type { WorkspaceMemo } from '@/types/workspace-board'

export async function saveMemosToFolder(memos: WorkspaceMemo[], parentId?: string) {
  for (const memo of memos) {
    const { file } = await packageMemoExport(memo, 'workspace')
    await uploadFile(file, parentId)
  }
}
