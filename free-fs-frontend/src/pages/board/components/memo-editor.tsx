/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { MemoLocalEditor } from '@/pages/board/components/memo-local-editor'
import type { MemoCollabStatus } from '@/lib/memo-stomp-provider'

type Props = {
  memoId: string
  className?: string
  fileshareFolderId?: string | null
  memosFolderId?: string | null
  workspaceSlug?: string
  onStatusChange?: (status: MemoCollabStatus) => void
}

/** 编辑走本地 Markdown 渲染，预览另用同一套文档样式。 */
export function MemoEditor({
  onStatusChange: _status,
  memosFolderId: _memosFolderId,
  ...props
}: Props) {
  return <MemoLocalEditor {...props} />
}
